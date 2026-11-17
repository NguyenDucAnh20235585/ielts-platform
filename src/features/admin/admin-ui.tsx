"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AdminIcon } from "./admin-icons";
import s from "./admin.module.css";

export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = { DRAFT: "Bản nháp", PUBLISHED: "Đã xuất bản", HIDDEN: "Đang ẩn", ARCHIVED: "Đã lưu trữ" };
  return <span className={[s.badge, status === "PUBLISHED" ? s.badgeTeal : status === "HIDDEN" ? s.badgeAmber : status === "ARCHIVED" ? s.badgeMuted : ""].join(" ")}>
    <span className={s.dot} />{labels[status] ?? status}</span>;
}
export function ModeBadges({ modes }: { modes: readonly string[] }) {
  return <div className={s.badgeRow}>{modes.map((mode) => <span className={s.badge} key={mode}>{mode === "MOCK" ? "Thi thử" : "Luyện tập"}</span>)}{modes.length === 0 && <span className={s.muted}>Chưa bật chế độ</span>}</div>;
}
export function Alert({ children, danger = false }: { children: ReactNode; danger?: boolean }) {
  return <div className={danger ? s.error : s.notice} role={danger ? "alert" : "status"}><AdminIcon name="info" /><div>{children}</div></div>;
}
export function Empty({ title, description, loading = false, onRetry, children }: {
  title: string; description?: string | null; loading?: boolean; onRetry?: () => void; children?: ReactNode;
}) {
  return <div className={s.empty} role={loading ? "status" : undefined}>
    <span className={loading ? s.spinner : s.emptyIcon}>{!loading && <AdminIcon name="library" width="28" height="28" />}</span>
    <h2>{title}</h2>{description && <p>{description}</p>}
    {onRetry && <button className={s.primary} type="button" onClick={onRetry}>Thử lại<AdminIcon name="replay" /></button>}{children}
  </div>;
}
export function Modal({ title, description, children, onClose, busy = false, wide = false }: {
  title: string; description?: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previous; };
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(<dialog ref={dialog} className={[s.modal, wide ? s.modalWide : ""].join(" ")} aria-labelledby={titleId}
    aria-describedby={description ? descriptionId : undefined}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => {
      if (event.target !== event.currentTarget || busy) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <header className={s.modalHeader}><div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div>
      <button className={s.iconButton} type="button" aria-label="Đóng hộp thoại" disabled={busy} onClick={onClose}><AdminIcon name="close" /></button></header>
    {children}
  </dialog>, document.body);
}
export function ConfirmModal({ title, description, label, danger, onConfirm, onClose }: {
  title: string; description: string; label: string; danger?: boolean; onConfirm: () => Promise<void>; onClose: () => void;
}) {
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  return <Modal title={title} busy={state.busy} onClose={onClose}>
    <div className={s.modalBody}><p>{description}</p>{state.error && <Alert danger>{state.error}</Alert>}</div>
    <footer className={s.modalFooter}><button className={s.secondary} type="button" disabled={state.busy} onClick={onClose}>Hủy</button>
      <button className={danger ? s.danger : s.primary} type="button" disabled={state.busy} onClick={async () => {
        setState({ busy: true, error: null });
        try { await onConfirm(); onClose(); } catch (error) { setState({ busy: false, error: error instanceof Error ? error.message : "Chưa thể thực hiện thao tác." }); }
      }}>{state.busy ? "Đang xử lý…" : label}</button></footer>
  </Modal>;
}
