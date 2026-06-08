import { createPublicClient, http, parseEther } from 'viem';
import { somniaTestnet, VAULT_MANAGER_ADDRESS, KEEPER_PRIVATE_KEY } from './config.js';
import { privateKeyToAccount } from 'viem/accounts';
import 'dotenv/config';
const VAULT_MANAGER_ABI = [
    {
        inputs: [
            { internalType: 'address', name: 'follower', type: 'address' },
            { internalType: 'address', name: 'leader', type: 'address' },
        ],
        name: 'checkLeaderActivity',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
];
const follower = '0xfd3495db0fdb7b60fc7915768488d2bafe5aa383';
const leader = '0xc3ef32972c265a82efef46097dff1289cbdee72e';
const AGENT_FEE = parseEther('0.001');
const account = privateKeyToAccount(KEEPER_PRIVATE_KEY);
const client = createPublicClient({
    chain: somniaTestnet,
    transport: http('https://dream-rpc.somnia.network/'),
});
async function main() {
    try {
        await client.simulateContract({
            account,
            address: VAULT_MANAGER_ADDRESS,
            abi: VAULT_MANAGER_ABI,
            functionName: 'checkLeaderActivity',
            args: [follower, leader],
            value: AGENT_FEE,
        });
        console.log('Simulation succeeded! The transaction would not revert.');
    }
    catch (err) {
        console.error('Simulation failed with error:');
        console.error(err.message || err);
    }
}
main().catch(console.error);
