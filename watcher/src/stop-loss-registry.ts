// In-process registry of position IDs where a stop-loss close was triggered.
// pnl-updater registers an ID before calling the keeper; vault-listener checks
// it when processing the resulting PositionClosed event.

const pending = new Set<string>();

export function markStopLoss(onChainPositionId: string): void {
  pending.add(onChainPositionId.toLowerCase());
}

/** Returns true and removes the entry if this position was a stop-loss close. */
export function consumeStopLoss(onChainPositionId: string): boolean {
  const id = onChainPositionId.toLowerCase();
  if (pending.has(id)) {
    pending.delete(id);
    return true;
  }
  return false;
}
