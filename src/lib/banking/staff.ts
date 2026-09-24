/**
 * Invitation-only staff. Roles come from designations after authentication.
 * The browser never supplies a role.
 */

import type { Sql } from "@/lib/db";
import { emailProviderConfigured } from "@/lib/ai/provider";
import { ULTIMATE_ADMIN_EMAIL } from "./program";
import { newId } from "./ids";
import type { StaffRole } from "./types";

type Row = Record<string, unknown>;

export const STAFF_ROLES: StaffRole[] = [
  "viewer",
  "support",
  "ops",
  "risk",
  "compliance",
  "finance",
  "success",
  "engineer",
  "admin",
  "ultimate_admin",
];

export function formatStaffRole(role: string | null | undefined): string {
  if (!role) return "—";
  if (role === "ultimate_admin") return "ULTIMATE_ADMIN";
  return role.replaceAll("_", " ");
}

export function isPrivilegedStaff(role: StaffRole | null | undefined): boolean {
  return role === "ultimate_admin" || role === "admin";
}

async function userEmail(sql: Sql, userId: string): Promise<string | null> {
  const rows = await sql<Row>`select email from "user" where id = ${userId} limit 1`;
  const email = rows[0]?.email ? String(rows[0].email).trim().toLowerCase() : "";
  return email || null;
}

export async function ensureUltimateAdminDesignation(sql: Sql) {
  await sql`
    insert into staff_designations (email, role, status)
    values (${ULTIMATE_ADMIN_EMAIL}, 'ultimate_admin', 'pending')
    on conflict (email) do nothing
  `;
}

export async function resolveStaffRole(sql: Sql, userId: string): Promise<StaffRole | null> {
  try {
    await ensureUltimateAdminDesignation(sql);
  } catch {
    /* migration may not have applied yet */
  }
  const email = await userEmail(sql, userId);
  if (email) {
    try {
      const des =
        (await sql<Row>`select email, role, status from staff_designations where lower(email) = ${email} limit 1`)[0] ??
        null;
      if (des && String(des.status) !== "revoked") {
        const role = String(des.role) as StaffRole;
        await sql`
          insert into staff_users (user_id, role, email)
          values (${userId}, ${role}, ${email})
          on conflict (user_id) do update set role = excluded.role, email = excluded.email
        `;
        await sql`
          update staff_designations
          set user_id = ${userId}, status = 'active', activated_at = coalesce(activated_at, now())
          where lower(email) = ${email} and status != 'revoked'
        `;
        return role;
      }
    } catch {
      /* table missing — fall through to staff_users */
    }
  }
  const staff = await sql<{ role: string }>`select role from staff_users where user_id = ${userId} limit 1`;
  return staff[0] ? (staff[0].role as StaffRole) : null;
}

export async function listStaff(sql: Sql) {
  await ensureUltimateAdminDesignation(sql);
  const designations = await sql<Row>`
    select email, role, user_id, status, invited_by, created_at, activated_at
    from staff_designations
    order by case when role = 'ultimate_admin' then 0 else 1 end, created_at
  `;
  const assigned = await sql<Row>`select user_id, role, email, created_at from staff_users order by created_at`;
  return {
    ultimateAdminEmail: ULTIMATE_ADMIN_EMAIL,
    emailProviderConfigured: emailProviderConfigured(),
    designations: designations.map((row) => ({
      email: String(row.email),
      role: String(row.role),
      userId: row.user_id ? String(row.user_id) : null,
      status: String(row.status),
      invitedBy: row.invited_by ? String(row.invited_by) : null,
      createdAt: row.created_at ? String(row.created_at) : null,
      activatedAt: row.activated_at ? String(row.activated_at) : null,
    })),
    assigned: assigned.map((row) => ({
      userId: String(row.user_id),
      role: String(row.role),
      email: row.email ? String(row.email) : null,
      createdAt: row.created_at ? String(row.created_at) : null,
    })),
  };
}

export async function inviteStaff(
  sql: Sql,
  actorId: string,
  actorRole: StaffRole,
  input: { email: string; role: StaffRole },
) {
  if (actorRole !== "ultimate_admin" && actorRole !== "admin") {
    return { ok: false as const, error: "Only administrators can invite staff." };
  }
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "Enter a valid work email." };
  }
  if (!STAFF_ROLES.includes(input.role)) {
    return { ok: false as const, error: "Unknown role." };
  }
  if (input.role === "ultimate_admin" && actorRole !== "ultimate_admin") {
    return { ok: false as const, error: "Only the Ultimate Administrator can designate another Ultimate Administrator." };
  }
  await ensureUltimateAdminDesignation(sql);
  await sql`
    insert into staff_designations (email, role, invited_by, status)
    values (${email}, ${input.role}, ${actorId}, 'pending')
    on conflict (email) do update set role = excluded.role, invited_by = excluded.invited_by, status = 'pending'
  `;
  await sql`
    insert into staff_invites (id, email, role, invited_by, status, expires_at)
    values (${newId("inv")}, ${email}, ${input.role}, ${actorId}, 'pending', now() + interval '14 days')
  `;
  await sql`insert into audit_logs (id, actor_user_id, actor_role, action, entity_type, entity_id, metadata)
    values (${newId("aud")}, ${actorId}, ${actorRole}, 'staff.invite', 'staff', ${email}, ${JSON.stringify({ role: input.role })})`;
  return {
    ok: true as const,
    emailSent: false as const,
    notice: emailProviderConfigured()
      ? "Staff designation stored. Ask them to sign in with that email. MONEYLEAD does not invent passwords."
      : "Administrator email provider required. The designation is stored. Ask the person to sign in with that email — MONEYLEAD does not invent passwords.",
  };
}

export async function revokeStaff(sql: Sql, actorId: string, actorRole: StaffRole, emailOrUserId: string) {
  if (actorRole !== "ultimate_admin" && actorRole !== "admin") {
    return { ok: false as const, error: "Only administrators can remove staff access." };
  }
  const key = emailOrUserId.trim().toLowerCase();
  const des =
    (await sql<Row>`select email, role, user_id from staff_designations where lower(email) = ${key} or user_id = ${emailOrUserId} limit 1`)[0] ??
    null;
  if (des && String(des.role) === "ultimate_admin" && actorRole !== "ultimate_admin") {
    return { ok: false as const, error: "Only the Ultimate Administrator can change that designation." };
  }
  if (des && String(des.email).toLowerCase() === ULTIMATE_ADMIN_EMAIL) {
    return { ok: false as const, error: "The designated Ultimate Administrator cannot be revoked from this console." };
  }
  if (des) {
    await sql`update staff_designations set status = 'revoked' where lower(email) = ${String(des.email).toLowerCase()}`;
    if (des.user_id) await sql`delete from staff_users where user_id = ${String(des.user_id)}`;
  } else {
    await sql`delete from staff_users where user_id = ${emailOrUserId}`;
  }
  await sql`insert into audit_logs (id, actor_user_id, actor_role, action, entity_type, entity_id)
    values (${newId("aud")}, ${actorId}, ${actorRole}, 'staff.revoke', 'staff', ${emailOrUserId})`;
  return { ok: true as const };
}
