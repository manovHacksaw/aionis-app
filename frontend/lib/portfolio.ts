export type Position = {
  id:             string;
  token:          string;
  tokenAddress:   string;
  ausdcAllocated: number;
  entryPrice:     number;
  currentPrice:   number;
  unrealizedPnl:  number;
  status:         string;
  openedAt:       string;
  leader:         string;
};

export type Agent = {
  id:            string;
  leader:        string;
  ausdcLocked:   number;
  riskLevel:     number;
  status:        string;
  unrealizedPnl: number;
  positions:     Position[];
};

export type Summary = { totalLocked: number; totalPnl: number; activeCount: number };

export type AgentBreakdown = { leader: string; allocated: number; pnl: number; positionCount: number };

export type Holding = {
  token:            string;
  tokenAddress:     string;
  totalAllocated:   number;
  totalValue:       number;
  weightedAvgEntry: number;
  currentPrice:     number;
  pnlUsd:           number;
  pnlPct:           number;
  byAgent:          AgentBreakdown[];
};

export const fmt = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

export function aggregateHoldings(agents: Agent[]): Holding[] {
  const byToken = new Map<string, Position[]>();
  for (const agent of agents) {
    for (const pos of agent.positions) {
      if (!byToken.has(pos.token)) byToken.set(pos.token, []);
      byToken.get(pos.token)!.push(pos);
    }
  }

  return Array.from(byToken.entries()).map(([token, positions]) => {
    const totalAllocated = positions.reduce((sum, p) => sum + p.ausdcAllocated, 0);
    const weightedAvgEntry = totalAllocated > 0
      ? positions.reduce((sum, p) => sum + p.ausdcAllocated * p.entryPrice, 0) / totalAllocated
      : 0;
    const currentPrice = positions[0]?.currentPrice ?? 0;
    const pnlUsd = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    const pnlPct = totalAllocated > 0 ? (pnlUsd / totalAllocated) * 100 : 0;

    const byLeader = new Map<string, Position[]>();
    for (const p of positions) {
      if (!byLeader.has(p.leader)) byLeader.set(p.leader, []);
      byLeader.get(p.leader)!.push(p);
    }
    const byAgent: AgentBreakdown[] = Array.from(byLeader.entries())
      .map(([leader, ps]) => ({
        leader,
        allocated:     ps.reduce((sum, p) => sum + p.ausdcAllocated, 0),
        pnl:           ps.reduce((sum, p) => sum + p.unrealizedPnl, 0),
        positionCount: ps.length,
      }))
      .sort((a, b) => b.allocated - a.allocated);

    return {
      token,
      tokenAddress: positions[0]?.tokenAddress ?? '',
      totalAllocated,
      totalValue: totalAllocated + pnlUsd,
      weightedAvgEntry,
      currentPrice,
      pnlUsd,
      pnlPct,
      byAgent,
    };
  }).sort((a, b) => b.totalValue - a.totalValue);
}
