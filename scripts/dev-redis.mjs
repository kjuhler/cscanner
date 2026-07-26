/**
 * Start local Redis for demo analyze (Windows-friendly).
 * Prefers Docker when available; otherwise uses redis-server on PATH.
 */
import { spawn, spawnSync } from "node:child_process";
import { createConnection } from "node:net";

function canConnect(port = 6379, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    socket.setTimeout(800);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

function hasCommand(cmd) {
  const check = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(check, [cmd], { encoding: "utf8", shell: true });
  return result.status === 0;
}

async function main() {
  if (await canConnect()) {
    console.log("Redis already running on 127.0.0.1:6379");
    return;
  }

  if (hasCommand("docker")) {
    console.log("Starting Redis via docker compose…");
    const r = spawnSync("docker", ["compose", "up", "redis", "-d"], {
      stdio: "inherit",
      shell: true,
    });
    if (r.status === 0) {
      console.log("Redis started (docker).");
      return;
    }
    console.warn("docker compose failed — trying redis-server…");
  }

  if (!hasCommand("redis-server")) {
    console.error(`
Redis is not available.

Install one of:
  • Docker Desktop, then:  pnpm run dev:redis
  • Windows Redis:         winget install taizod1024.redis-windows-fork

Then re-run: pnpm run dev:redis
`);
    process.exit(1);
  }

  console.log("Starting redis-server in the background…");
  const child = spawn("redis-server", [], {
    detached: true,
    stdio: "ignore",
    shell: true,
    windowsHide: true,
  });
  child.unref();

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await canConnect()) {
      console.log("Redis started on 127.0.0.1:6379");
      return;
    }
  }

  console.error("redis-server started but port 6379 never became ready.");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
