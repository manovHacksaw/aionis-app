import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying aUSD...');
  console.log('Deployer:', deployer.address);
  console.log('Balance: ', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'STT\n');

  const AUSD = await ethers.getContractFactory('aUSD');
  const ausd = await AUSD.deploy();
  await ausd.waitForDeployment();

  const address = await ausd.getAddress();

  console.log('aUSD deployed to:', address);
  console.log('\nVerify:');
  console.log('  Name:           ', await ausd.name());
  console.log('  Symbol:         ', await ausd.symbol());
  console.log('  Decimals:       ', await ausd.decimals());
  console.log('  Owner:          ', await ausd.owner());
  console.log('  Faucet amount:  ', (await ausd.FAUCET_AMOUNT()).toString(), '(raw)');
  console.log('  Faucet cooldown:', (await ausd.FAUCET_COOLDOWN()).toString(), 'seconds');

  console.log('\nNext steps:');
  console.log('  1. Copy address to .env.local: NEXT_PUBLIC_AUSD_ADDRESS=' + address);
  console.log('  2. Copy address to watcher/.env: AUSD_ADDRESS=' + address);
  console.log('  3. After VaultManager deploy, run: ausd.addMinter(vaultManagerAddress)');
}

main().catch((e) => { console.error(e); process.exit(1); });
