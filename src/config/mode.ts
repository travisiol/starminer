/**
 * The game runs onchain only. The demo mode is gone; these flags remain so the few
 * components written with a `demo` branch keep compiling with that branch dead.
 */
export type AppMode = "live";
export const APP_MODE: AppMode = "live";
export const isDemo = false as const;
export const isLive = true as const;
/** No time compression: missions last what the config says. */
export const DEMO_TIME_SCALE = 1;
