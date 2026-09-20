/** Ids for owned hulls and missions. Never Math.random: the CSPRNG when present, a counter otherwise. */
let counter = 0;

export function newId(prefix: string): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return `${prefix}_${c.randomUUID().slice(0, 8)}`;
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}
