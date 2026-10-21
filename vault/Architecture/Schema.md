# Schema

> **HUMAN REFERENCE.** Source of truth: `supabase/migrations/*.sql` and `src/types/index.ts`.

Core entities: organizations, profiles, leads (+ phones, activities, tasks), contacts, listings, transactions / deals, websites, social accounts/posts, automations + runs, messages/threads, call logs, platform_* admin tables, portal_connections, team invites, tickets (where migrated).

Apply migrations in filename order on hosted. Reconciliation and QA leftovers live in later numbered / timestamped migrations — always read the folder, do not trust this summary for columns.
