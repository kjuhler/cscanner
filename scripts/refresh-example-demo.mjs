/**
 * Refresh the bundled example demo JSON after analysis schema changes.
 *
 * Usage:
 *   pnpm refresh:example-demo
 *   pnpm refresh:example-demo -- --from-dem public/demo/furia-vs-falcons-m3-inferno.dem
 */
import * as esbuild from "esbuild";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, ".data", "refresh-example-demo.cjs");
const entry = join(root, "scripts", "refresh-example-demo-entry.ts");

function resolveAtImport(subpath) {
  const base = join(root, "src", subpath);
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
    join(base, "index.js"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return `${base}.ts`;
}

mkdirSync(join(root, ".data"), { recursive: true });

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: outFile,
  alias: {
    "server-only": join(root, "stubs/server-only.cjs"),
  },
  external: ["@laihoe/demoparser2", "@laihoe/demoparser2-*"],
  plugins: [
    {
      name: "at-alias",
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) => ({
          path: resolveAtImport(args.path.slice(2)),
        }));
      },
    },
  ],
});

const result = spawnSync(process.execPath, [outFile, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: root,
});

process.exit(result.status ?? 1);
