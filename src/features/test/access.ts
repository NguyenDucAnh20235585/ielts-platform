import type { DbAccessType } from "./api-enums";

/**
 * Who may see and start a test (v1 §4, api-contract §12.1, D-017).
 *
 * - PUBLIC: every signed-in student.
 * - PRIVATE / ASSIGNED: only users who were granted the test. Grants
 *   (assignments, CR-14) do not exist yet, so no student is granted:
 *   these tests are closed to students (fail closed), whatever the FE shows.
 * - Admins may open any test, so they can check what students will get.
 *
 * Checked on the catalogue, the test detail and start. An attempt that was
 * already started stays readable by its owner (ownership rule, D-011).
 */
export function studentAccessTypes(role: "STUDENT" | "ADMIN"): readonly DbAccessType[] {
  return role === "ADMIN" ? ["public", "private", "assigned"] : ["public"];
}

export function canOpenTest(role: "STUDENT" | "ADMIN", accessType: DbAccessType): boolean {
  return studentAccessTypes(role).includes(accessType);
}
