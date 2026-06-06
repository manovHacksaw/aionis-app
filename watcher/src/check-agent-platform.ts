import { createPublicClient, http, parseEther } from 'viem';
import { somniaTestnet, KEEPER_PRIVATE_KEY } from './config.js';
import { privateKeyToAccount } from 'viem/accounts';
import 'dotenv/config';

const AGENT_PLATFORM = '0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776';

const AGENT_PLATFORM_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'agentId', type: 'uint256' },
      { internalType: 'bytes', name: 'data', type: 'bytes' },
      { internalType: 'address', name: 'cbContract', type: 'address' },
      { internalType: 'bytes4', name: 'cbSelector', type: 'bytes4' }
    ],
    name: 'createRequest',
    outputs: [{ internalType: 'bytes32', name: 'requestId', type: 'bytes32' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

const account = privateKeyToAccount(KEEPER_PRIVATE_KEY as `0x${string}`);

const client = createPublicClient({
  chain: somniaTestnet,
  transport: http('https://dream-rpc.somnia.network/'),
});

async function main() {
  console.log('=== Checking Agent Platform ===');
  const bytecode = await client.getBytecode({ address: AGENT_PLATFORM });
  console.log('Bytecode length:', bytecode ? bytecode.length : 0);
  console.log('Bytecode:', bytecode);

  const impl = await client.getStorageAt({
    address: AGENT_PLATFORM,
    slot: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
  });
  console.log('Implementation address slot value:', impl);

  const balance = await client.getBalance({ address: AGENT_PLATFORM });
  console.log('Agent Platform balance:', balance.toString(), 'STT');

  console.log('\n=== Simulating direct createRequest ===');
  try {
    await client.simulateContract({
      account,
      address: AGENT_PLATFORM,
      abi: AGENT_PLATFORM_ABI,
      functionName: 'createRequest',
      args: [1n, '0x' as `0x${string}`, account.address, '0x12345678' as `0x${string}`],
      value: parseEther('0.001'),
    });
    console.log('Direct simulation succeeded!');
  } catch (err: any) {
    console.error('Direct simulation failed:', err.message || err);
  }
}

main().catch(console.error);
