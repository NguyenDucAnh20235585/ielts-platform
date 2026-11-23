"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Brand } from "@/features/student/ui";
import { useAdmin } from "./admin-context";
import { AdminIcon } from "./admin-icons";
import s from "./admin.module.css";

export function AdminShell({ children, skill = "", title = "Quản lý đề" }: { children: ReactNode; skill?: string; title?: string }) {
  const { user, logout } = useAdmin();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const name = user.profile.display_name || user.email?.split("@")[0] || "Quản trị viên";
  return <div className={s.shell}>
    {open && <button type="button" className={s.sidebarBackdrop} aria-label="Đóng menu" onClick={() => setOpen(false)} />}
    <aside className={[s.sidebar, open ? s.sidebarOpen : ""].join(" ")} aria-label="Điều hướng quản trị">
      <div className={s.sidebarBrand}><Brand /><button className={s.mobileOnly + " " + s.iconButton} type="button" aria-label="Đóng menu" onClick={() => setOpen(false)}><AdminIcon name="close" /></button></div>
      <span className={s.adminBadge}>Quản trị</span>
      <nav><span className={s.navLabel}>Học thuật</span>
        <Link className={s.navParent} href="/admin/tests" onClick={() => setOpen(false)}><AdminIcon name="library" />Quản lý đề</Link>
        {[["", "Tất cả đề thi", "library"], ["READING", "Đề Reading", "book"], ["LISTENING", "Đề Listening", "headphones"]].map(([value, label, icon]) =>
          <Link key={value} href={"/admin/tests" + (value ? "?type=" + value : "")}
            className={[s.navLink, pathname === "/admin/tests" && skill === value ? s.navActive : ""].join(" ")} onClick={() => setOpen(false)}>
            <AdminIcon name={icon as "book" | "library" | "headphones"} />{label}</Link>)}
      </nav>
      <div className={s.sidebarBottom}><Link className={s.studentLink} href="/student"><AdminIcon name="arrow" />Khu vực học viên</Link>
        <button className={s.logout} type="button" onClick={logout}><AdminIcon name="logout" />Đăng xuất</button></div>
    </aside>
    <div className={s.shellMain}><header className={s.topbar}>
      <button className={s.mobileOnly + " " + s.iconButton} type="button" aria-label="Mở menu" aria-expanded={open} onClick={() => setOpen(true)}><AdminIcon name="menu" /></button>
      <div className={s.breadcrumb}><span>Học thuật</span><AdminIcon name="chevron" width="14" height="14" /><strong>{title}</strong></div>
      <div className={s.identity}><div><strong>{name}</strong><small>{user.email}</small></div><span className={s.avatar}><AdminIcon name="user" /></span></div>
    </header><main className={s.page}>{children}</main></div>
  </div>;
}
