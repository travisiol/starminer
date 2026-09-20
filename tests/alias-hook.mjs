// Node ESM resolver for the app's TypeScript: "@/…" maps to src/, and extensionless
// relative imports ("./client") get their .ts/.tsx extension.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve("src");

const withExtension = (base) => {
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) if (existsSync(candidate)) return candidate;
  return null;
};

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const hit = withExtension(path.join(root, specifier.slice(2)));
    if (hit) return next(pathToFileURL(hit).href, context);
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !path.extname(specifier) && context.parentURL?.startsWith("file:")) {
    const hit = withExtension(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (hit) return next(pathToFileURL(hit).href, context);
  }
  return next(specifier, context);
}
