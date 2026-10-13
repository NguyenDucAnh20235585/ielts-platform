"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/features/auth/supabase-browser";
import { studentApi, errorText, StudentApiError } from "./api";
import type { StudentUser } from "./types";
import { Brand, StatusPanel } from "./ui";
import s from "./student.module.css";

const Context = createContext<{ user: StudentUser; logout: () => Promise<void> } | null>(null);
export function useStudent() {
  const value = useContext(Context);
  if (!value) throw new Error("StudentProvider is required.");
  return value;
}
export function StudentProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<StudentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const login = () => router.replace("/login?next=" + encodeURIComponent(window.location.pathname + window.location.search));
    window.addEventListener("ielts:unauthorized", login);
    void studentApi<StudentUser>("/api/me").then((data) => {
      if (active) { setUser(data); setError(null); }
    }).catch((err: unknown) => {
      if (!active) return;
      if (err instanceof StudentApiError && err.status === 401) login();
      else setError(errorText(err));
    });
    return () => { active = false; window.removeEventListener("ielts:unauthorized", login); };
  }, [router, pathname, revision]);
  async function logout() {
    try {
      const { error: authError } = await supabaseBrowser().auth.signOut();
      if (authError) throw new Error("Chưa thể đăng xuất. Vui lòng thử lại.");
      router.replace("/");
      router.refresh();
    } catch (err) { setError(errorText(err)); }
  }
  if (!user || error) return <div className={s.root}><div className={s.gate}><Brand />
    <StatusPanel loading={!error} title={error ? "Chưa thể mở khu vực học viên" : "Đang mở khu vực học viên…"} description={error ?? undefined}
      onRetry={error ? () => { setError(null); setRevision((n) => n + 1); } : undefined} />
  </div></div>;
  return <Context.Provider value={{ user, logout }}><div className={s.root}>{children}</div></Context.Provider>;
}
