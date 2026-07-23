import { analyzeSteamSnapshot } from "@/lib/report/analyze";
import {
  buildGameMetadataProfile,
  metadataGameLimit,
} from "@/lib/report/game-metadata";

import { SteamApiClient } from "./client";
import { getSteamSnapshot } from "./get-snapshot";
import { SteamStoreMetadataClient } from "./store-metadata";

interface GetSteamReportOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export async function getSteamReport(
  steamIdInput: string,
  {
    apiKey = process.env.STEAM_WEB_API_KEY ?? "",
    fetchImpl,
  }: GetSteamReportOptions = {},
) {
  const snapshot = await getSteamSnapshot(steamIdInput, {
    gateway: new SteamApiClient({ apiKey, fetchImpl }),
  });

  const report = analyzeSteamSnapshot(snapshot);
  const selectedGames = report.playedGames.slice(0, metadataGameLimit);
  const metadata = await new SteamStoreMetadataClient({
    fetchImpl,
  }).getGameMetadata(selectedGames);

  return {
    ...report,
    gameMetadata: buildGameMetadataProfile(selectedGames, metadata),
  };
}
