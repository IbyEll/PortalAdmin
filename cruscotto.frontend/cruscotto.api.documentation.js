/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** PAGE SCRIPT ** -- commentato il: 2026-06-18 20:15
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-17   by: IbyEll
 * modificato il: 2026-06-18 20:15   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              API Documentation — companion OpenAPI (card servizi product + indice path aggregato)
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - la pagina HTML è shell statica; caricamento config, fetch spec OpenAPI e tabella path vivono qui
 *   - evita framework build per navigazione API dev locale sul product repo attivo
 *
 *   A cosa serve:
 *   - legge GET /config.json, renderizza header e card servizi, aggrega endpoint da specUrl di ogni voce
 *   - ordina e mostra tabella metodo, path, tag e summary per tutti i servizi del manifest
 *
 * Generalizzazione:
 *   Si — servizi e label progetto da product.manifest (PRODUCT_REPO_PATH); non hardcoded su uno stack.
 *
 * Input:
 *   - GET /config.json — projectName, projectLabel, productRoot, services[] (specUrl, basePath, badge, …)
 *   - service.specUrl — documento OpenAPI per ogni servizio (fetch diretto dal browser)
 *
 * Pagina HTML:
 *   - cruscotto.frontend/cruscotto.api.documentation.index.html — companion (script href legacy ./portal.js)
 *
 * Servito da:
 *   - cruscotto.frontend/cruscotto.api.documentation.server.mjs — statiche e GET /config.json su :4080
 *   - cruscotto.frontend/cruscotto.process.start.api.documentation.mjs — spawn server API Documentation
 *
 * Asset correlati:
 *   - cruscotto.api.documentation.config.mjs — buildApiDocumentationConfig lato server per /config.json
 *
 * API (fetch same-origin o verso spec servizi):
 *   - GET  /config.json — manifest servizi OpenAPI del product repo attivo
 *   - GET  service.specUrl — documento OpenAPI per indice path (uno per servizio in config)
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

// --- costanti UI — ordine metodi HTTP nella tabella path ---
const METHOD_ORDER = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

/** @type {Array<Record<string, unknown>>} */
let SERVICES = [];

function methodClass(method) {
  return `method method-${method.toLowerCase()}`;
}

function fullPath(basePath, pathKey) {
  const base = basePath.replace(/\/$/, "");
  const path = pathKey.startsWith("/") ? pathKey : `/${pathKey}`;

  return `${base}${path}`;
}

/**
 * @param {Record<string, unknown>} service
 * @param {string} pathKey
 */
function displayPath(pathKey, service) {
  if (pathKey.startsWith("/")) {
    return pathKey;
  }

  return fullPath(String(service.basePath ?? ""), pathKey);
}

/**
 * @param {Record<string, unknown>} service
 */
async function fetchOpenApi(service) {
  const res = await fetch(String(service.specUrl));

  if (!res.ok) {
    throw new Error(`${service.name}: HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * @param {Record<string, unknown>} service
 * @param {Record<string, unknown>} spec
 */
function collectRows(service, spec) {
  /** @type {Array<Record<string, unknown>>} */
  const rows  = [];
  const paths = spec.paths ?? {};

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (method === "parameters") {
        continue;
      }

      if (!["get", "post", "put", "patch", "delete", "options", "head"].includes(method)) {
        continue;
      }

      if (!operation || typeof operation !== "object") {
        continue;
      }

      const verb = method.toUpperCase();
      rows.push({
        serviceId : service.id
      , service   : service.name
      , badge     : service.badge
      , badgeCls  : service.badgeCls
      , method    : verb
      , path      : displayPath(pathKey, service)
      , tags      : (operation?.tags ?? []).join(", ") || "—"
      , summary   : operation?.summary ?? operation?.description ?? "—"
      });
    }
  }

  return rows;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
function sortRows(rows) {
  return rows.sort((a, b) => {
    const orderA = SERVICES.findIndex((svc) => svc.id === a.serviceId);
    const orderB = SERVICES.findIndex((svc) => svc.id === b.serviceId);

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    if (a.path !== b.path) {
      return String(a.path).localeCompare(String(b.path));
    }

    return METHOD_ORDER.indexOf(String(a.method)) - METHOD_ORDER.indexOf(String(b.method));
  });
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
function renderPathsTable(rows) {
  const tbody = document.getElementById("paths-body");

  if (!tbody) {
    return;
  }

  tbody.innerHTML = "";

  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="badge ${row.badgeCls}">${row.badge}</span></td>
      <td><span class="${methodClass(String(row.method))}">${row.method}</span></td>
      <td><code>${row.path}</code></td>
      <td>${row.tags}</td>
      <td>${row.summary}</td>
    `;
    tbody.appendChild(tr);
  }
}

/**
 * @param {Record<string, unknown>} config
 */
function renderHeader(config) {
  const titleEl    = document.getElementById("portal-title");
  const subtitleEl = document.getElementById("portal-subtitle");
  const metaEl     = document.getElementById("portal-meta");

  if (titleEl) {
    titleEl.textContent = `API Documentation — ${config.projectLabel ?? config.projectName ?? "progetto"}`;
  }

  if (subtitleEl) {
    subtitleEl.textContent = "Navigazione centralizzata OpenAPI (config da PRODUCT_REPO_PATH)";
  }

  if (metaEl) {
    metaEl.textContent = `Progetto: ${config.projectName ?? "—"} · ${config.productRoot ?? ""}`;
  }

  document.title = `API Documentation — ${config.projectName ?? "PortalAdmin"}`;
}

/**
 * @param {Array<Record<string, unknown>>} services
 */
function renderServiceCards(services) {
  const root = document.getElementById("service-cards");

  if (!root) {
    return;
  }

  root.innerHTML = "";

  for (const service of services) {
    const article = document.createElement("article");
    article.className = `service-card ${service.cardCls ?? service.id ?? ""}`;
    article.innerHTML = `
      <h2>${service.name}</h2>
      <code>${service.basePath}</code>
      <div style="margin-top: 0.5rem;">
        <a href="${service.docsUrl}" target="_blank" rel="noopener">Swagger nativo → /docs</a>
      </div>
    `;
    root.appendChild(article);
  }
}

// --- indice path — fetch parallelo spec OpenAPI e merge righe tabella ---
async function loadPathIndex() {
  const statusEl = document.getElementById("paths-status");
  /** @type {Array<Record<string, unknown>>} */
  const allRows  = [];
  /** @type {string[]} */
  const errors   = [];

  await Promise.all(
    SERVICES.map(async (service) => {
      try {
        const spec = await fetchOpenApi(service);
        allRows.push(...collectRows(service, spec));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${service.name} (:${service.port}): ${message}`);
      }
    })
  );

  if (!statusEl) {
    return;
  }

  if (allRows.length === 0) {
    statusEl.textContent = errors.length
      ? `Nessun endpoint caricato. ${errors.join(" · ")}`
      : "Nessun servizio OpenAPI in config — verifica product.manifest del product repo.";
    statusEl.classList.add("error");
    return;
  }

  renderPathsTable(sortRows(allRows));

  const okCount  = SERVICES.length - errors.length;
  const countMsg = `${allRows.length} endpoint su ${okCount} servizi`;
  statusEl.textContent = errors.length
    ? `${countMsg}. Avvisi: ${errors.join(" · ")}`
    : countMsg;
  statusEl.classList.toggle("error", errors.length > 0);
}

// --- bootstrap — config.json poi card servizi e tabella path ---
async function bootstrap() {
  const statusEl = document.getElementById("paths-status");

  try {
    const res = await fetch("/config.json");

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const config = await res.json();
    SERVICES     = Array.isArray(config.services) ? config.services : [];

    renderHeader(config);
    renderServiceCards(SERVICES);

    if (SERVICES.length === 0) {
      if (statusEl) {
        statusEl.textContent = "Nessun servizio con OpenAPI nel manifest del progetto.";
        statusEl.classList.add("error");
      }

      return;
    }

    await loadPathIndex();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (statusEl) {
      statusEl.textContent = `Config non disponibile: ${message}`;
      statusEl.classList.add("error");
    }
  }
}

bootstrap();
