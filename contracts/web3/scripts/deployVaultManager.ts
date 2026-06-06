import { ethers } from 'hardhat';

const AUSD_ADDRESS    = process.env.AUSD_ADDRESS    ?? '';
const API_BASE        = process.env.API_BASE        ?? 'https://aionis.xyz/api/agent/leader/';
const PRICE_API_BASE  = process.env.PRICE_API_BASE  ?? 'https://aionis.xyz/api/price/';

async function main() {
  if (!AUSD_ADDRESS) {
    console.error('ERROR: Set AUSD_ADDRESS in .env before deploying VaultManager');
    process.exit(1);
  }

  const [deployer] = await ethers.getSigners();

  console.log('Deploying VaultManager...');
  console.log('Deployer:      ', deployer.address);
  console.log('Balance:       ', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'STT');
  console.log('aUSD address:  ', AUSD_ADDRESS);
  console.log('API base:      ', API_BASE);
  console.log('Price API base:', PRICE_API_BASE, '\n');

  const VaultManager = await ethers.getContractFactory('VaultManager');
  const vm           = await VaultManager.deploy(AUSD_ADDRESS, API_BASE, PRICE_API_BASE);
  await vm.waitForDeployment();

  const vmAddress = await vm.getAddress();

  console.log('VaultManager deployed to:', vmAddress);
  console.log('\nVerify:');
  console.log('  AUSD:           ', await vm.AUSD());
  console.log('  Agent Platform: ', await vm.AGENT_PLATFORM());
  console.log('  API_BASE:       ', await vm.API_BASE());
  console.log('  PRICE_API_BASE: ', await vm.PRICE_API_BASE());

  // ── Whitelist VaultManager as aUSD minter ─────────────────────────────────
  console.log('\nWhitelisting VaultManager as aUSD minter...');
  const ausd = await ethers.getContractAt('aUSD', AUSD_ADDRESS);
  const tx   = await ausd.addMinter(vmAddress);
  await tx.wait();
  console.log('  Done. VaultManager can now mint aUSD for P&L settlement.');
  console.log('  Minter confirmed:', await ausd.minters(vmAddress));

  console.log('\nNext steps:');
  console.log('  1. Copy to .env.local:  NEXT_PUBLIC_VAULT_MANAGER_ADDRESS=' + vmAddress);
  console.log('  2. Copy to watcher/.env: VAULT_MANAGER_ADDRESS=' + vmAddress);
  console.log('  3. Fund keeper wallet with STT for gas');
}

main().catch((e) => { console.error(e); process.exit(1); });
