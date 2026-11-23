"use client";

import { useState } from "react";
import type { AdminTest } from "./client-types";
import { adminApi } from "./client-api";
import { ConfirmModal } from "./admin-ui";
import { AdminIcon } from "./admin-icons";
import { useAdmin } from "./admin-context";
import s from "./admin.module.css";

export function TestActions({ test, onComplete, compact = false }: { test: AdminTest; onComplete: () => Promise<unknown>; compact?: boolean }) {
  const [action, setAction] = useState<"hide" | "unhide" | "archive" | null>(null);
  const { confirmLeave } = useAdmin();
  if (test.visibility === "ARCHIVED") return null;
  const hidden = test.visibility === "HIDDEN";
  const labels = { hide: "Ẩn đề", unhide: "Hiện lại đề", archive: "Lưu trữ đề" };
  const description = {
    hide: "Đề sẽ được ẩn khỏi danh sách học viên và chặn lượt làm mới. Lượt đang làm vẫn có thể hoàn tất; kết quả cũ được giữ nguyên.",
    unhide: "Đề chỉ xuất hiện cho học viên khi có phiên bản đã xuất bản và đủ quyền truy cập. Nội dung và kết quả cũ được giữ nguyên.",
    archive: "Đề sẽ ngừng nhận lượt làm mới và không thể hiện lại trong phiên bản hiện tại của hệ thống. Lượt đang làm có thể hoàn tất, lịch sử được giữ nguyên.",
  };
  return <><div className={compact ? s.compactActions : s.actions}>
    <button className={compact ? s.textButton : s.secondary} type="button" onClick={() => confirmLeave(() => setAction(hidden ? "unhide" : "hide"))}>
      <AdminIcon name={hidden ? "eye" : "hide"} />{hidden ? "Hiện lại" : "Ẩn đề"}</button>
    <button className={compact ? s.dangerLink : s.dangerOutline} type="button" onClick={() => confirmLeave(() => setAction("archive"))}><AdminIcon name="archive" />Lưu trữ</button>
  </div>{action && <ConfirmModal title={labels[action]} description={description[action]} label={labels[action]} danger={action === "archive"} onClose={() => setAction(null)}
    onConfirm={async () => {
      await adminApi("/api/admin/tests/" + test.id + "/" + action, { method: "POST" });
      await onComplete();
    }} />}</>;
}
