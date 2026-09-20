// Resolves the "@/…" path alias for node --test (Node strips the types itself).
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./alias-hook.mjs", pathToFileURL("./tests/"));
