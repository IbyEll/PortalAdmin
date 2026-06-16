# Inventario import `testScript/lib` in PortalAdmin

Analisi ADMIN-133 — gap G1 (ADMIN-97).

## Stato pre-migrazione (legacy Admin/ in monorepo)

| File PortalAdmin | Import legacy | Simboli |
| --- | --- | --- |
| `lib/prereqs.mjs` | `../../testScript/lib/http.mjs` | `stripTrailingSlash` |
| `server/health.mjs` | `../../testScript/lib/http.mjs` | `stripTrailingSlash` |
| `runner/JustLastOne___run-all.mjs` | `../../testScript/lib/http.mjs` | `WINDOWS_UV_CRASH_EXIT` |
| `runner/JustLastOne___run-all.mjs` | `../../testScript/lib/JustLastOne___match-fixtures.mjs` | `resetHostTestState`, `setupDefaultDatabaseUrl` |

## Stato intermedio (ADMIN-92)

| File | Modulo | Note |
| --- | --- | --- |
| `lib/prereqs.mjs` | `lib/test-script-http.mjs` | wrapper verso product repo |
| `server/health.mjs` | `lib/test-script-http.mjs` | idem |
| `runner/JustLastOne___run-all.mjs` | `lib/test-script-http.mjs` | `importTestScriptModule("lib/JustLastOne___match-fixtures.mjs")` runtime |

## Target post ADMIN-97

| File | Modulo PortalAdmin |
| --- | --- |
| `lib/prereqs.mjs` | `lib/http-utils.mjs` |
| `server/health.mjs` | `lib/http-utils.mjs` |
| `runner/JustLastOne___run-all.mjs` | `lib/http-utils.mjs`, `lib/JustLastOne___match-fixtures.mjs` |

## Altri file `testScript/lib` nel product repo (non importati da PortalAdmin)

- `testScript/lib/http.mjs` — helper test (request, login, emitJsonReport, …)
- `testScript/lib/JustLastOne___match-fixtures.mjs` — fixture match per test script
- `testScript/lib/matches-list.mjs` — parser lista match
- `testScript/lib/portal-admin-path.mjs` — path Admin (product side)

## Verifica

```bash
rg "testScript/lib" --glob "*.mjs" lib/ server/ runner/ scripts/
```

Atteso: zero match nei moduli runtime PortalAdmin (solo questo doc e HTML statici).
