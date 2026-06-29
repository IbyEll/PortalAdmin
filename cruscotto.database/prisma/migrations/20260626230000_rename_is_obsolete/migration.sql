-- Rename is_sprint6_obsolete → is_obsolete (generalizzazione flag backlog obsoleto)
ALTER TABLE "jira_issue" RENAME COLUMN "is_sprint6_obsolete" TO "is_obsolete";
ALTER TABLE "jira_issue_wip" RENAME COLUMN "is_sprint6_obsolete" TO "is_obsolete";
