import { z } from "zod";

const steamId64Schema = z.string().regex(/^\d{17}$/u);

export const steamLookupRequestSchema = z
  .object({
    steamIdInput: z.string().trim().min(1).max(256),
  })
  .strict();

export const steamPlayerSchema = z
  .object({
    steamid: steamId64Schema,
    communityvisibilitystate: z.number().int().optional(),
    personaname: z.string().min(1),
    profileurl: z.string().url(),
    avatarfull: z.string().url().optional(),
    timecreated: z.number().int().nonnegative().optional(),
    lastlogoff: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const playerSummariesResponseSchema = z
  .object({
    response: z
      .object({
        players: z.array(steamPlayerSchema),
      })
      .passthrough(),
  })
  .passthrough();

export const steamOwnedGameSchema = z
  .object({
    appid: z.number().int().nonnegative(),
    name: z.string().min(1),
    playtime_forever: z.number().int().nonnegative(),
    img_icon_url: z.string().nullable().optional(),
    rtime_last_played: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const ownedGamesResponseSchema = z
  .object({
    response: z
      .object({
        game_count: z.number().int().nonnegative().optional(),
        games: z.array(z.unknown()).optional(),
      })
      .passthrough(),
  })
  .passthrough();

export const resolveVanityResponseSchema = z
  .object({
    response: z
      .object({
        success: z.number().int(),
        steamid: steamId64Schema.optional(),
        message: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type SteamPlayerPayload = z.infer<typeof steamPlayerSchema>;
export type OwnedGamesPayload = z.infer<typeof ownedGamesResponseSchema>;
export type SteamOwnedGamePayload = z.infer<typeof steamOwnedGameSchema>;
