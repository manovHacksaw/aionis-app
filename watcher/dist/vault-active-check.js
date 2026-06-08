import { createPublicClient, http, keccak256, encodePacked } from 'viem';
import { somniaTestnet, VAULT_MANAGER_ADDRESS } from './config.js';
import 'dotenv/config';
const VAULT_MANAGER_ABI = [
    {
        inputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
        name: 'pipelineActive',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
    },
];
const follower = '0xfd3495db0fdb7b60fc7915768488d2bafe5aa383';
const leader = '0x6daf055c99883d920849d7022f2efabb13e2af57';
const client = createPublicClient({
    chain: somniaTestnet,
    transport: http('https://dream-rpc.somnia.network/'),
});
function computeVaultId(f, l) {
    return keccak256(encodePacked(['address', 'address'], [f, l]));
}
async function main() {
    const vaultId = computeVaultId(follower, leader);
    const active = await client.readContract({
        address: VAULT_MANAGER_ADDRESS,
        abi: VAULT_MANAGER_ABI,
        functionName: 'pipelineActive',
        args: [vaultId],
    });
    console.log('Vault ID:', vaultId);
    console.log('Is pipeline currently active (locked)?', active);
}
main().catch(console.error);
