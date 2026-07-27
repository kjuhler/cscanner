/**
 * One-time helper: log into Steam and print a refresh token for STEAM_REFRESH_TOKEN.
 *
 * Usage:
 *   pnpm exec node scripts/steam-refresh-token.mjs
 *
 * Prefer a dedicated bot account. Do not commit the token.
 */
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import SteamUser from "steam-user";

const rl = createInterface({ input, output });

const accountName = (await rl.question("Steam account name: ")).trim();
const password = (await rl.question("Password: ")).trim();

if (!accountName || !password) {
  console.error("Account name and password are required.");
  process.exit(1);
}

const user = new SteamUser();

user.on("steamGuard", async (domain, callback, lastCodeWrong) => {
  const hint = domain ? ` (email ${domain})` : " (mobile authenticator)";
  if (lastCodeWrong) console.warn("Previous code was wrong.");
  const code = (await rl.question(`Steam Guard code${hint}: `)).trim();
  callback(code);
});

user.on("refreshToken", (token) => {
  console.log("\nSTEAM_REFRESH_TOKEN (save to worker env only):\n");
  console.log(token);
  console.log("");
});

user.on("loggedOn", () => {
  console.log("Logged on. Waiting for refresh token…");
});

user.on("error", (err) => {
  console.error("Steam error:", err.message);
  process.exit(1);
});

user.logOn({ accountName, password });

// Keep process alive until token arrives, then exit.
user.once("refreshToken", () => {
  setTimeout(() => {
    try {
      user.logOff();
    } catch {
      // ignore
    }
    rl.close();
    process.exit(0);
  }, 500);
});
