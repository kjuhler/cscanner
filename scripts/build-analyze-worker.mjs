import * as esbuild from "esbuild";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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

await esbuild.build({
  entryPoints: [join(root, "src/lib/demo/workerEntry.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: join(root, "analyze-worker.cjs"),
  alias: {
    "server-only": join(root, "stubs/server-only.cjs"),
  },
  // Keep native demoparser external; BullMQ/ioredis are bundled into the worker.
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

console.log("Wrote analyze-worker.cjs");
