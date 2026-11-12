import Link from "next/link";
import type { ReactNode } from "react";
import type { Paginated, Skill } from "./types";
import { StudentIcon } from "./student-icons";
import s from "./student.module.css";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className={s.brand} aria-label="IELTS Reading & Listening — Trang chủ">
    <span className={s.brandIcon}><StudentIcon name="book" /></span>
    <span><strong>IELTS R&L</strong>{!compact && <small>READING & LISTENING</small>}</span>
  </Link>;
}
export function Badge({ children, teal = false, dark = false }: { children: ReactNode; teal?: boolean; dark?: boolean }) {
  return <span className={[s.badge, teal ? s.tealBadge : "", dark ? s.darkBadge : ""].join(" ")}>{children}</span>;
}
export function SkillBadge({ type }: { type: Skill }) {
  return <Badge teal={type === "LISTENING"}><StudentIcon name={type === "LISTENING" ? "headphones" : "book"} width="15" height="15" />{type === "LISTENING" ? "Listening" : "Reading"}</Badge>;
}
export function StatusPanel({ loading, title, description, onRetry, children }: {
  loading?: boolean; title?: string; description?: string; onRetry?: () => void; children?: ReactNode;
}) {
  return <div className={s.statusPanel} role={loading ? "status" : undefined}>
    {loading ? <span className={s.spinner} /> : <span className={s.statusIcon}><StudentIcon name="info" width="26" height="26" /></span>}
    <h2>{title ?? (loading ? "Đang tải…" : "Chưa có dữ liệu")}</h2>
    {description && <p>{description}</p>}
    {onRetry && <button className={s.primaryButton} type="button" onClick={onRetry}>Thử lại<StudentIcon name="replay" width="16" height="16" /></button>}
    {children}
  </div>;
}
export function Notice({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  return <div className={danger ? s.errorNotice : s.notice} role={danger ? "alert" : "status"}><StudentIcon name="info" />{children}</div>;
}
export function Pagination({ pagination, onPage }: { pagination: Paginated<unknown>["pagination"]; onPage: (page: number) => void }) {
  if (!pagination.total) return null;
  const { page, limit, total, total_pages } = pagination;
  const pages = Array.from({ length: total_pages }, (_, i) => i + 1).filter((n) => n === 1 || n === total_pages || Math.abs(n - page) <= 1);
  return <div className={s.pagination}>
    <span>Hiển thị <strong>{(page - 1) * limit + 1}–{Math.min(page * limit, total)}</strong> trong <strong>{total}</strong></span>
    <nav aria-label="Phân trang" className={s.pageNumbers}>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước"><StudentIcon name="back" width="16" height="16" /></button>
      {pages.map((n, i) => <span key={n} className={s.pageNumberItem}>
        {i > 0 && n > pages[i - 1] + 1 && <span className={s.pageEllipsis}>…</span>}
        <button type="button" aria-current={page === n ? "page" : undefined} className={page === n ? s.currentPage : ""} onClick={() => onPage(n)}>{n}</button>
      </span>)}
      <button type="button" disabled={page >= total_pages} onClick={() => onPage(page + 1)} aria-label="Trang sau"><StudentIcon name="arrow" width="16" height="16" /></button>
    </nav>
    <span>Trang {page} / {total_pages}</span>
  </div>;
}
