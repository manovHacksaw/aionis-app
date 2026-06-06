// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────────────────────
//  ██╗   ██╗ █████╗ ██╗   ██╗██╗  ████████╗
//  ██║   ██║██╔══██╗██║   ██║██║  ╚══██╔══╝
//  ██║   ██║███████║██║   ██║██║     ██║
//  ╚██╗ ██╔╝██╔══██║██║   ██║██║     ██║
//   ╚████╔╝ ██║  ██║╚██████╔╝███████╗██║
//
//  VaultManager — Aionis copy-trading core contract
//  Chain: Somnia Shannon Testnet (50312)
// ─────────────────────────────────────────────────────────────────────────────

// ── External interfaces ───────────────────────────────────────────────────────

/**
 * @notice Somnia Agent Platform — dispatches work to the off-chain agent fleet.
 * @dev Deployed at 0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776 on Somnia testnet.
 */
interface ISomniaAgentPlatform {
    function createRequest(
        uint256      agentId,
        bytes        calldata data,
        address      cbContract,
        bytes4       cbSelector
    ) external payable returns (bytes32 requestId);
}

/**
 * @notice Minimal aUSD interface — ERC-20 + mint for P&L settlement.
 */
interface IaUSD {
    function mint(address to, uint256 amount)                              external;
    function transfer(address to, uint256 amount)                         external returns (bool);
    function transferFrom(address from, address to, uint256 amount)       external returns (bool);
    function balanceOf(address account)                                   external view returns (uint256);
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @title  VaultManager
 * @author Aionis Team
 * @notice Core contract for Aionis copy-trading.
 *
 * @dev    Each user creates one vault per leader they want to follow.
 *         aUSD is locked inside the vault and never sent to a DEX.
 *         When the leader trades, a three-stage agent pipeline fires:
 *
 *         ┌─────────────────────────────────────────────────────────────────┐
 *         │  1. WATCHER  (JSON API Agent, id=1)                             │
 *         │     Fetches latest swap by the leader from the Aionis API.      │
 *         │                                                                 │
 *         │  2. STRATEGIST  (LLM Agent, id=2)                              │
 *         │     Evaluates trade + vault risk profile → copy score 0-100.   │
 *         │                                                                 │
 *         │  3. EXECUTOR  (on-chain, this contract)                        │
 *         │     Opens a virtual Position. No DEX swap. aUSD stays here.    │
 *         └─────────────────────────────────────────────────────────────────┘
 *
 *         A separate price-update pipeline keeps latestPrice[token] fresh
 *         so getUnrealizedPnL() is always meaningful.
 *
 *         P&L settlement on close:
 *           profit → aUSD minted into vault (VaultManager must be a minter)
 *           loss   → aUSD deducted from vault accounting
 */
contract VaultManager {

    // ── Constants ─────────────────────────────────────────────────────────────

    address public constant AGENT_PLATFORM =
        0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776;

    uint256 public constant JSON_API_AGENT_ID = 1;
    uint256 public constant LLM_AGENT_ID      = 2;

    uint256 public constant MAX_TRADE_AGE   = 5 minutes;
    uint8   public constant MIN_COPY_SCORE  = 10;
    uint256 public constant MIN_TRADE_AUSD  = 1e6;      // 1 aUSD minimum per trade

    // ── Immutables ────────────────────────────────────────────────────────────

    address public immutable AUSD;
    string  public           API_BASE;        // set in constructor, not constant (easier to upgrade)
    string  public           PRICE_API_BASE;

    // ── Enums ─────────────────────────────────────────────────────────────────

    enum VaultStatus    { ACTIVE, PAUSED, CLOSED }
    enum PositionStatus { OPEN, CLOSED }

    // ── Structs ───────────────────────────────────────────────────────────────

    struct VaultConfig {
        address     follower;
        address     leader;
        uint256     ausdLocked;       // total aUSD deposited into vault
        uint256     ausdAllocated;    // aUSD currently locked in open positions
        uint8       riskLevel;        // 1-10
        uint8       maxPerTradePct;   // max % of vault per single trade (1-100)
        address[]   allowlist;        // token addresses this vault is allowed to copy
        VaultStatus status;
    }

    struct Position {
        address         follower;
        address         leader;
        bytes32         vaultId;
        address         token;           // token being held virtually
        uint256         ausdAllocated;   // aUSD locked for this position
        uint256         entryPrice;      // price × 1e10 at open
        uint256         exitPrice;       // price × 1e10 at close (0 if open)
        int256          pnl;             // in aUSD base units (+ profit, − loss)
        PositionStatus  status;
        uint256         openedAt;
        uint256         closedAt;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    /// @notice vaultId(follower, leader) → vault config
    mapping(bytes32  => VaultConfig)  public vaults;

    /// @notice positionId → position
    mapping(bytes32  => Position)     public positions;

    /// @notice follower → all their vault IDs
    mapping(address  => bytes32[])    public followerVaults;

    /// @notice vaultId → all position IDs (open + closed)
    mapping(bytes32  => bytes32[])    public vaultPositions;

    /// @notice follower → address allowed to trigger the agent pipeline on their behalf
    mapping(address  => address)      public keeperOf;

    // ── Agent pipeline ────────────────────────────────────────────────────────

    /// @dev requestId → vaultId  (watcher and strategist callbacks share this)
    mapping(bytes32  => bytes32)      public requestToVault;

    /// @dev vaultId → raw trade bytes carried from watcher → strategist callback
    mapping(bytes32  => bytes)        private pendingTradeData;

    /// @dev One pipeline at a time per vault (prevents double-firing)
    mapping(bytes32  => bool)         public pipelineActive;

    // ── Price state ───────────────────────────────────────────────────────────

    /// @notice token address → latest price × 1e10
    mapping(address  => uint256)      public latestPrice;

    /// @dev requestId → token address  (price callback lookup)
    mapping(bytes32  => address)      private priceRequestToToken;

    /// @dev position counter for unique IDs
    uint256 private _positionNonce;

    // ── Events ────────────────────────────────────────────────────────────────

    event VaultCreated(
        address indexed follower,
        address indexed leader,
        bytes32 indexed vaultId,
        uint256 amount
    );
    event VaultDeposited(bytes32 indexed vaultId, uint256 amount);
    event VaultWithdrawn(bytes32 indexed vaultId, uint256 amount);
    event VaultPaused(bytes32 indexed vaultId);
    event VaultResumed(bytes32 indexed vaultId);
    event VaultClosed(bytes32 indexed vaultId);
    event KeeperSet(address indexed follower, address indexed keeper);

    event AllowlistAdded(bytes32 indexed vaultId, address[] tokens);
    event AllowlistRemoved(bytes32 indexed vaultId, address[] tokens);

    event WatcherRequested(bytes32 indexed requestId, bytes32 indexed vaultId);
    event WatcherResponse(
        bytes32 indexed requestId,
        bytes32 indexed vaultId,
        address tokenIn,
        address tokenOut,
        uint256 usdValue,
        uint256 tradeTimestamp
    );
    event StrategistRequested(bytes32 indexed requestId, bytes32 indexed vaultId);
    event StrategistResponse(
        bytes32 indexed requestId,
        bytes32 indexed vaultId,
        uint8   score,
        bool    willExecute
    );
    event TradeSkipped(bytes32 indexed vaultId, string reason);
    event TradeCopied(
        bytes32 indexed vaultId,
        address indexed token,
        uint256 ausdAllocated,
        uint8   copyScore
    );

    event PositionOpened(
        bytes32 indexed positionId,
        bytes32 indexed vaultId,
        address         token,
        uint256         ausdAllocated,
        uint256         entryPrice
    );
    event PositionClosed(
        bytes32 indexed positionId,
        bytes32 indexed vaultId,
        int256          pnl,
        uint256         exitPrice
    );

    event PriceUpdated(address indexed token, uint256 price);

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyAgentPlatform() {
        require(msg.sender == AGENT_PLATFORM, "VM: caller is not agent platform");
        _;
    }

    modifier onlyFollowerOrKeeper(address follower) {
        require(
            msg.sender == follower || msg.sender == keeperOf[follower],
            "VM: not authorized"
        );
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _ausd, string memory _apiBase, string memory _priceApiBase) {
        require(_ausd != address(0), "VM: zero aUSD address");
        AUSD          = _ausd;
        API_BASE      = _apiBase;
        PRICE_API_BASE = _priceApiBase;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  VAULT ID
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Deterministic vault ID: one vault per (follower, leader) pair.
    function vaultId(address follower, address leader) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(follower, leader));
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  VAULT MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a new vault for a specific leader.
     * @param leader           Wallet to copy-trade.
     * @param amount           aUSD to lock (must be pre-approved).
     * @param riskLevel        1 (conservative) – 10 (aggressive). Passed to LLM.
     * @param maxPerTradePct   Max % of vault per single trade (1-100).
     * @param allowlist        Token addresses this vault is allowed to copy.
     *                         Must contain at least one token — empty = no trades.
     */
    function createVault(
        address            leader,
        uint256            amount,
        uint8              riskLevel,
        uint8              maxPerTradePct,
        address[] calldata allowlist
    ) external {
        require(leader != address(0) && leader != msg.sender, "VM: invalid leader");
        require(riskLevel >= 1 && riskLevel <= 10,            "VM: riskLevel 1-10");
        require(maxPerTradePct >= 1 && maxPerTradePct <= 100, "VM: maxPct 1-100");
        require(allowlist.length > 0,                         "VM: allowlist empty, no trades will copy");
        require(amount > 0,                                   "VM: zero deposit");

        bytes32 id = vaultId(msg.sender, leader);
        require(vaults[id].follower == address(0),            "VM: vault already exists");

        require(
            IaUSD(AUSD).transferFrom(msg.sender, address(this), amount),
            "VM: deposit failed"
        );

        vaults[id] = VaultConfig({
            follower:       msg.sender,
            leader:         leader,
            ausdLocked:     amount,
            ausdAllocated:  0,
            riskLevel:      riskLevel,
            maxPerTradePct: maxPerTradePct,
            allowlist:      allowlist,
            status:         VaultStatus.ACTIVE
        });

        followerVaults[msg.sender].push(id);

        emit VaultCreated(msg.sender, leader, id, amount);
    }

    /**
     * @notice Delegate a keeper address to trigger copy trades on your behalf.
     *         Set to address(0) to revoke.
     */
    function setKeeper(address keeper) external {
        keeperOf[msg.sender] = keeper;
        emit KeeperSet(msg.sender, keeper);
    }

    /**
     * @notice Top up an existing vault.
     */
    function deposit(address leader, uint256 amount) external {
        bytes32 id = vaultId(msg.sender, leader);
        require(vaults[id].status != VaultStatus.CLOSED, "VM: vault closed");
        require(amount > 0, "VM: zero amount");

        require(
            IaUSD(AUSD).transferFrom(msg.sender, address(this), amount),
            "VM: deposit failed"
        );
        vaults[id].ausdLocked += amount;

        emit VaultDeposited(id, amount);
    }

    /**
     * @notice Withdraw all aUSD and close the vault.
     *         Requires no open positions — close them first.
     */
    function withdraw(address leader) external {
        bytes32 id = vaultId(msg.sender, leader);
        VaultConfig storage v = vaults[id];
        require(v.follower == msg.sender,   "VM: not your vault");
        require(v.status != VaultStatus.CLOSED, "VM: already closed");
        require(v.ausdAllocated == 0,       "VM: close open positions first");

        uint256 balance = v.ausdLocked;
        v.ausdLocked = 0;
        v.status     = VaultStatus.CLOSED;

        require(IaUSD(AUSD).transfer(msg.sender, balance), "VM: withdraw failed");

        emit VaultWithdrawn(id, balance);
        emit VaultClosed(id);
    }

    /**
     * @notice Pause copy-trading for a vault (follower only).
     *         In-flight pipeline completes but no new ones start.
     */
    function pauseVault(address leader) external {
        bytes32 id = vaultId(msg.sender, leader);
        require(vaults[id].follower == msg.sender,          "VM: not your vault");
        require(vaults[id].status == VaultStatus.ACTIVE,   "VM: not active");
        vaults[id].status = VaultStatus.PAUSED;
        emit VaultPaused(id);
    }

    /**
     * @notice Resume a paused vault (follower only).
     */
    function resumeVault(address leader) external {
        bytes32 id = vaultId(msg.sender, leader);
        require(vaults[id].follower == msg.sender,          "VM: not your vault");
        require(vaults[id].status == VaultStatus.PAUSED,   "VM: not paused");
        vaults[id].status = VaultStatus.ACTIVE;
        emit VaultResumed(id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  ALLOWLIST MANAGEMENT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Add tokens to the vault allowlist in a single transaction.
     * @param tokens Array of token addresses to allow. Duplicates are skipped.
     */
    function addToAllowlist(address leader, address[] calldata tokens) external {
        require(tokens.length > 0, "VM: empty array");
        bytes32 id = vaultId(msg.sender, leader);
        require(vaults[id].follower == msg.sender, "VM: not your vault");

        VaultConfig storage v = vaults[id];
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "VM: zero token address");
            if (!_inAllowlist(v.allowlist, tokens[i])) {
                v.allowlist.push(tokens[i]);
            }
        }

        emit AllowlistAdded(id, tokens);
    }

    /**
     * @notice Remove tokens from the vault allowlist in a single transaction.
     *         Vault must retain at least one token — removing all would freeze the vault.
     */
    function removeFromAllowlist(address leader, address[] calldata tokens) external {
        require(tokens.length > 0, "VM: empty array");
        bytes32 id = vaultId(msg.sender, leader);
        require(vaults[id].follower == msg.sender, "VM: not your vault");

        VaultConfig storage v = vaults[id];
        for (uint256 i = 0; i < tokens.length; i++) {
            _removeFromArray(v.allowlist, tokens[i]);
        }
        require(v.allowlist.length > 0, "VM: cannot remove all tokens from allowlist");

        emit AllowlistRemoved(id, tokens);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  AGENT PIPELINE — STEP 1: KICK OFF (WATCHER)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Trigger the copy-trade pipeline for a follower.
     * @dev    Called by the follower themselves or their delegated keeper.
     *         The watcher service calls this automatically when the leader trades.
     *
     * @param follower  The follower whose vault to check.
     * @param leader    The leader whose latest trade to fetch.
     */
    function checkLeaderActivity(
        address follower,
        address leader
    ) external payable onlyFollowerOrKeeper(follower) {
        bytes32 id = vaultId(follower, leader);
        VaultConfig storage v = vaults[id];

        require(v.status == VaultStatus.ACTIVE,    "VM: vault not active");
        require(!pipelineActive[id],               "VM: pipeline already running");
        require(_freeBalance(v) > MIN_TRADE_AUSD,  "VM: insufficient free balance");

        pipelineActive[id] = true;

        string memory url = string.concat(API_BASE, _toHexString(leader), "/latest-swap");
        bytes memory requestData = abi.encode(url, "$.swap");

        bytes32 requestId = ISomniaAgentPlatform(AGENT_PLATFORM).createRequest{value: msg.value}(
            JSON_API_AGENT_ID,
            requestData,
            address(this),
            this.onWatcherResponse.selector
        );

        requestToVault[requestId] = id;

        emit WatcherRequested(requestId, id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  AGENT PIPELINE — STEP 2: WATCHER CALLBACK → DISPATCH STRATEGIST
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Called by the Somnia Agent Platform after the JSON API Agent
     *         fetches the leader's latest swap from the Aionis API.
     *
     * @dev    Response ABI-encoded as:
     *           (address tokenIn, address tokenOut, uint256 usdValue,
     *            uint256 tradePrice, uint256 tradeTimestamp)
     */
    function onWatcherResponse(
        bytes32        requestId,
        bytes calldata response
    ) external onlyAgentPlatform {
        bytes32 id = requestToVault[requestId];
        require(id != bytes32(0), "VM: unknown watcher request");
        delete requestToVault[requestId];

        VaultConfig storage v = vaults[id];

        (
            address tokenIn,
            address tokenOut,
            uint256 usdValue,
            uint256 tradePrice,
            uint256 tradeTimestamp
        ) = abi.decode(response, (address, address, uint256, uint256, uint256));

        emit WatcherResponse(requestId, id, tokenIn, tokenOut, usdValue, tradeTimestamp);

        // ── Stale trade guard ─────────────────────────────────────────────────
        if (block.timestamp - tradeTimestamp > MAX_TRADE_AGE) {
            emit TradeSkipped(id, "stale trade");
            pipelineActive[id] = false;
            return;
        }

        // ── Only copy BUY trades (tokenOut = asset being acquired) ────────────
        // Determine the asset being traded into
        // BUY:  tokenIn = stablecoin, tokenOut = asset (e.g. WSOMI)
        // SELL: tokenIn = asset, tokenOut = stablecoin — we skip SELLs at watcher stage
        address tradedToken = tokenOut;

        // ── Allowlist check ───────────────────────────────────────────────────
        if (!_inAllowlist(v.allowlist, tradedToken)) {
            emit TradeSkipped(id, "token not in allowlist");
            pipelineActive[id] = false;
            return;
        }

        // ── Free balance check ────────────────────────────────────────────────
        uint256 freeBalance = _freeBalance(v);
        if (freeBalance <= MIN_TRADE_AUSD) {
            emit TradeSkipped(id, "insufficient free balance");
            pipelineActive[id] = false;
            return;
        }

        // ── Store trade data for strategist ──────────────────────────────────
        pendingTradeData[id] = response;

        // ── Build LLM prompt and dispatch ────────────────────────────────────
        uint256 maxTrade = (v.ausdLocked * v.maxPerTradePct) / 100;
        if (maxTrade > freeBalance) maxTrade = freeBalance;

        string memory prompt = _buildPrompt(
            v.leader, tradedToken, usdValue, tradeTimestamp,
            v.riskLevel, v.ausdLocked, freeBalance, maxTrade,
            latestPrice[tradedToken]
        );

        bytes32 llmRequestId = ISomniaAgentPlatform(AGENT_PLATFORM).createRequest(
            LLM_AGENT_ID,
            abi.encode(prompt),
            address(this),
            this.onStrategistResponse.selector
        );

        requestToVault[llmRequestId] = id;

        emit StrategistRequested(llmRequestId, id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  AGENT PIPELINE — STEP 3: STRATEGIST CALLBACK → OPEN POSITION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Called by the Somnia Agent Platform after the LLM Strategist
     *         evaluates the trade.
     *
     * @dev    Response ABI-encoded as uint8 (0-100 copy score).
     */
    function onStrategistResponse(
        bytes32        requestId,
        bytes calldata response
    ) external onlyAgentPlatform {
        bytes32 id = requestToVault[requestId];
        require(id != bytes32(0), "VM: unknown strategist request");
        delete requestToVault[requestId];

        uint256 rawScore = abi.decode(response, (uint256));
        uint8 score = rawScore > 100 ? 100 : uint8(rawScore);

        bool willExecute = score >= MIN_COPY_SCORE;
        emit StrategistResponse(requestId, id, score, willExecute);

        if (!willExecute) {
            emit TradeSkipped(id, "score below threshold");
            delete pendingTradeData[id];
            pipelineActive[id] = false;
            return;
        }

        _openPosition(id, score);

        delete pendingTradeData[id];
        pipelineActive[id] = false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  POSITION — OPEN (INTERNAL)
    // ─────────────────────────────────────────────────────────────────────────

    function _openPosition(bytes32 id, uint8 score) internal {
        VaultConfig storage v = vaults[id];

        (, address tokenOut, , uint256 tradePrice,) = abi.decode(
            pendingTradeData[id],
            (address, address, uint256, uint256, uint256)
        );

        uint256 freeBalance = _freeBalance(v);
        uint256 maxTrade    = (v.ausdLocked * v.maxPerTradePct) / 100;
        if (maxTrade > freeBalance) maxTrade = freeBalance;

        uint256 ausdAmount = (maxTrade * score) / 100;

        if (ausdAmount < MIN_TRADE_AUSD) {
            emit TradeSkipped(id, "allocated amount below minimum");
            return;
        }
        if (ausdAmount > freeBalance) {
            ausdAmount = freeBalance;   // cap to free balance
        }

        // Use on-chain latestPrice if available, fall back to trade-time price
        uint256 entryPrice = latestPrice[tokenOut] > 0
            ? latestPrice[tokenOut]
            : tradePrice;

        bytes32 posId = keccak256(
            abi.encodePacked(id, block.timestamp, tokenOut, ++_positionNonce)
        );

        positions[posId] = Position({
            follower:      v.follower,
            leader:        v.leader,
            vaultId:       id,
            token:         tokenOut,
            ausdAllocated: ausdAmount,
            entryPrice:    entryPrice,
            exitPrice:     0,
            pnl:           0,
            status:        PositionStatus.OPEN,
            openedAt:      block.timestamp,
            closedAt:      0
        });

        vaultPositions[id].push(posId);
        v.ausdAllocated += ausdAmount;

        emit PositionOpened(posId, id, tokenOut, ausdAmount, entryPrice);
        emit TradeCopied(id, tokenOut, ausdAmount, score);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  POSITION — CLOSE
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Close an open position and settle P&L.
     * @dev    Called by:
     *           - The follower manually (stop-loss / take-profit)
     *           - The keeper wallet when the leader sells
     *
     *         Profit → VaultManager mints aUSD into vault (must be a minter).
     *         Loss   → aUSD deducted from vault accounting.
     *
     * @param positionId  The position to close.
     */
    function closePosition(bytes32 positionId) external {
        Position storage pos = positions[positionId];
        require(pos.status == PositionStatus.OPEN, "VM: position not open");

        address follower = pos.follower;
        require(
            msg.sender == follower || msg.sender == keeperOf[follower],
            "VM: not authorized"
        );

        bytes32 id = pos.vaultId;
        VaultConfig storage v = vaults[id];

        uint256 exitPrice = latestPrice[pos.token];
        require(exitPrice > 0, "VM: no price available, call updatePrice first");

        // Virtual P&L: proportional to price change
        uint256 exitValue = (pos.ausdAllocated * exitPrice) / pos.entryPrice;
        int256  pnl       = int256(exitValue) - int256(pos.ausdAllocated);

        if (exitValue > pos.ausdAllocated) {
            // Profit: mint extra aUSD into the vault
            uint256 profit = exitValue - pos.ausdAllocated;
            IaUSD(AUSD).mint(address(this), profit);
            v.ausdLocked += profit;
        } else if (exitValue < pos.ausdAllocated) {
            // Loss: reduce vault balance
            uint256 loss = pos.ausdAllocated - exitValue;
            v.ausdLocked -= loss;
        }

        v.ausdAllocated -= pos.ausdAllocated;

        pos.exitPrice = exitPrice;
        pos.pnl       = pnl;
        pos.status    = PositionStatus.CLOSED;
        pos.closedAt  = block.timestamp;

        emit PositionClosed(positionId, id, pnl, exitPrice);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  PRICE UPDATE PIPELINE
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Dispatch a JSON API Agent request to update the on-chain price
     *         for a given token. Called by the keeper after every leader swap.
     *
     * @param token  Token contract address (e.g. WSOMI).
     */
    function updatePrice(address token) external payable {
        require(token != address(0), "VM: zero token");

        string memory url = string.concat(PRICE_API_BASE, _toHexString(token));
        bytes memory requestData = abi.encode(url, "$.price");

        bytes32 requestId = ISomniaAgentPlatform(AGENT_PLATFORM).createRequest{value: msg.value}(
            JSON_API_AGENT_ID,
            requestData,
            address(this),
            this.onPriceUpdate.selector
        );

        priceRequestToToken[requestId] = token;
    }

    /**
     * @notice Called by the Somnia Agent Platform with the latest price.
     * @dev    Response ABI-encoded as uint256 (price × 1e10).
     */
    function onPriceUpdate(
        bytes32        requestId,
        bytes calldata response
    ) external onlyAgentPlatform {
        address token = priceRequestToToken[requestId];
        require(token != address(0), "VM: unknown price request");
        delete priceRequestToToken[requestId];

        uint256 price = abi.decode(response, (uint256));
        require(price > 0, "VM: invalid price");

        latestPrice[token] = price;

        emit PriceUpdated(token, price);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  VIEW FUNCTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Get a vault's full config.
    function getVault(address follower, address leader)
        external view
        returns (VaultConfig memory)
    {
        return vaults[vaultId(follower, leader)];
    }

    /// @notice Get the allowlist for a vault.
    function getAllowlist(address follower, address leader)
        external view
        returns (address[] memory)
    {
        return vaults[vaultId(follower, leader)].allowlist;
    }

    /// @notice aUSD in the vault not currently locked in positions.
    function getFreeBalance(address follower, address leader)
        external view
        returns (uint256)
    {
        return _freeBalance(vaults[vaultId(follower, leader)]);
    }

    /// @notice Get all vault IDs for a follower.
    function getFollowerVaults(address follower)
        external view
        returns (bytes32[] memory)
    {
        return followerVaults[follower];
    }

    /// @notice Get all open position IDs for a vault.
    function getOpenPositions(address follower, address leader)
        external view
        returns (bytes32[] memory openIds)
    {
        bytes32 id = vaultId(follower, leader);
        bytes32[] storage all = vaultPositions[id];

        uint256 count;
        for (uint256 i = 0; i < all.length; i++) {
            if (positions[all[i]].status == PositionStatus.OPEN) count++;
        }

        openIds = new bytes32[](count);
        uint256 j;
        for (uint256 i = 0; i < all.length; i++) {
            if (positions[all[i]].status == PositionStatus.OPEN) {
                openIds[j++] = all[i];
            }
        }
    }

    /**
     * @notice Aggregate unrealized P&L across all open positions in a vault.
     *         Requires latestPrice to be populated for each token via updatePrice().
     */
    function getUnrealizedPnL(address follower, address leader)
        external view
        returns (int256 totalPnl)
    {
        bytes32 id = vaultId(follower, leader);
        bytes32[] storage posIds = vaultPositions[id];

        for (uint256 i = 0; i < posIds.length; i++) {
            Position storage pos = positions[posIds[i]];
            if (pos.status != PositionStatus.OPEN) continue;

            uint256 currentPrice = latestPrice[pos.token];
            if (currentPrice == 0 || pos.entryPrice == 0) continue;

            int256 unrealized = int256((pos.ausdAllocated * currentPrice) / pos.entryPrice)
                              - int256(pos.ausdAllocated);
            totalPnl += unrealized;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  INTERNAL HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    function _buildPrompt(
        address leader,
        address tradedToken,
        uint256 usdValue,
        uint256 tradeTimestamp,
        uint8   riskLevel,
        uint256 ausdLocked,
        uint256 freeBalance,
        uint256 maxTrade,
        uint256 currentPrice
    ) internal view returns (string memory) {
        uint256 tradeAgeSec   = block.timestamp - tradeTimestamp;
        uint256 freePct       = ausdLocked > 0 ? (freeBalance * 100) / ausdLocked : 0;
        uint256 usdValueWhole = usdValue   / 1e6;
        uint256 freeWhole     = freeBalance / 1e6;
        uint256 lockedWhole   = ausdLocked  / 1e6;
        uint256 maxWhole      = maxTrade    / 1e6;
        uint256 priceWhole    = currentPrice / 1e10;

        string memory header = string.concat(
            "You are a risk management engine for Aionis, a copy-trading platform on Somnia.\n",
            "Evaluate the trade below and decide what percentage of the follower vault to allocate.\n\n",
            "OUTPUT: Respond with ONLY a single integer 0-100. No explanation. No text. Just the number.\n\n",
            "SCORING SCALE:\n",
            "  0        = skip this trade entirely\n",
            "  1-33     = low confidence  (small allocation)\n",
            "  34-66    = medium confidence  (moderate allocation)\n",
            "  67-99    = high confidence  (significant allocation)\n",
            "  100      = maximum confidence  (full max-per-trade allocation)\n\n",
            "ALLOCATION FORMULA:\n",
            "  allocation = (score / 100) x max_per_trade\n",
            "  Example: score=60, max_per_trade=$200 -> $120 allocated from vault\n\n"
        );

        string memory tradeSection = string.concat(
            "--- TRADE ---\n",
            "Leader wallet:    ", _toHexString(leader),        "\n",
            "Token bought:     ", _toHexString(tradedToken),   "\n",
            "Trade USD value:  $", _uint2str(usdValueWhole),   "\n",
            "Trade age:        ", _uint2str(tradeAgeSec),      "s ago\n",
            "Current price:    $", _uint2str(priceWhole),      " (x1e10 units)\n\n"
        );

        string memory vaultSection = string.concat(
            "--- FOLLOWER VAULT ---\n",
            "Vault total:      $", _uint2str(lockedWhole),     "\n",
            "Free balance:     $", _uint2str(freeWhole),
                                   " (", _uint2str(freePct),   "% of vault)\n",
            "Max per trade:    $", _uint2str(maxWhole),        "\n",
            "Risk tolerance:   ",  _uint2str(riskLevel),       "/10\n\n"
        );

        string memory rules = string.concat(
            "--- RULES (apply strictly in order) ---\n",
            "1. If free balance < $1 -> return 0.\n",
            "2. If trade age > 120s -> return 0 (stale signal).\n",
            "3. If trade USD value < $5 -> return 0 (noise trade, ignore).\n",
            "4. If free balance < $10 -> return 0 (vault nearly empty).\n\n",
            "RISK SCORE CEILING:\n",
            "  Risk 1-2  -> max score 20\n",
            "  Risk 3-4  -> max score 40\n",
            "  Risk 5-6  -> max score 65\n",
            "  Risk 7-8  -> max score 85\n",
            "  Risk 9-10 -> max score 100\n\n",
            "FREE BALANCE PENALTIES:\n",
            "  Free balance < 10% of vault  -> reduce score by 30%\n",
            "  Trade size > 10x free balance -> reduce score by 50%\n\n",
            "CONFIDENCE BOOSTERS:\n",
            "  Trade age < 10s              -> add up to 10 to score (very fresh)\n",
            "  Trade USD value > $500       -> significant move, weight higher\n",
            "  Trade USD value > $1000      -> major position by leader\n\n",
            "Respond with a single integer 0-100."
        );

        return string.concat(header, tradeSection, vaultSection, rules);
    }

    function _freeBalance(VaultConfig storage v) internal view returns (uint256) {
        if (v.ausdAllocated >= v.ausdLocked) return 0;
        return v.ausdLocked - v.ausdAllocated;
    }

    function _inAllowlist(address[] storage list, address token) internal view returns (bool) {
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == token) return true;
        }
        return false;
    }

    function _removeFromArray(address[] storage arr, address token) internal {
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == token) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                return;
            }
        }
    }

    function _toHexString(address addr) internal pure returns (string memory) {
        bytes memory b    = abi.encodePacked(addr);
        bytes memory hex_ = "0123456789abcdef";
        bytes memory str  = new bytes(42);
        str[0] = "0"; str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2]     = hex_[uint8(b[i]) >> 4];
            str[3 + i * 2]     = hex_[uint8(b[i]) & 0x0f];
        }
        return string(str);
    }

    function _uint2str(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 j = v; uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (v != 0) { k--; bstr[k] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(bstr);
    }

    receive() external payable {}
}
