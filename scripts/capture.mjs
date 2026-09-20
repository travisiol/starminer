// Headless Chrome captures of the site (WebGL through SwiftShader, no GPU needed).
// usage: node scripts/capture.mjs [baseUrl] [only]   → docs/captures/*.png
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const base = process.argv[2] ?? "http://localhost:3781";
const only = process.argv[3];
const chrome = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const out = path.resolve("docs/captures");
mkdirSync(out, { recursive: true });

const shots = [
  // The hero scene loads after hydration and compiles shaders in SwiftShader: give it a long virtual budget.
  { name: "home", url: "/", w: 1440, h: 900, budget: 40000 },
  { name: "home-full", url: "/", w: 1440, h: 5600, budget: 40000 },
  { name: "system", url: "/system", w: 1440, h: 900, budget: 20000 },
  { name: "hangar", url: "/hangar", w: 1440, h: 1400, budget: 20000 },
  { name: "market", url: "/market", w: 1440, h: 1800, budget: 14000 },
  { name: "fleet", url: "/fleet", w: 1440, h: 1500, budget: 14000 },
  { name: "missions", url: "/missions", w: 1440, h: 1000, budget: 12000 },
  { name: "leaderboard", url: "/leaderboard", w: 1440, h: 1300, budget: 12000 },
  { name: "economy", url: "/economy", w: 1440, h: 1500, budget: 12000 },
];

// Phones: Chrome refuses windows narrower than ~500 px, so 390 px iframes side by side.
const phoneRoutes = ["/", "/system", "/fleet", "/market"];
const harness = path.join(out, "mobile-harness.html");
writeFileSync(
  harness,
  `<!doctype html><body style="margin:0;background:#050607;display:flex;gap:16px;padding:16px">${phoneRoutes
    .map((r) => `<iframe src="${base}${r}" width="390" height="844" style="border:1px solid #1c2229;border-radius:24px;background:#050607"></iframe>`)
    .join("")}</body>`,
);
shots.push({ name: "mobile", url: null, file: harness, w: 1660, h: 880, budget: 24000 });

for (const s of shots) {
  if (only && s.name !== only) continue;
  const file = path.join(out, `${s.name}.png`);
  const args = [
    "--headless=new",
    "--no-first-run",
    `--user-data-dir=${path.join(process.env.TEMP ?? "/tmp", "starminer-shot")}`,
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--hide-scrollbars",
    `--window-size=${s.w},${s.h}`,
    `--virtual-time-budget=${s.budget}`,
    `--screenshot=${file}`,
    s.url === null ? pathToFileURL(s.file).href : `${base}${s.url}`,
  ];
  const r = spawnSync(chrome, args, { stdio: "ignore", timeout: 180_000 });
  console.log(r.status === 0 ? "ok  " : "fail", s.name, file);
}
