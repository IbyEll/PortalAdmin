---
name: jlo-jira-auto
description: Workflow Jira via Task subagent («Jira Auto»). Usa su procedi/gogo/chiudi/ok chiudi ADMIN-xxx e JLO-xxx in PortalAdmin. Mai CallMcpTool Jira diretto nel workflow.
---

# Jira Auto — PortalAdmin + JLO

## MCP

| Campo | Valore |
| --- | --- |
| Server | `plugin-atlassian-atlassian` |
| cloudId | `3caddd74-469e-4ca3-adf8-926f79c98e7c` |
| Transizione **Fatto** | id `"41"` |

## Label Task

| Fase | Esempio |
| --- | --- |
| Step 0 | `Step 0 ADMIN-96 plan Jira` |
| Ok chiudi | `Ok chiudi ADMIN-121 subtask Jira` |
| Chiudi parent | `Close ADMIN-96 parent Jira` |

## Chiudi parent — prompt

Passa `branch`, `prUrl`, `commits`, `catalog` da `node scripts/close-story.mjs --key ADMIN-xxx`.

Repo PR: `https://github.com/IbyEll/PortalAdmin`

## Vietato

- ❌ `CallMcpTool` Jira dal agente principale in procedi/gogo/chiudi
- ❌ Dump JSON Jira in chat
