import { ethers } from "hardhat";
async function main() {
  const vm = await ethers.getContractAt(
    ["function API_BASE() view returns (string)", "function PRICE_API_BASE() view returns (string)"],
    "0x24108C322FeDD9e86B447Bb74f641483454d25ab"
  );
  console.log("API_BASE      :", await vm.API_BASE());
  console.log("PRICE_API_BASE:", await vm.PRICE_API_BASE());
}
main().catch(console.error);
