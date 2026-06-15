/**
 * HTTP/url helper per PortalAdmin — sostituisce import da testScript/lib/http.mjs (ADMIN-97).
 */

/**
 * @param {string} url
 */
export function stripTrailingSlash(url) {
  return url.replace(/\/$/, "");
}

/** Exit code Node su Windows quando fetch/Prisma chiudono handle dopo process.exit(). */
export const WINDOWS_UV_CRASH_EXIT = 3221226505;
