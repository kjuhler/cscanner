declare module "globaloffensive" {
  import type { EventEmitter } from "node:events";
  import type SteamUser from "steam-user";

  export default class GlobalOffensive extends EventEmitter {
    constructor(steamUser: SteamUser);
    readonly haveGCSession: boolean;
    requestGame(
      shareCodeOrDetails:
        | string
        | { matchId: string | number; outcomeId: string | number; token: number },
    ): void;
    requestLiveGames(): void;
    requestRecentGames(steamid: string | object): void;
    requestLiveGameForUser(steamid: string | object): void;
  }
}
