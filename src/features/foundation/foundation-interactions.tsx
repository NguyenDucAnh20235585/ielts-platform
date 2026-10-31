"use client";

import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import { useRouter } from "next/navigation";

import FoundationIcon from "./foundation-icons";
import styles from "./foundation.module.css";

type AccountIntent = "login" | "register";

const navigation = [
  { href: "#gioi-thieu", label: "Giới thiệu" },
  { href: "#ky-nang", label: "Kỹ năng" },
  { href: "#diem-noi-bat", label: "Điểm nổi bật" },
  { href: "#cach-luyen-tap", label: "Cách luyện tập" },
] as const;

export function FoundationProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function AccountButton({ intent = "login", children, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type"> & {
  intent?: AccountIntent;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <button type="button" {...props} onClick={() => router.push(intent === "register" ? "/register" : "/login?next=%2Fstudent%2Ftests")}>
      {children}
    </button>
  );
}

export function FoundationHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("#gioi-thieu");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(`#${entry.target.id}`);
        }
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
    );
    for (const { href } of navigation) {
      const section = document.getElementById(href.slice(1));
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  function closeMenu(href: string) {
    setActiveSection(href);
    setMenuOpen(false);
  }

  return (
    <header className={styles.header}>
      <div className={`${styles.container} ${styles.headerInner}`}>
        <a href="#gioi-thieu" className={styles.brand} aria-label="IELTS Reading & Listening — Trang chủ">
          <span className={styles.brandIcon}><FoundationIcon name="book" width="24" height="24" /></span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>IELTS <strong>R&L</strong></span>
            <span className={styles.brandSubtitle}>READING & LISTENING</span>
          </span>
        </a>
        <nav className={styles.desktopNavigation} aria-label="Điều hướng chính">
          {navigation.map(({ href, label }) => (
            <a key={href} href={href}
              className={`${styles.navigationLink} ${activeSection === href ? styles.navigationActive : ""}`}
              aria-current={activeSection === href ? "location" : undefined}
              onClick={() => closeMenu(href)}>
              {label}
            </a>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <AccountButton className={styles.loginButton}>Đăng nhập</AccountButton>
          <AccountButton className={`${styles.button} ${styles.primaryButton} ${styles.headerCta}`}>Bắt đầu luyện tập</AccountButton>
          <AccountButton className={styles.avatarButton} aria-label="Mở tài khoản" title="Tài khoản">
            <FoundationIcon name="user" width="16" height="16" />
          </AccountButton>
          <button type="button" className={styles.menuButton} aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={menuOpen} aria-controls="foundation-mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>
            <FoundationIcon name={menuOpen ? "close" : "menu"} width="24" height="24" />
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav id="foundation-mobile-navigation" className={styles.mobileNavigation} aria-label="Điều hướng trên điện thoại">
          {navigation.map(({ href, label }) => (
            <a key={href} href={href}
              className={`${styles.navigationLink} ${activeSection === href ? styles.navigationActive : ""}`}
              aria-current={activeSection === href ? "location" : undefined}
              onClick={() => closeMenu(href)}>
              {label}
            </a>
          ))}
          <AccountButton className={`${styles.button} ${styles.primaryButton}`} intent="register">
            Bắt đầu luyện tập<FoundationIcon name="arrow" width="16" height="16" />
          </AccountButton>
        </nav>
      )}
    </header>
  );
}
