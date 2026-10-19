"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/features/auth/supabase-browser";
import { Brand } from "@/features/student/ui";
import { adminApi, adminError } from "./client-api";
import type { AdminUser } from "./client-types";
import { Alert, Empty, Modal } from "./admin-ui";
import s from "./admin.module.css";

type AdminContextValue = {
  user: AdminUser;
  dirty: boolean;
  setDirty: (value: boolean) => void;
  confirmLeave: (action: () => void) => void;
  logout: () => void;
};
const Context = createContext<AdminContextValue | null>(null);
export function useAdmin() {
  const context = useContext(Context);
  if (!context) throw new Error("AdminProvider is required.");
  return context;
}
export function useDraftGuard(dirty: boolean) {
  const { setDirty } = useAdmin();
  useEffect(() => { setDirty(dirty); return () => setDirty(false); }, [dirty, setDirty]);
}
export function AdminProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const confirmLeave = useCallback((action: () => void) => {
    if (dirtyRef.current) setPending(() => action);
    else action();
  }, []);
  const updateDirty = useCallback((value: boolean) => { dirtyRef.current = value; setDirty(value); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const login = () => {
      updateDirty(false);
      router.replace("/login?next=" + encodeURIComponent(window.location.pathname + window.location.search));
    };
    window.addEventListener("ielts:unauthorized", login);
    void adminApi<AdminUser>("/api/me", { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) { setUser(data); setError(null); }
    }).catch((err: unknown) => { if (!controller.signal.aborted) setError(adminError(err)); });
    return () => { controller.abort(); window.removeEventListener("ielts:unauthorized", login); };
  }, [revision, router, updateDirty]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) { event.preventDefault(); event.returnValue = ""; }
    };
    const linkClick = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.href === window.location.href || (target.pathname === window.location.pathname && target.search === window.location.search && target.hash)) return;
      event.preventDefault();
      event.stopPropagation();
      confirmLeave(() => { if (target.origin === window.location.origin) router.push(target.pathname + target.search + target.hash); else window.location.assign(target.href); });
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", linkClick, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", linkClick, true); };
  }, [confirmLeave, router]);
  const logout = () => confirmLeave(() => {
    void supabaseBrowser().auth.signOut().then(({ error: authError }) => {
      if (authError) setError("Chưa thể đăng xuất. Vui lòng thử lại.");
      else { router.replace("/"); router.refresh(); }
    }).catch((err: unknown) => setError(adminError(err)));
  });
  if (!user) return <div className={s.root}><div className={s.gate}><Brand />
    <Empty loading={!error} title={error ? "Chưa thể mở khu vực quản trị" : "Đang mở khu vực quản trị…"} description={error}
      onRetry={error ? () => { setError(null); setRevision((value) => value + 1); } : undefined} /></div></div>;
  if (user.role !== "ADMIN") return <div className={s.root}><div className={s.gate}><Brand />
    <Empty title="Bạn không có quyền quản trị" description="Khu vực này chỉ dành cho tài khoản có vai trò Admin.">
      <Link className={s.primary} href="/student">Vào khu vực học viên</Link></Empty></div></div>;
  return <Context.Provider value={{ user, dirty, setDirty: updateDirty, confirmLeave, logout }}><div className={s.root}>
    {error && <Alert danger>{error}<button className={s.textButton} type="button" onClick={() => setError(null)}>Đóng</button></Alert>}
    {children}
    {pending && <Modal title="Bạn có thay đổi chưa lưu" description="Rời mục này sẽ bỏ các thay đổi đang nhập." onClose={() => setPending(null)}>
      <footer className={s.modalFooter}><button className={s.secondary} type="button" onClick={() => setPending(null)}>Tiếp tục chỉnh sửa</button>
        <button className={s.danger} type="button" onClick={() => { updateDirty(false); setPending(null); pending(); }}>Bỏ thay đổi và tiếp tục</button></footer>
    </Modal>}
  </div></Context.Provider>;
}
