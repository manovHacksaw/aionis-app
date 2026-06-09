const ts = () => new Date().toISOString();

export function log(tag: string, msg: string): void {
  console.log(`${ts()} [${tag}] ${msg}`);
}

export function warn(tag: string, msg: string): void {
  console.warn(`${ts()} [${tag}] WARN  ${msg}`);
}

export function error(tag: string, msg: string, e?: unknown): void {
  console.error(`${ts()} [${tag}] ERROR ${msg}`);
  if (e != null) {
    const err = e as any;
    const detail = err.shortMessage ?? err.details ?? err.message ?? String(e);
    if (detail && detail !== msg) console.error(`         └─ ${detail}`);
    if (err.cause?.message && err.cause.message !== detail)
      console.error(`         └─ cause: ${err.cause.message}`);
  }
}
