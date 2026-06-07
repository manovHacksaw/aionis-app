import { ethers } from 'hardhat';

async function main() {
  const VAULT_MANAGER_ADDRESS = '0x070f3A3BceAB706dD1cFB64cF14854c14e109e0F';
  const follower = '0xfd3495db0fdb7b60fc7915768488d2bafe5aa383';
  const leader = '0xc3ef32972c265a82efef46097dff1289cbdee72e';
  const AGENT_FEE = ethers.parseEther('0.001');

  const KEEPER_KEY = '0x0760826cee782660ded21ac319a8abb8cc6a1cd1c001fdf724cc437c953d21c7';
  const deployer = new ethers.Wallet(KEEPER_KEY, ethers.provider);
  console.log('Using account:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'STT');

  const vm = await ethers.getContractAt('VaultManager', VAULT_MANAGER_ADDRESS);

  console.log('Simulating checkLeaderActivity...');
  try {
    const tx = await vm.checkLeaderActivity.populateTransaction(follower, leader, {
      value: AGENT_FEE,
    });
    const result = await deployer.call(tx);
    console.log('Call result:', result);
  } catch (err: any) {
    console.error('Call failed!');
    if (err.data) {
      console.error('Revert data:', err.data);
    }
    console.error(err);
  }
}

main().catch(console.error);
