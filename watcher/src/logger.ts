import { pushLog } from './log-stream.js';

const ts = () => new Date().toISOString();

export function log(tag: string, msg: string): void {
  console.log(`${ts()} [${tag}] ${msg}`);
  pushLog('info', tag, msg).catch(() => {});
}

export function warn(tag: string, msg: string): void {
  console.warn(`${ts()} [${tag}] WARN  ${msg}`);
  pushLog('warn', tag, msg).catch(() => {});
}

export function error(tag: string, msg: string, e?: unknown): void {
  console.error(`${ts()} [${tag}] ERROR ${msg}`);
  let detail: string | undefined;
  if (e != null) {
    const err = e as any;
    detail = err.shortMessage ?? err.details ?? err.message ?? String(e);
    if (detail && detail !== msg) console.error(`         └─ ${detail}`);
    if (err.cause?.message && err.cause.message !== detail)
      console.error(`         └─ cause: ${err.cause.message}`);
  }
  pushLog('error', tag, detail && detail !== msg ? `${msg} — ${detail}` : msg).catch(() => {});
}
