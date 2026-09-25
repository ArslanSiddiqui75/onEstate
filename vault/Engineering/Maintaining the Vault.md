# Maintaining the Vault

## Split

| Role | Source |
|---|---|
| Agents | Repo `context.md` + code + migrations |
| Humans | This Obsidian vault (`vault/`) |

Architecture notes are **human onboarding**. If a note disagrees with code or SQL, fix the note or delete the stale claim — do not “fix” the agent from the vault.

## When to update vault (and `context.md`)

- Product decisions, lifecycle, workflow
- Launch checklist / remaining client work
- Listings / inventory / portal facts that operators care about
- How to run, env **names**, alerts, external platform / ToS notes

## When not to update

- Refactors, UI polish, perf tweaks, test-only PRs
- Dumping full API or schema diffs after every PR

## Hygiene

- Keep notes thin.
- No secrets beyond local demo ops pointers already in `.env.example`.
- Obsidian workspace files are gitignored — do not fight that.
- Scratch ideas go in [[Inbox/Scratch]], then promote or delete.
