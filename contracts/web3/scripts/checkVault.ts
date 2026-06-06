import { ethers } from "hardhat";
const VM = "0x5f0EA2dd5BE70F22375D42034d543C3f91B49667";
const KEEPER = "0x842056bb847BCe24bEb6D0d08703024DBa94CCE9";
const FOLLOWER = "0xc3ef3297b8ef61b94ef0cf74e97aab2af65702f7"; // from watcher log 0xc3ef32…

async function main() {
  const vm = await ethers.getContractAt([
    "function keeperOf(address) view returns (address)",
    "function getVault(address follower, address leader) view returns (tuple(address follower, address leader, uint256 ausdLocked, uint256 ausdAllocated, uint8 riskLevel, uint8 maxPerTradePct, address[] allowlist, uint8 status))",
    "function vaultId(address, address) view returns (bytes32)",
    "function getFollowerVaults(address) view returns (bytes32[])",
  ], VM);

  const keeper = await vm.keeperOf(FOLLOWER);
  console.log("keeperOf(follower):", keeper);
  console.log("keeper set?", keeper.toLowerCase() === KEEPER.toLowerCase());

  const vaultIds = await vm.getFollowerVaults(FOLLOWER);
  console.log("vaultIds:", vaultIds);

  if (vaultIds.length > 0) {
    // We need to know the leader — check via vaultId
    console.log("vault count:", vaultIds.length);
  }

  const keeperBal = await ethers.provider.getBalance(KEEPER);
  console.log("keeper STT balance:", ethers.formatEther(keeperBal), "STT");
}
main().catch(console.error);
