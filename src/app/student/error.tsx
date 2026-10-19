"use client";
import { StatusPanel } from "@/features/student/ui";
import s from "@/features/student/student.module.css";
export default function Error({ reset }: { reset: () => void }) {
  return <div className={s.root}><div className={s.gate}><StatusPanel title="Chưa thể hiển thị trang" description="Thử tải lại trang để tiếp tục." onRetry={reset} /></div></div>;
}
