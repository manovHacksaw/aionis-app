import { createPublicClient, http } from 'viem';
import { somniaMainnet } from './config.js';
import 'dotenv/config';

const txHash = '0x0c2e452e731133ce2d336ba624ec3700f1d7c34dd98c036fd121ef0cc309b781';

const client = createPublicClient({
  chain: somniaMainnet,
  transport: http('https://api.infra.mainnet.somnia.network/'),
});

async function main() {
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  console.log('Transaction Sender (from):', receipt.from);
  console.log('Transaction Receiver (to):', receipt.to);
  console.log('Event Logs count:', receipt.logs.length);

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    console.log(`\nLog #${i} from ${log.address}`);
    console.log('  Topics:', log.topics);
  }
}

main().catch(console.error);
