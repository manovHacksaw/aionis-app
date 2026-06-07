'use client';

import * as React from 'react';

interface TraderAvatarProps {
  address: string;
  size?: number;
  className?: string;
}

export default function TraderAvatar({ address, size = 32, className = '' }: TraderAvatarProps) {
  // Normalize address
  const seed = address.toLowerCase();

  // ── PRNG Seed Initialization ──────────────────────────────────────────────
  const randseed = new Array(4).fill(0);
  for (let i = 0; i < seed.length; i++) {
    randseed[i % 4] = ((randseed[i % 4] << 5) - randseed[i % 4]) + seed.charCodeAt(i);
  }

  // ── PRNG Random Generator ──────────────────────────────────────────────────
  function rand() {
    const t = randseed[0] ^ (randseed[0] << 11);
    randseed[0] = randseed[1];
    randseed[1] = randseed[2];
    randseed[2] = randseed[3];
    randseed[3] = randseed[3] ^ (randseed[3] >> 19) ^ (t ^ (t >> 8));
    return (randseed[3] >>> 0) / ((1 << 31) >>> 0);
  }

  // ── HSL Color Generator ────────────────────────────────────────────────────
  function createColor() {
    const h = Math.floor(rand() * 360);
    const s = Math.floor(rand() * 60) + 40; // 40% - 100%
    const l = Math.floor(rand() * 40) + 20; // 20% - 60%
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  // Generate colors in standard blockies sequence: primary, spot, background
  const primaryColor = createColor();
  const spotColor = createColor();
  const bgColor = createColor();

  // ── 8x8 Grid Generator ─────────────────────────────────────────────────────
  // Standard blockies grid is 8x8, horizontally symmetric
  const grid: number[] = [];
  for (let row = 0; row < 8; row++) {
    const rowData: number[] = [];
    for (let col = 0; col < 4; col++) {
      // 0 = bg, 1 = primary, 2 = spot
      rowData.push(Math.floor(rand() * 2.3));
    }
    // Mirror the first 4 columns to create the full 8-column row
    const symmetricRow = [...rowData, ...[...rowData].reverse()];
    grid.push(...symmetricRow);
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      className={`rounded-lg overflow-hidden flex-shrink-0 shadow-inner ${className}`}
      style={{ minWidth: size, minHeight: size }}
    >
      {/* Background fill */}
      <rect width="8" height="8" fill={bgColor} />
      
      {/* Draw pixel grid */}
      {grid.map((val, idx) => {
        if (val === 0) return null; // 0 is background, already drawn
        const row = Math.floor(idx / 8);
        const col = idx % 8;
        const color = val === 1 ? primaryColor : spotColor;
        return (
          <rect
            key={idx}
            x={col}
            y={row}
            width="1"
            height="1"
            fill={color}
          />
        );
      })}
    </svg>
  );
}
