export const REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_FOLLOWER_REGISTRY_ADDRESS ?? '') as `0x${string}`;

export const REGISTRY_ABI = [
  {
    inputs: [{ name: 'virtualUsdc', type: 'uint256' }],
    name: 'createVault',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'leader', type: 'address' }],
    name: 'follow',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'leader', type: 'address' }],
    name: 'unfollow',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getVault',
    outputs: [
      { name: 'virtualUsdc',     type: 'uint256' },
      { name: 'startingCapital', type: 'uint256' },
      { name: 'exists',          type: 'bool'    },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getFollowing',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'leader', type: 'address' }],
    name: 'getFollowers',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'follower', type: 'address' },
      { name: 'leader',   type: 'address' },
    ],
    name: 'isFollowing',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Somnia testnet chain (50312) for contract calls
export const SOMNIA_TESTNET_ID = 50312;
