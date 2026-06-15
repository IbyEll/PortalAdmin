const SERVICES = [
  {
    id       : "auth"
  , name     : "JustLastOne Auth"
  , badge    : "Auth"
  , badgeCls : "badge-auth"
  , port     : 4001
  , specUrl  : "http://localhost:4001/docs-json"
  , basePath : "/api/v1"
  }
, {
    id       : "api"
  , name     : "JustLastOne API"
  , badge    : "API"
  , badgeCls : "badge-api"
  , port     : 4000
  , specUrl  : "http://localhost:4000/docs-json"
  , basePath : "/api/v1"
  }
];

const METHOD_ORDER = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

function methodClass(method) {
  return `method method-${method.toLowerCase()}`;
}

function fullPath(basePath, pathKey) {
  const base = basePath.replace(/\/$/, "");
  const path = pathKey.startsWith("/") ? pathKey : `/${pathKey}`;
  return `${base}${path}`;
}

function displayPath(pathKey, service) {
  if (pathKey.startsWith("/")) {
    return pathKey;
  }

  return fullPath(service.basePath, pathKey);
}

async function fetchOpenApi(service) {
  const res = await fetch(service.specUrl);

  if (!res.ok) {
    throw new Error(`${service.name}: HTTP ${res.status}`);
  }

  return res.json();
}

function collectRows(service, spec) {
  const rows  = [];
  const paths = spec.paths ?? {};

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (method === "parameters") continue;

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

function sortRows(rows) {
  return rows.sort((a, b) => {
    if (a.serviceId !== b.serviceId) {
      return a.serviceId === "auth" ? -1 : 1;
    }

    if (a.path !== b.path) {
      return a.path.localeCompare(b.path);
    }

    return METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method);
  });
}

function renderPathsTable(rows) {
  const tbody = document.getElementById("paths-body");
  tbody.innerHTML = "";

  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="badge ${row.badgeCls}">${row.badge}</span></td>
      <td><span class="${methodClass(row.method)}">${row.method}</span></td>
      <td><code>${row.path}</code></td>
      <td>${row.tags}</td>
      <td>${row.summary}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function loadPathIndex() {
  const statusEl = document.getElementById("paths-status");
  const allRows  = [];
  const errors   = [];

  await Promise.all(
    SERVICES.map(async (service) => {
      try {
        const spec = await fetchOpenApi(service);
        allRows.push(...collectRows(service, spec));
      } catch (err) {
        errors.push(`${service.name} (:${service.port}): ${err.message}`);
      }
    })
  );

  if (allRows.length === 0) {
    statusEl.textContent =
      "Impossibile caricare le API. Avvia auth (:4001) e api (:4000), poi ricarica.";
    statusEl.classList.add("error");
    return;
  }

  renderPathsTable(sortRows(allRows));

  const countMsg = `${allRows.length} endpoint su ${SERVICES.length - errors.length} servizi`;
  statusEl.textContent = errors.length
    ? `${countMsg}. Avvisi: ${errors.join(" · ")}`
    : countMsg;
  statusEl.classList.toggle("error", errors.length > 0);
}

loadPathIndex();
