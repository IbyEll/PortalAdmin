/**
 * Helper verso testScript/ nel product repo (JustLastOne).
 */

import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { getTestScriptDir } from "./portal-paths.mjs";

/**
 * @param {string} rel e.g. lib/http.mjs
 * @returns {string}
 */
export function testScriptImportUrl(rel) {
  return pathToFileURL(join(getTestScriptDir(), rel)).href;
}

/**
 * @param {string} url
 */
export function stripTrailingSlash(url) {
  return url.replace(/\/$/, "");
}

/** @see testScript/lib/http.mjs */
export const WINDOWS_UV_CRASH_EXIT = 3221226505;

/**
 * @param {string} rel
 */
export async function importTestScriptModule(rel) {
  return import(testScriptImportUrl(rel));
}
