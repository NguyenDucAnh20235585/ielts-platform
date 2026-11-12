"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { FoundationFooter } from "@/features/foundation/foundation-footer";
import { FoundationTheme, FoundationThemeToggle } from "@/features/foundation/foundation-theme";
import foundation from "@/features/foundation/foundation.module.css";
import { StudentIcon, type IconName } from "./student-icons";
import type { StudentUser } from "./types";
import s from "./student-theme-shell.module.css";

const navigation: { href: string; label: string; icon: IconName }[] = [
  { href: "/student", label: "Tổng quan", icon: "home" },
  { href: "/student/tests", label: "Thư viện đề", icon: "library" },
  { href: "/student/history", label: "Lịch sử làm bài", icon: "history" },
];

// Pages opt in to this shell individually while the student UI is migrated.
export function StudentThemeShell({ children, user, onLogout, centered = false }: {
  children: ReactNode;
  user?: StudentUser;
  onLogout?: () => Promise<void>;
  centered?: boolean;
}) {
  const pathname = usePathname();
  const name = user?.profile.display_name || user?.email?.split("@")[0] || "Học viên";

  return (
    <FoundationTheme>
      <a className={foundation.skipLink} href="#noi-dung-hoc-vien">Chuyển đến nội dung chính</a>
      <header className={s.header}>
        <div className={`${foundation.container} ${s.headerInner}`}>
          <Link href="/" className={foundation.brand} aria-label="Ms Chau’s IELTS — Trang chủ">
            Ms Chau’s IELTS
          </Link>
          <div className={s.headerActions}>
            {user && (
              <div className={s.identity}>
                <span className={s.avatar}><StudentIcon name="user" width="18" height="18" /></span>
                <div className={s.identityText}>
                  <strong title={name}>{name}</strong>
                  <span title={user.email ?? undefined}>{user.email || "Học viên"}</span>
                </div>
              </div>
            )}
            <FoundationThemeToggle />
            {user && onLogout && (
              <button type="button" className={s.logoutButton} onClick={() => void onLogout()}
                aria-label="Đăng xuất" title="Đăng xuất">
                <StudentIcon name="logout" width="18" height="18" />
                <span className={s.logoutLabel}>Đăng xuất</span>
              </button>
            )}
          </div>
        </div>
        {user && (
          <div className={s.navigationBorder}>
            <nav className={`${foundation.container} ${s.navigation}`} aria-label="Điều hướng học viên">
              {navigation.map(({ href, label, icon }) => {
                const active = href === "/student" ? pathname === href : pathname.startsWith(href);
                return (
                  <Link key={href} href={href} className={s.navLink} aria-current={active ? "page" : undefined}>
                    <StudentIcon name={icon} className={s.navigationIcon} width="18" height="18" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      <main id="noi-dung-hoc-vien" className={`${s.main} ${centered ? s.centered : ""}`} tabIndex={-1}>
        <span className={`${foundation.corner} ${foundation.cornerTop}`} aria-hidden="true" />
        <span className={`${foundation.corner} ${foundation.cornerBottom}`} aria-hidden="true" />
        <div className={foundation.container}>{children}</div>
      </main>
      <FoundationFooter />
    </FoundationTheme>
  );
}

export function StudentThemeStatus({ loading = false, error = false, title, description, onRetry, icon = "info", headingAs = "h3", children }: {
  loading?: boolean;
  error?: boolean;
  title: string;
  description?: string;
  onRetry?: () => void;
  icon?: IconName;
  headingAs?: "h1" | "h3";
  children?: ReactNode;
}) {
  const Heading = headingAs;
  return (
    <div className={`${s.statusPanel} ${error ? s.errorPanel : ""}`} role={loading ? "status" : error ? "alert" : undefined} aria-busy={loading}>
      <span className={s.statusIcon}>
        {loading ? <span className={s.spinner} aria-hidden="true" /> : <StudentIcon name={icon} width="24" height="24" />}
      </span>
      <Heading className={s.statusTitle}>{title}</Heading>
      {description && <p className={s.statusDescription}>{description}</p>}
      {onRetry && <button type="button" onClick={onRetry} className={s.retryButton}>Thử lại<StudentIcon name="replay" width="16" height="16" /></button>}
      {children}
    </div>
  );
}
