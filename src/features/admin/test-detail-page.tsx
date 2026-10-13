"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { SkillBadge } from "@/features/student/ui";
import { AdminShell } from "./admin-shell";
import { AdminIcon } from "./admin-icons";
import { Alert, Empty, ModeBadges, StatusBadge } from "./admin-ui";
import { TestActions } from "./test-actions";
import { adminApi, adminError, body, useAdminResource } from "./client-api";
import { useAdmin, useDraftGuard } from "./admin-context";
import { dateLabel, versionUrl, type TestDetail, type VersionEditor, type AdminTest } from "./client-types";
import s from "./admin.module.css";

export function AdminTestDetailPage({ testId }: { testId: string }) {
  const resource = useAdminResource<TestDetail>("/api/admin/tests/" + encodeURIComponent(testId));
  const detail = resource.data;
  const candidate = detail && detail.versions.every((version) => version.status === "DRAFT") ? detail.test.draft_version : null;
  const draft = useAdminResource<VersionEditor>(candidate ? "/api/admin/test-versions/" + candidate.id : null);
  const canChangeType = Boolean(candidate && draft.data && draft.data.sections.length === 0 && !draft.loading && !draft.error);
  const preview = detail?.test.current_version ?? detail?.test.draft_version ?? detail?.versions[0];
  return <AdminShell title="Chi tiết đề">
    <Link className={s.backLink} href="/admin/tests"><AdminIcon name="back" />Danh sách đề</Link>
    {resource.loading ? <Empty loading title="Đang tải thông tin đề…" /> : resource.error ? <Empty title="Chưa thể tải đề" description={resource.error} onRetry={() => void resource.refresh()} /> :
      detail && <>
        <section className={s.detailHeading}><div><div className={s.badgeRow}><SkillBadge type={detail.test.type} /><StatusBadge status={detail.test.status} /></div>
          <h1>{detail.test.title}</h1><p>{detail.test.description || "Chưa có mô tả đề thi."}</p><small className={s.muted}>Cập nhật {dateLabel(detail.test.updated_at)}</small></div>
          <div className={s.headingActions}>{preview && <Link className={s.secondary} href={versionUrl(preview.id) + "/preview"}><AdminIcon name="eye" />Xem trước</Link>}
            <TestActions test={detail.test} onComplete={resource.refresh} /></div></section>
        <MetadataForm key={detail.test.updated_at} test={detail.test} canChangeType={canChangeType} onSaved={resource.refresh} />
        {draft.error && <Alert danger>Chưa kiểm tra được điều kiện đổi kỹ năng. <button className={s.textButton} type="button" onClick={() => void draft.refresh()}>Thử lại</button></Alert>}
        <section className={s.card}><div className={s.sectionHeading}><span className={s.headingIcon}><AdminIcon name="history" /></span><div><h2>Danh sách phiên bản</h2><p>Nội dung và kết quả được giữ theo từng phiên bản của đề.</p></div><span className={s.badge}>{detail.versions.length} phiên bản</span></div>
          <div className={s.tableScroll}><table className={s.table}><thead><tr><th>Phiên bản</th><th>Trạng thái</th><th>Chế độ</th><th>Lượt làm</th><th>Ngày tạo / Xuất bản</th><th>Thao tác</th></tr></thead>
            <tbody>{detail.versions.map((version) => <tr key={version.id}>
              <td><strong>Phiên bản {version.version_number}</strong>{version.id === detail.test.current_version?.id && <small className={s.cellHint}>Hiện hành</small>}</td>
              <td><StatusBadge status={version.status} /></td><td><ModeBadges modes={version.modes} /></td><td>{version.attempt_count.toLocaleString("vi-VN")} lượt</td>
              <td className={s.dateCell}>{dateLabel(version.created_at)}<small className={s.cellHint}>{version.published_at ? "Xuất bản: " + dateLabel(version.published_at) : "Chưa xuất bản"}</small></td>
              <td><div className={s.rowActions}><Link className={version.status === "DRAFT" && detail.test.visibility !== "ARCHIVED" ? s.primarySmall : s.secondarySmall} href={versionUrl(version.id)}>
                <AdminIcon name={version.status === "DRAFT" ? "edit" : "book"} />{version.status === "DRAFT" && detail.test.visibility !== "ARCHIVED" ? "Soạn nội dung" : "Xem nội dung"}</Link>
                <Link className={s.textButton} href={versionUrl(version.id) + "/preview"}><AdminIcon name="eye" />Xem trước</Link></div></td>
            </tr>)}</tbody></table></div>
          {detail.versions.length === 0 && <Empty title="Chưa có phiên bản" />}
          <Alert>Xuất bản một phiên bản mới không thay đổi lượt làm và kết quả đã lưu của phiên bản cũ.</Alert>
        </section>
      </>}
  </AdminShell>;
}

function MetadataForm({ test, canChangeType, onSaved }: { test: AdminTest; canChangeType: boolean; onSaved: () => Promise<unknown> }) {
  const { setDirty, confirmLeave } = useAdmin();
  const [title, setTitle] = useState(test.title);
  const [description, setDescription] = useState(test.description ?? "");
  const [type, setType] = useState(test.type);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = !saved && (title !== test.title || description !== (test.description ?? "") || type !== test.type);
  useDraftGuard(dirty);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !dirty) return;
    if (!title.trim()) { setError("Tên đề không được để trống."); return; }
    setBusy(true); setError(null);
    try {
      await adminApi("/api/admin/tests/" + test.id, { method: "PATCH", ...body({ title: title.trim(), description: description.trim() || null, ...(canChangeType && type !== test.type ? { type } : {}) }) });
      setSaved(true); setDirty(false); await onSaved();
    } catch (err) { setError(adminError(err)); }
    finally { setBusy(false); }
  }
  return <form className={s.card} onSubmit={submit}><div className={s.sectionHeading}><span className={s.headingIcon}><AdminIcon name="settings" /></span><div><h2>Thông tin chung</h2><p>Tên và mô tả hiển thị trong danh sách đề dành cho học viên.</p></div></div>
    {error && <Alert danger>{error}</Alert>}<fieldset disabled={busy} className={s.fields}><div className={s.formGrid}>
      <label className={s.field}><span>Tên đề thi <b>*</b><small>{title.length}/200</small></span><input required maxLength={200} value={title} onChange={(event) => { setSaved(false); setTitle(event.target.value); }} /></label>
      <label className={s.field}><span>Kỹ năng</span><select disabled={!canChangeType} value={type} onChange={(event) => { setSaved(false); setType(event.target.value as typeof type); }}><option value="READING">Reading</option><option value="LISTENING">Listening</option></select>
        <small>Chỉ đổi khi đề chưa từng xuất bản và chưa có section.</small></label></div>
      <label className={s.field}><span>Mô tả đề thi</span><textarea rows={4} maxLength={5000} value={description} onChange={(event) => { setSaved(false); setDescription(event.target.value); }} /></label>
    </fieldset><div className={s.metadataFacts}><div><small>Quyền truy cập</small><strong>{({ PUBLIC: "Công khai", PRIVATE: "Riêng tư", ASSIGNED: "Được giao" })[test.access_type]}</strong></div>
      <div><small>Ngày tạo</small><strong>{dateLabel(test.created_at)}</strong></div><div><small>Phiên bản hiện hành</small><strong>{test.current_version ? "Phiên bản " + test.current_version.version_number : "Chưa xuất bản"}</strong></div></div>
    <div className={s.formFooter}><span className={s.muted}>{dirty ? "Có thay đổi chưa lưu" : "Thông tin đã lưu"}</span><button className={s.secondary} type="button" disabled={busy || !dirty} onClick={() => confirmLeave(() => { setTitle(test.title); setDescription(test.description ?? ""); setType(test.type); setError(null); })}>Hủy thay đổi</button>
      <button className={s.primary} type="submit" disabled={busy || !dirty}><AdminIcon name="save" />{busy ? "Đang lưu…" : "Lưu thông tin"}</button></div>
  </form>;
}
