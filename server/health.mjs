import { stripTrailingSlash } from "../lib/test-script-http.mjs";

/**
 * @param {string} url
 */
async function probe(url) {
  const started = Date.now();

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const up  = res.ok || res.status < 500;

    return {
      up
    , latencyMs: Date.now() - started
    };
  } catch {
    return {
      up        : false
    , latencyMs : null
    };
  }
}

/**
 * @returns {Promise<{
 *   checkedAt: string
 *   auth: { up: boolean, url: string, latencyMs: number | null }
 *   api: { up: boolean, url: string, latencyMs: number | null }
 *   web: { up: boolean, url: string, latencyMs: number | null }
 * }>}
 */
export async function getHealthStatus() {
  const authUrl = stripTrailingSlash(process.env.AUTH_URL ?? "http://localhost:4001/api/v1");
  const apiUrl  = stripTrailingSlash(process.env.API_URL ?? "http://localhost:4000/api/v1");
  const webUrl  = stripTrailingSlash(process.env.WEB_BASE ?? "http://localhost:3000");

  const [auth, api, web] = await Promise.all([
    probe(`${authUrl}/health`)
  , probe(`${apiUrl}/health`)
  , probe(webUrl)
  ]);

  return {
    checkedAt: new Date().toISOString()
  , auth: { ...auth, url: authUrl }
  , api : { ...api, url: apiUrl }
  , web : { ...web, url: webUrl }
  };
}
