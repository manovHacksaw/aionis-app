import { createPublicClient, http, keccak256, encodePacked } from 'viem';
import { somniaTestnet, VAULT_MANAGER_ADDRESS } from './config.js';
import 'dotenv/config';
const VAULT_MANAGER_ABI = [
    {
        inputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
        name: 'vaults',
        outputs: [
            { internalType: 'address', name: 'follower', type: 'address' },
            { internalType: 'address', name: 'leader', type: 'address' },
            { internalType: 'uint256', name: 'ausdLocked', type: 'uint256' },
            { internalType: 'uint256', name: 'ausdAllocated', type: 'uint256' },
            { internalType: 'uint8', name: 'riskLevel', type: 'uint8' },
            { internalType: 'uint8', name: 'maxPerTradePct', type: 'uint8' },
            { internalType: 'enum VaultManager.VaultStatus', name: 'status', type: 'uint8' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'address', name: '', type: 'address' }],
        name: 'keeperOf',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
        name: 'pipelineActive',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
    },
];
const follower = '0xfd3495db0fdb7b60fc7915768488d2bafe5aa383';
const leader = '0xc3ef32972c265a82efef46097dff1289cbdee72e';
const client = createPublicClient({
    chain: somniaTestnet,
    transport: http('https://dream-rpc.somnia.network/'),
});
function computeVaultId(f, l) {
    return keccak256(encodePacked(['address', 'address'], [f, l]));
}
async function main() {
    const vaultId = computeVaultId(follower, leader);
    const data = await client.readContract({
        address: VAULT_MANAGER_ADDRESS,
        abi: VAULT_MANAGER_ABI,
        functionName: 'vaults',
        args: [vaultId],
    });
    console.log('Vault ID:', vaultId);
    console.log('Contract Vault Configuration:');
    console.log('  Follower:', data[0]);
    console.log('  Leader:', data[1]);
    console.log('  ausdLocked:', data[2].toString());
    console.log('  ausdAllocated:', data[3].toString());
    console.log('  riskLevel:', data[4]);
    console.log('  maxPerTradePct:', data[5]);
    console.log('  status:', ['ACTIVE', 'PAUSED', 'CLOSED'][data[6]]);
    const keeper = await client.readContract({
        address: VAULT_MANAGER_ADDRESS,
        abi: VAULT_MANAGER_ABI,
        functionName: 'keeperOf',
        args: [follower],
    });
    console.log('  KeeperOf:', keeper);
    const active = await client.readContract({
        address: VAULT_MANAGER_ADDRESS,
        abi: VAULT_MANAGER_ABI,
        functionName: 'pipelineActive',
        args: [vaultId],
    });
    console.log('  PipelineActive:', active);
    const keeperBalance = await client.getBalance({ address: keeper });
    console.log('  Keeper Balance:', keeperBalance.toString(), 'STT');
    const followerBalance = await client.getBalance({ address: follower });
    console.log('  Follower Balance:', followerBalance.toString(), 'STT');
    const managerBalance = await client.getBalance({ address: VAULT_MANAGER_ADDRESS });
    console.log('  VaultManager Balance:', managerBalance.toString(), 'STT');
}
main().catch(console.error);
