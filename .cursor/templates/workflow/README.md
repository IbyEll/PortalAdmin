# Template workflow — description Jira

File per **ok chiudi** (subtask) e **chiudi Story/Bug/Todo** (parent).

| File | Uso | Quando |
| --- | --- | --- |
| `ok-chiudi-subtask.md` | Subtask → Fatto | Dopo commit, prima di transition (§8) |
| `chiudi-parent.md` | Parent → Fatto | `chiudi` / `chiudi fast` dopo `admin.portal.JiraCORE/jiraCORE.close.story.mjs` |

**Veve:** `.cursor/templates/veve/` — AC/DoD sempre `[ ]`.

## Regole Cursor

- `ADMIN-Workflow.mdc` · skill `jlo-jira-auto`
- JLO product: `JustLastOne/.cursor/templates/workflow/` — stesso schema
