"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {useState, type FormEvent } from "react";
import { SkillBadge, Pagination } from "@/features/student/ui";
import { AdminShell } from "./admin-shell";
import { AdminIcon } from "./admin-icons";
import { Alert, Empty, Modal, ModeBadges, StatusBadge } from "./admin-ui";
import { TestActions } from "./test-actions";
import { adminApi, adminError, body, useAdminResource } from "./client-api";
import { useAdmin, useDraftGuard } from "./admin-context";
import { dateLabel, testUrl, versionUrl, type TestList, type AdminTest, type VersionBrief } from "./client-types";
import s from "./admin.module.css";

export function AdminCataloguePage() {
  const router = useRouter();
  const params = useSearchParams();
  const type = ["READING", "LISTENING"].includes(params.get("type") ?? "") ? params.get("type")! : "";
  const status = ["DRAFT", "PUBLISHED", "HIDDEN", "ARCHIVED"].includes(params.get("status") ?? "") ? params.get("status")! : "";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const limit = [5, 10, 20, 50].includes(Number(params.get("limit"))) ? Number(params.get("limit")) : 10;
  const search = (params.get("search") ?? "").slice(0, 100);
  const [create, setCreate] = useState(false);
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (type) query.set("type", type);
  if (status) query.set("status", status);
  if (search) query.set("search", search);
  const resource = useAdminResource<TestList>("/api/admin/tests?" + query.toString());
  function filter(changes: Record<string, string>) {
    const next = new URLSearchParams(query);
    next.set("page", "1");
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    router.replace("/admin/tests?" + next.toString(), { scroll: false });
  }
  return <AdminShell skill={type}>
    <section className={s.pageHeading}><div><span className={s.eyebrow}>Không gian quản trị</span><h1>Quản lý đề thi</h1><p>Biên soạn và xuất bản đề IELTS Reading & Listening.</p></div>
      <button className={s.primary} type="button" onClick={() => setCreate(true)}><AdminIcon name="plus" />Tạo đề mới</button></section>
    <section className={s.filters} aria-label="Lọc danh sách đề">
      <CatalogueSearch
        key={search}
        search={search}
        onSearch={(value) => filter({ search: value })}
      />
      <div className={s.segmented} aria-label="Kỹ năng">{[["", "Tất cả"], ["READING", "Reading"], ["LISTENING", "Listening"]].map(([value, label]) =>
        <button type="button" key={value} aria-pressed={type === value} className={type === value ? s.segmentActive : ""} onClick={() => filter({ type: value })}>{label}</button>)}</div>
      <select aria-label="Trạng thái đề" value={status} onChange={(event) => filter({ status: event.target.value })}>
        <option value="">Tất cả trạng thái</option><option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Đã xuất bản</option><option value="HIDDEN">Đang ẩn</option><option value="ARCHIVED">Đã lưu trữ</option>
      </select>
      <button className={s.secondary} type="button" onClick={() => {router.replace("/admin/tests", { scroll: false }); }}><AdminIcon name="replay" />Đặt lại</button>
    </section>
    {resource.loading ? <Empty loading title="Đang tải danh sách đề…" /> : resource.error ? <Empty title="Chưa thể tải danh sách đề" description={resource.error} onRetry={() => void resource.refresh()} /> :
      resource.data && (resource.data.items.length === 0 ? <Empty title={page > 1 ? "Trang này không có đề" : search || type || status ? "Không tìm thấy đề phù hợp" : "Chưa có đề thi"}
        description={page > 1 ? "Danh sách đã thay đổi. Quay lại trang đầu để xem dữ liệu mới nhất." : search || type || status ? "Thay đổi bộ lọc hoặc tìm kiếm để xem các đề khác." : "Tạo đề đầu tiên để bắt đầu biên soạn nội dung."}>
        {page > 1 ? <button className={s.primary} type="button" onClick={() => filter({ page: "1" })}>Về trang đầu<AdminIcon name="back" /></button> :
          <button className={s.primary} type="button" onClick={() => setCreate(true)}>Tạo đề mới<AdminIcon name="plus" /></button>}
      </Empty> : <><div className={s.tableScroll}><table className={s.table}>
        <thead><tr><th>Tên đề thi</th><th>Kỹ năng</th><th>Trạng thái</th><th>Phiên bản / Chế độ</th><th>Cập nhật</th><th>Thao tác</th></tr></thead>
        <tbody>{resource.data.items.map((test) => <tr key={test.id}>
          <td><Link className={s.tableTitle} href={testUrl(test.id)}>{test.title}</Link>{test.description && <p className={s.tableDescription}>{test.description}</p>}</td>
          <td><SkillBadge type={test.type} /></td><td><StatusBadge status={test.status} /></td>
          <td><div className={s.versionCell}>{[test.current_version, test.draft_version].filter((v): v is VersionBrief => Boolean(v)).map((version) =>
            <div key={version.id}><span>Phiên bản {version.version_number} <small>{version.status === "DRAFT" ? "· Bản nháp" : "· Hiện hành"}</small></span><ModeBadges modes={version.modes} /></div>)}
            {!test.current_version && !test.draft_version && <span className={s.muted}>Xem danh sách phiên bản</span>}</div></td>
          <td className={s.dateCell}>{dateLabel(test.updated_at)}</td><td><div className={s.rowActions}>
            <Link className={s.secondarySmall} href={testUrl(test.id)}>Chi tiết<AdminIcon name="chevron" width="14" /></Link>
            {test.draft_version && test.visibility !== "ARCHIVED" && <Link className={s.textButton} href={versionUrl(test.draft_version.id)}><AdminIcon name="edit" />Soạn nháp</Link>}
            <TestActions test={test} compact onComplete={resource.refresh} /></div></td>
        </tr>)}</tbody>
      </table></div><div className={s.listFooter}><label>Số dòng <select value={limit} onChange={(event) => filter({ limit: event.target.value })}>{[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n} / trang</option>)}</select></label>
        <Pagination pagination={resource.data.pagination} onPage={(n) => filter({ page: String(n) })} /></div></>)}
    {create && <CreateTest onClose={() => setCreate(false)} onCreated={(id) => router.push(versionUrl(id))} />}
  </AdminShell>;
}
function CatalogueSearch({
  search,
  onSearch,
}: {
  search: string;
  onSearch: (value: string) => void;
}) {
  const [input, setInput] = useState(search);

  return (
    <form
      className={s.search}
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(input.trim());
      }}
    >
      <AdminIcon name="search" />
      <input
        aria-label="Tìm theo tên đề"
        placeholder="Tìm theo tên đề…"
        value={input}
        maxLength={100}
        onChange={(event) => setInput(event.target.value)}
      />
      <button className={s.textButton} type="submit">Tìm</button>
    </form>
  );
}
function CreateTest({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { confirmLeave, setDirty } = useAdmin();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"READING" | "LISTENING">("READING");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useDraftGuard(Boolean(title || description || type === "LISTENING"));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!title.trim()) { setError("Vui lòng nhập tên đề."); return; }
    setBusy(true); setError(null);
    try {
      const data = await adminApi<{ test: AdminTest; test_version: VersionBrief }>("/api/admin/tests", { method: "POST", ...body({ title: title.trim(), type, description: description.trim() || null }) });
      setDirty(false); onCreated(data.test_version.id);
    } catch (err) { setError(adminError(err)); setBusy(false); }
  }
  return <Modal title="Tạo đề thi mới" description="Khởi tạo bản nháp để biên soạn nội dung." busy={busy} onClose={() => confirmLeave(onClose)}>
    <form onSubmit={submit}><div className={s.modalBody}><Alert>Hệ thống sẽ tạo <strong>Phiên bản 1</strong> ở trạng thái <strong>Bản nháp</strong>. Bạn có thể thêm section và câu hỏi sau khi tạo đề.</Alert>
      {error && <Alert danger>{error}</Alert>}<fieldset disabled={busy} className={s.fields}>
        <label className={s.field}><span>Tên đề thi <b>*</b><small>{title.length}/200</small></span><input autoFocus required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Reading Practice — Environment" /></label>
        <fieldset className={s.skillChoices}><legend>Kỹ năng <b>*</b></legend>{(["READING", "LISTENING"] as const).map((skill) => <label key={skill} className={type === skill ? s.skillSelected : ""}>
          <input type="radio" name="new-test-skill" value={skill} checked={type === skill} onChange={() => setType(skill)} /><AdminIcon name={skill === "READING" ? "book" : "headphones"} width="26" height="26" />
          <strong>{skill === "READING" ? "Reading" : "Listening"}</strong><small>{skill === "READING" ? "Biên soạn passage và câu hỏi đọc hiểu." : "Biên soạn section, gắn audio và câu hỏi nghe."}</small></label>)}</fieldset>
        <label className={s.field}><span>Mô tả đề thi <small>Tùy chọn</small></span><textarea rows={3} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Chủ đề và nội dung của đề…" /></label>
      </fieldset></div><footer className={s.modalFooter}><button className={s.secondary} type="button" disabled={busy} onClick={() => confirmLeave(onClose)}>Hủy</button>
        <button className={s.primary} type="submit" disabled={busy}>{busy ? "Đang tạo…" : "Tạo đề & Soạn nội dung"}<AdminIcon name="arrow" /></button></footer></form>
  </Modal>;
}
