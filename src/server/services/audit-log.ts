import "server-only";

import { jsonValue } from "@/server/db/json";
import type { Queryable } from "@/server/db/types";

/** Audited actions (api-contract §12.7). */
export type AuditAction =
  | "test.create"
  | "test.archive"
  | "test.hide"
  | "test.unhide"
  | "test_version.publish"
  | "test_version.settings_update"
  | "answer_key.update"
  | "answer_key.delete";

export type AuditEntry = {
  actorId: string;
  action: AuditAction;
  resourceType: "test" | "test_version" | "question";
  resourceId: string;
  /** Before/after values etc. Never passwords, tokens or cookies. */
  metadata?: Record<string, unknown>;
};

/** Appends one audit_logs row. Call it inside the transaction of the change it records. */
export async function writeAuditLog(sql: Queryable, entry: AuditEntry): Promise<void> {
  await sql`
    insert into public.audit_logs (actor_id, action, resource_type, resource_id, metadata)
    values (${entry.actorId}, ${entry.action}, ${entry.resourceType}, ${entry.resourceId},
            ${sql.json(jsonValue(entry.metadata ?? {}))})
  `;
}
