import { join } from "node:path";

export const EXAMPLE_DEMO_JSON_FILENAME =
  "cscanner-de_inferno-7a296e3b8ffe4735a21bb30f.json";

/** Stable id embedded in the bundled example export filename. */
export const EXAMPLE_DEMO_RUN_ID = "7a296e3b8ffe4735a21bb30f";

export const EXAMPLE_DEMO_LABEL = "FURIA vs Falcons — Inferno (example)";

export const EXAMPLE_DEMO_PUBLIC_URL = `/demo/${EXAMPLE_DEMO_JSON_FILENAME}`;

export function exampleDemoJsonPath(): string {
  return join(process.cwd(), "public", "demo", EXAMPLE_DEMO_JSON_FILENAME);
}
