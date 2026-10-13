"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useStudent } from "./student-context";
import { StudentIcon, type IconName } from "./student-icons";
import { Badge, Brand } from "./ui";
import s from "./student.module.css";

const links: { href: string; label: string; icon: IconName }[] = [
  { href: "/student", label: "Tổng quan", icon: "home" },
  { href: "/student/tests", label: "Thư viện đề", icon: "library" },
  { href: "/student/history", label: "Lịch sử làm bài", icon: "history" },
];
export function StudentShell({ children }: { children: ReactNode }) {
  const { user, logout } = useStudent();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const name = user.profile.display_name || user.email?.split("@")[0] || "Học viên";
  return <div className={s.shell}>
    {menuOpen && <button className={s.sidebarBackdrop} type="button" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}
    <aside className={[s.sidebar, menuOpen ? s.sidebarOpen : ""].join(" ")} aria-label="Khu vực học viên">
      <div className={s.sidebarBrand}><Brand /><button type="button" className={s.sidebarClose} onClick={() => setMenuOpen(false)} aria-label="Đóng menu"><StudentIcon name="close" /></button></div>
      <nav className={s.sidebarNavigation} aria-label="Điều hướng học viên">
        {links.map(({ href, label, icon }) => {
          const active = href === "/student" ? pathname === href : pathname.startsWith(href);
          return <Link href={href} key={href} className={active ? s.sidebarActive : ""} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)}><StudentIcon name={icon} />{label}</Link>;
        })}
      </nav>
      <div className={s.sidebarBottom}><div className={s.sidebarHint}><StudentIcon name="shield" /><p>Tiến trình và kết quả được lưu theo từng lần làm bài.</p></div>
        <button type="button" className={s.logoutButton} onClick={() => void logout()}><StudentIcon name="logout" />Đăng xuất</button>
      </div>
    </aside>
    <div className={s.shellMain}>
      <header className={s.topbar}>
        <button className={s.mobileMenuButton} type="button" aria-label="Mở menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><StudentIcon name="menu" /></button>
        <Badge teal><span className={s.statusDot} />Hệ thống luyện thi trực tuyến</Badge>
        <div className={s.userIdentity}><span><strong title={name}>{name}</strong><small title={user.email ?? ""}>{user.email}</small></span><span className={s.avatar}><StudentIcon name="user" width="18" height="18" /></span></div>
      </header>
      <main className={s.pageContent}>{children}</main>
    </div>
  </div>;
}
