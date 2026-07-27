import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { analyzeDemo } from "@/lib/demo/analyze";
import { reanalyzeFromStored } from "@/lib/demo/reanalyze";
import {
  EXAMPLE_DEMO_JSON_FILENAME,
  EXAMPLE_DEMO_RUN_ID,
  exampleDemoJsonPath,
} from "@/lib/demo/exampleDemo";
import { normalizeAnalysis } from "@/lib/demo/validateAnalysis";
import type { DemoAnalysis } from "@/lib/demo/types";

const DEFAULT_DEM = join(
  process.cwd(),
  "public",
  "demo",
  "furia-vs-falcons-m3-inferno.dem",
);

type RunRecord = {
  runId: string;
  createdAt: number;
  expiresAt: number;
  source: { type: "example" };
  analysis: DemoAnalysis;
};

function parseArgs(argv: string[]): {
  fromDem: string | null;
  outPath: string;
} {
  let fromDem: string | null = null;
  let outPath = exampleDemoJsonPath();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--from-dem") {
      const next = argv[i + 1];
      if (!next) throw new Error("--from-dem requires a path.");
      fromDem = next;
      i += 1;
    } else if (arg === "--out") {
      const next = argv[i + 1];
      if (!next) throw new Error("--out requires a path.");
      outPath = next;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node refresh-example-demo.cjs [--from-dem <path>] [--out <path>]

Modes:
  (default)     Re-read bundled JSON, normalize, rebuild highlights from replay
  --from-dem    Full parse from a local .dem (slow; needs demoparser)

Output defaults to public/demo/${EXAMPLE_DEMO_JSON_FILENAME}
`);
      process.exit(0);
    }
  }

  return { fromDem, outPath };
}

function extractAnalysis(raw: unknown): DemoAnalysis {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid example JSON: expected object.");
  }
  const d = raw as Record<string, unknown>;
  const candidate = d.analysis ?? raw;
  return normalizeAnalysis(candidate as DemoAnalysis);
}

async function refreshFromJson(outPath: string): Promise<void> {
  const raw = JSON.parse(await readFile(outPath, "utf8")) as Partial<RunRecord>;
  const analysis = reanalyzeFromStored(extractAnalysis(raw));

  const record: RunRecord = {
    runId: raw.runId ?? EXAMPLE_DEMO_RUN_ID,
    createdAt: raw.createdAt ?? Date.now(),
    expiresAt: raw.expiresAt ?? Date.now() + 365 * 24 * 60 * 60 * 1000,
    source: { type: "example" },
    analysis,
  };

  await writeFile(outPath, JSON.stringify(record, null, 2), "utf8");
  console.log(
    `Updated ${outPath}\n  highlights: ${record.analysis.highlights.length}\n  mistakes: ${record.analysis.mistakes.length}\n  rounds: ${record.analysis.match.rounds}`,
  );
}

async function buildFromDem(demPath: string, outPath: string): Promise<void> {
  try {
    await access(demPath);
  } catch {
    throw new Error(
      `Demo not found: ${demPath}\nPlace the .dem under public/demo/ or pass --from-dem <path>.`,
    );
  }

  console.log(`Analyzing ${demPath} (this can take several minutes)…`);
  const analysis = analyzeDemo(demPath, (stage, detail, pct) => {
    process.stdout.write(`\r[${stage}] ${detail} (${pct}%)   `);
  });
  process.stdout.write("\n");

  const record: RunRecord = {
    runId: EXAMPLE_DEMO_RUN_ID,
    createdAt: Date.now(),
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
    source: { type: "example" },
    analysis: reanalyzeFromStored(normalizeAnalysis(analysis)),
  };

  await writeFile(outPath, JSON.stringify(record, null, 2), "utf8");
  console.log(
    `Wrote ${outPath}\n  highlights: ${record.analysis.highlights.length}\n  size: ${(JSON.stringify(record).length / 1024 / 1024).toFixed(1)} MB`,
  );
}

async function main() {
  const { fromDem, outPath } = parseArgs(process.argv.slice(2));
  if (fromDem) {
    await buildFromDem(fromDem === "default" ? DEFAULT_DEM : fromDem, outPath);
  } else {
    await refreshFromJson(outPath);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
