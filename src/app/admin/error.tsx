"use client";

import { Empty } from "@/features/admin/admin-ui";
import s from "@/features/admin/admin.module.css";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className={s.root}><div className={s.gate}><Empty title="Chưa thể hiển thị trang quản trị" description="Vui lòng tải lại trang để tiếp tục." onRetry={reset} /></div></div>;
}
