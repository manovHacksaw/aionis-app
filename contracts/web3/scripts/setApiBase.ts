import { ethers } from 'hardhat';

const VAULT_MANAGER = '0x89B849FA54BC90f93Ae1165f119A86460Bb0e54B';
const NGROK_URL     = process.env.NGROK_URL ?? '';

async function main() {
  if (!NGROK_URL) {
    console.error('Usage: NGROK_URL=https://xxxx.ngrok-free.app npx hardhat run scripts/setApiBase.ts --network somnia');
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();
  console.log('Using:', deployer.address);

  const vm = await ethers.getContractAt('VaultManager', VAULT_MANAGER);

  const apiBase      = `${NGROK_URL}/api/agent/leader/`;
  const priceApiBase = `${NGROK_URL}/api/price/`;

  console.log('Setting API_BASE:      ', apiBase);
  const tx1 = await vm.setApiBase(apiBase);
  await tx1.wait();

  console.log('Setting PRICE_API_BASE:', priceApiBase);
  const tx2 = await vm.setPriceApiBase(priceApiBase);
  await tx2.wait();

  console.log('\nDone.');
  console.log('  API_BASE:      ', await vm.API_BASE());
  console.log('  PRICE_API_BASE:', await vm.PRICE_API_BASE());
}

main().catch((e) => { console.error(e); process.exit(1); });
