import { ethers } from 'ethers';

function printSelector(sig: string) {
  const hash = ethers.id(sig);
  const selector = hash.substring(0, 10);
  console.log(`${sig} -> ${selector}`);
}

async function main() {
  printSelector('createRequest(uint256,bytes,address,bytes4)');
  printSelector('createRequest(uint256,address,bytes4,bytes)');
}

main().catch(console.error);
