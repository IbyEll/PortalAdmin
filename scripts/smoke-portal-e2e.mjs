#!/usr/bin/env node
/**
 * Smoke ADMIN-145 — spawn dashboard + E2E testScript admin/test-portal-smoke.mjs.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import { getProductRepoPath } from "../lib/portal.paths.resolver.mjs";

const ROOT     = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT     = Number(process.env.DASHBOARD_PORT ?? 3999);
const BASE     = `http://127.0.0.1:${PORT}`;
const TEST_REL = join("testScript", "admin", "test-portal-smoke.mjs");

/** @type {import("node:child_process").ChildProcess | null} */
let server = null;

/**
 * @returns {Promise<boolean>}
 */
async function isDashboardUp() {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const product = getProductRepoPath();
  const testAbs = join(product, "testScript", "admin", "test-portal-smoke.mjs");

  const spawned = !(await isDashboardUp());

  if (spawned) {
    server = spawn(process.execPath, ["server/dashboard-server.mjs"], {
      cwd   : ROOT
    , env   : { ...process.env, DASHBOARD_PORT: String(PORT), PRODUCT_REPO_PATH: product }
    , stdio : ["ignore", "pipe", "pipe"]
    });

    await delay(2800);
  }

  if (existsSync(testAbs)) {
    const child = spawn(process.execPath, [testAbs], {
      cwd   : product
    , env   : {
        ...process.env
      , DASHBOARD_URL     : BASE
      , PORTAL_ADMIN_PATH : ROOT
      , PRODUCT_REPO_PATH : product
      }
    , stdio : "inherit"
    });

    const code = await new Promise((resolve) => child.on("close", resolve));

    if (code !== 0) {
      process.exit(code ?? 1);
    }
  } else {
    console.warn(`WARN: ${TEST_REL} assente nel product repo — fallback HTTP inline`);

    for (const path of ["/", "/backlog.html", "/api/dev/services", "/api/scripts"]) {
      const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(8000) });

      if (!res.ok) {
        throw new Error(`${path} HTTP ${res.status}`);
      }
    }
  }

  console.log(`OK smoke portal e2e ${BASE}`);
}

main()
  .catch((err) => {
    console.error("FAIL smoke portal e2e:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    if (server && !server.killed) {
      server.kill("SIGTERM");
    }
  });
