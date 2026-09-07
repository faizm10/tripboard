"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getDatabase } from "@/lib/db";
import { adminAuditLogs } from "@/lib/db/schema";
import { neonAuthUsers } from "@/lib/db/neon-auth-schema";

function targetId(formData: FormData) {
  const id = String(formData.get("userId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid user.");
  return id;
}

export async function suspendUser(formData: FormData) {
  const admin = await requireAdmin();
  const userId = targetId(formData);
  const reason = String(formData.get("reason") ?? "").trim();
  if (userId === admin.id) throw new Error("The only administrator cannot be suspended.");
  if (!reason) throw new Error("A suspension reason is required.");
  const db = getDatabase();
  if (!db) throw new Error("Database is unavailable.");
  await db.transaction(async (tx) => {
    await tx.update(neonAuthUsers).set({ banned: true, banReason: reason, banExpires: null }).where(eq(neonAuthUsers.id, userId));
    await tx.insert(adminAuditLogs).values({ action: "suspend", actorUserId: admin.id, actorEmail: admin.email, targetUserId: userId, reason });
  });
  revalidatePath("/admin");
  revalidatePath(`/admin/people/${userId}`);
  redirect(`/admin/people/${userId}`);
}

export async function restoreUser(formData: FormData) {
  const admin = await requireAdmin();
  const userId = targetId(formData);
  if (userId === admin.id) throw new Error("The administrator does not need restoration.");
  const db = getDatabase();
  if (!db) throw new Error("Database is unavailable.");
  await db.transaction(async (tx) => {
    await tx.update(neonAuthUsers).set({ banned: false, banReason: null, banExpires: null }).where(eq(neonAuthUsers.id, userId));
    await tx.insert(adminAuditLogs).values({ action: "restore", actorUserId: admin.id, actorEmail: admin.email, targetUserId: userId, reason: "Access restored" });
  });
  revalidatePath("/admin");
  revalidatePath(`/admin/people/${userId}`);
  redirect(`/admin/people/${userId}`);
}
