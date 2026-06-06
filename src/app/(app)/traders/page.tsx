// src/app/(app)/traders/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

const MOCK_TRADERS = [
  { address: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B", roi: 42.3, winRate: 68, trades: 134, volume: 28400 },
  { address: "0x1Db3439a222C519ab44bb1144fC28167b4Fa6EE6", roi: -8.1, winRate: 44, trades: 89, volume: 12100 },
  { address: "0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c", roi: 91.7, winRate: 74, trades: 201, volume: 67300 },
  { address: "0x14723A09ACff6D2A60DcdF7aA4AFf308FDDC160C", roi: 19.2, winRate: 61, trades: 57, volume: 9800 },
];

export default function TradersPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'roi' | 'winRate' | 'trades' | 'volume'>('roi');

  // Filter and Sort traders
  const filteredTraders = MOCK_TRADERS.filter(t =>
    t.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedTraders = [...filteredTraders].sort((a, b) => {
    return b[sortBy] - a[sortBy];
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-black text-white px-6 md:px-16 py-12 max-w-6xl mx-auto w-full select-none">
      {/* Top Header Section */}
      <div className="mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-white mb-3">
            Traders
          </h1>
          <p className="text-white/40 text-sm max-w-md">
            Discover top-performing traders, track their stats, and copy their trades automatically.
          </p>
        </div>

        {/* Controls: Search and Sort */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-all duration-300 w-full sm:w-64 font-sans"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-all duration-300 w-full sm:w-auto cursor-pointer font-sans appearance-none pr-8 relative bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20opacity%3D%220.4%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:10px] bg-[right_16px_center] bg-no-repeat"
          >
            <option value="roi" className="bg-black text-white">Sort by ROI</option>
            <option value="winRate" className="bg-black text-white">Sort by Win Rate</option>
            <option value="trades" className="bg-black text-white">Sort by Trades</option>
            <option value="volume" className="bg-black text-white">Sort by Volume</option>
          </select>
        </div>
      </div>

      {/* Grid List */}
      {sortedTraders.length === 0 ? (
        <div className="py-20 text-center border border-white/[0.06] rounded-2xl bg-white/[0.01]">
          <p className="text-white/30 text-sm">No traders found matching search query.</p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {sortedTraders.map((trader) => (
            <motion.div
              key={trader.address}
              variants={itemVariants}
              whileHover={{ scale: 1.01, borderColor: "rgba(255, 255, 255, 0.2)" }}
              className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 flex flex-col justify-between transition-all duration-300"
            >
              <div>
                {/* Address Row */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 shadow-[0_0_12px_rgba(217,119,6,0.15)] flex-shrink-0" />
                  <span className="font-mono text-sm tracking-tight text-white/90">
                    {formatAddress(trader.address)}
                  </span>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">30d ROI</div>
                    <div className={`text-base font-medium ${trader.roi >= 0 ? 'text-[#d97706]' : 'text-[#ef4444]'}`}>
                      {trader.roi >= 0 ? '+' : ''}{trader.roi}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Win Rate</div>
                    <div className="text-base font-medium text-white">
                      {trader.winRate}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Trades</div>
                    <div className="text-base font-medium text-white">
                      {trader.trades}
                    </div>
                  </div>
                </div>

                {/* Volume Row */}
                <div className="flex justify-between items-center py-2.5 border-t border-white/[0.05] text-xs">
                  <span className="text-white/40">30d Copied Vol</span>
                  <span className="text-white font-medium font-mono">
                    ${trader.volume.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => router.push(`/vault/${trader.address}`)}
                className="w-full mt-5 bg-white hover:bg-neutral-200 text-black font-medium text-sm rounded-full py-2.5 transition-colors duration-200 cursor-pointer text-center"
              >
                Copy Trader
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
