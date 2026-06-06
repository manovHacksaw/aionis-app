import { ethers } from "hardhat";
const VM_NEW   = "0x5f0EA2dd5BE70F22375D42034d543C3f91B49667" as const;
const VM_OLD   = "0x24108C322FeDD9e86B447Bb74f641483454d25ab" as const;
const FOLLOWER = "0xDd97c0e2C4E441B0dBe44B1E9B28e4fE8626502" as const;
const LEADER   = "0xc3ef32972c265a82efef46097dff1289cbdee72e" as const;

const ABI = ["function getVault(address follower, address leader) view returns (tuple(address follower, address leader, uint256 ausdLocked, uint256 ausdAllocated, uint8 riskLevel, uint8 maxPerTradePct, address[] allowlist, uint8 status))"];

async function main() {
  const provider = ethers.provider;
  for (const [label, addr] of [["NEW", VM_NEW], ["OLD", VM_OLD]] as const) {
    const vm = new ethers.Contract(addr, ABI, provider);
    const v  = await vm.getVault(FOLLOWER, LEADER);
    console.log(`\n[${label}] ${addr}`);
    console.log("  follower   :", v.follower);
    console.log("  ausdLocked :", ethers.formatUnits(v.ausdLocked, 6), "aUSD");
    console.log("  status     :", Number(v.status), "(0=ACTIVE 1=PAUSED 2=CLOSED)");
  }
}
main().catch(console.error);
