import type { MediaUrl } from "@/features/test/student-content";

/**
 * Turns an R2 object key into a URL the browser can load (D-009).
 * Prototype: public bucket base URL (`R2_PUBLIC_BASE_URL`). Presigned URLs for
 * a private bucket come with W2-04 once the bucket setup is known (OI-11).
 * Returns null when media is not configured, so Reading tests still work.
 */
export function resolveMediaUrl(objectKey: string): MediaUrl | null {
  const base = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!base) {
    return null;
  }
  const path = objectKey.split("/").map(encodeURIComponent).join("/");
  return { url: `${base.replace(/\/+$/, "")}/${path}`, expires_at: null };
}
