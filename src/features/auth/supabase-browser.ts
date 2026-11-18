"use client";

import { createBrowserClient } from "@supabase/ssr";

export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Chưa cấu hình kết nối tài khoản. Vui lòng liên hệ người quản trị.");
  return createBrowserClient(url, key);
}
