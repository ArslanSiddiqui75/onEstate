/**
 * Creates hosted demo users (same emails/password as local seed accounts)
 * so a client can sign in on Vercel + Supabase.
 *
 * Usage (from 0nEstate/): node scripts/seed-hosted-demo.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ACCOUNTS = [
  { email: "owner@certified.local", name: "Ava North", role: "owner" },
  { email: "broker@certified.local", name: "James Cole", role: "broker" },
  { email: "teamlead@certified.local", name: "Mia Patel", role: "team_lead" },
  { email: "agent@certified.local", name: "Noah Reed", role: "agent" },
  { email: "assistant@certified.local", name: "Sofia Lane", role: "assistant" },
  { email: "accountant@certified.local", name: "Ben Ortiz", role: "accountant" },
];

const ORG_NAME = "Northbridge Realty Group";
const PASSWORD = process.env.DEMO_SEED_PASSWORD || "CertifiedDev1!";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const text = readFileSync(path, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function findUserByEmail(supabase, email) {
  const target = email.toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const match = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (match) return match;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ownerSpec = ACCOUNTS[0];
  let owner = await findUserByEmail(supabase, ownerSpec.email);
  if (!owner) {
    const created = await supabase.auth.admin.createUser({
      email: ownerSpec.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: ownerSpec.name,
        org_name: ORG_NAME,
        plan: "team",
        market: "uk",
      },
    });
    if (created.error) throw created.error;
    owner = created.data.user;
  } else {
    const updated = await supabase.auth.admin.updateUserById(owner.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: ownerSpec.name,
        org_name: ORG_NAME,
        plan: "team",
        market: "uk",
      },
    });
    if (updated.error) throw updated.error;
  }

  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, org_id")
    .eq("id", owner.id)
    .maybeSingle();
  if (profileError) throw profileError;

  if (!profile) {
    await new Promise((r) => setTimeout(r, 1500));
    const retry = await supabase
      .from("profiles")
      .select("id, org_id")
      .eq("id", owner.id)
      .maybeSingle();
    if (retry.error) throw retry.error;
    profile = retry.data;
  }
  if (!profile?.org_id) {
    throw new Error("Owner profile/org was not created by handle_new_user");
  }

  const orgId = profile.org_id;
  const orgPatch = await supabase
    .from("organizations")
    .update({ name: ORG_NAME, plan: "team", market: "uk" })
    .eq("id", orgId);
  if (orgPatch.error) throw orgPatch.error;

  const ownerPatch = await supabase
    .from("profiles")
    .update({ full_name: ownerSpec.name, role: "owner" })
    .eq("id", owner.id);
  if (ownerPatch.error) throw ownerPatch.error;

  const created = [];
  for (const account of ACCOUNTS.slice(1)) {
    const existing = await findUserByEmail(supabase, account.email);
    if (existing) {
      const updated = await supabase.auth.admin.updateUserById(existing.id, {
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { name: account.name },
      });
      if (updated.error) throw updated.error;
      const moved = await supabase
        .from("profiles")
        .update({
          org_id: orgId,
          full_name: account.name,
          role: account.role,
        })
        .eq("id", existing.id);
      if (moved.error) throw moved.error;
      created.push(`${account.email} (updated)`);
      continue;
    }

    const invite = await supabase.from("team_invites").upsert(
      {
        org_id: orgId,
        email: account.email,
        name: account.name,
        role: account.role,
        invited_by: owner.id,
        status: "pending",
      },
      { onConflict: "org_id,email" },
    );
    if (invite.error) throw invite.error;

    const createdUser = await supabase.auth.admin.createUser({
      email: account.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: account.name },
    });
    if (createdUser.error) throw createdUser.error;
    created.push(account.email);
  }

  const { data: members, error: membersError } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("org_id", orgId)
    .order("role");
  if (membersError) throw membersError;

  console.log(`Demo org: ${ORG_NAME}`);
  console.log(`Members: ${members.length}`);
  for (const row of members || []) {
    console.log(`- ${row.role}: ${row.full_name}`);
  }
  console.log(`Accounts ready: ${[ownerSpec.email, ...created].join(", ")}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
