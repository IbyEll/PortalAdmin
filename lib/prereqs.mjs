import { stripTrailingSlash } from "./http-utils.mjs";

/**
 * @param {string} url
 */
export async function isReachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

/**
 * @returns {Promise<{ auth: boolean, api: boolean, web: boolean, authUrl: string, apiUrl: string, webUrl: string }>}
 */
export async function checkServices() {
  const authUrl = stripTrailingSlash(process.env.AUTH_URL ?? "http://localhost:4001/api/v1");
  const apiUrl  = stripTrailingSlash(process.env.API_URL ?? "http://localhost:4000/api/v1");
  const webUrl  = stripTrailingSlash(process.env.WEB_BASE ?? "http://localhost:3000");

  const [auth, api, web] = await Promise.all([
    isReachable(`${authUrl}/health`)
  , isReachable(`${apiUrl}/health`)
  , isReachable(webUrl)
  ]);

  return { auth, api, web, authUrl, apiUrl, webUrl };
}
