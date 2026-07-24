const steamStaticAssetOrigin = "https://cdn.cloudflare.steamstatic.com";

/**
 * A public, cacheable Steam header-art candidate for a known AppID. Individual
 * Store responses can later override this with their canonical header image.
 */
export function getSteamGameHeaderImageUrl(appId: number) {
  return new URL(
    `/steam/apps/${appId}/header.jpg`,
    steamStaticAssetOrigin,
  ).toString();
}
