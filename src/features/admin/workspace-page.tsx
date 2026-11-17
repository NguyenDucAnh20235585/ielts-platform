"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SkillBadge } from "@/features/student/ui";
import { Markdown } from "@/features/student/markdown";
import { AdminIcon } from "./admin-icons";
import { useAdmin } from "./admin-context";
import { adminApi, adminError, AdminApiError, body, useAdminResource } from "./client-api";
import { Alert, ConfirmModal, Empty, StatusBadge } from "./admin-ui";
import { GroupForm, MediaAudio, QuestionForm, SectionForm } from "./content-forms";
import { SettingsForm } from "./settings-form";
import { ValidationPanel } from "./validation-panel";
import { numberLabel, testUrl, versionUrl, type VersionEditor, type ValidationReport, type ValidationIssue, type AdminSection, type AdminGroup, type AdminQuestion } from "./client-types";
import s from "./admin.module.css";

type Cursor = { kind: "section" | "group" | "question"; id?: string; sectionId?: string; groupId?: string };
type Tab = "content" | "settings" | "validation";
export function AdminWorkspacePage({ versionId }: { versionId: string }) {
  const { user, dirty, setDirty, confirmLeave } = useAdmin();
  const url = "/api/admin/test-versions/" + encodeURIComponent(versionId);
  const resource = useAdminResource<VersionEditor>(url);
  const version = resource.data;
  const [cursor, setCursor] = useState<Cursor>({ kind: "section" });
  const [tab, setTab] = useState<Tab>("content");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [publish, setPublish] = useState(false);
  const [deleting, setDeleting] = useState<Cursor | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [showPassage, setShowPassage] = useState(false);
  useEffect(() => {
    if (!version) return;
    // Chỉ chọn section mặc định khi tải lần đầu, không đổi lựa chọn sau mỗi lần lưu.
    setCursor((current) => current.id || current.sectionId || current.groupId || revision > 0 ? current :
      version.sections[0] ? { kind: "section", id: version.sections[0].id, sectionId: version.sections[0].id } : current);
  }, [version, revision]);
  const readOnly = version?.status !== "DRAFT" || version.test.status === "ARCHIVED";
  const section = version?.sections.find((item) => item.id === (cursor.kind === "section" ? cursor.id : cursor.sectionId));
  const group = section?.question_groups.find((item) => item.id === (cursor.kind === "group" ? cursor.id : cursor.groupId));
  const question = group?.questions.find((item) => item.id === cursor.id);
  const selectedNode = cursor.kind === "section" ? section : cursor.kind === "group" ? group : question;
  const allQuestions = version?.sections.flatMap((item) => item.question_groups.flatMap((node) => node.questions)) ?? [];
  const totalMarks = allQuestions.reduce((sum, item) => sum + item.marks, 0);

  function select(next: Cursor) {
    if (busy) return;
    confirmLeave(() => { setCursor(next); setTreeOpen(false); setShowPassage(false); setError(null); setRevision((value) => value + 1); });
  }
  function changeTab(next: Tab) {
    if (busy || next === tab) return;
    confirmLeave(() => { setTab(next); setRevision((value) => value + 1); setError(null); });
  }
  async function mutate<T>(path: string, method: string, payload?: Record<string, unknown>): Promise<T> {
    setBusy(true); setError(null); setMessage(null);
    try {
      const result = await adminApi<T>(path, { method, ...(payload ? body(payload) : {}) });
      setDirty(false); setReport(null);
      return result;
    } finally { setBusy(false); }
  }
  async function saved() {
    setBusy(true);
    setMessage("Đã lưu thay đổi.");
    try {
      await resource.refresh();
      setRevision((value) => value + 1);
    } finally { setBusy(false); }
  }
  async function saveNode(payload: Record<string, unknown>) {
    const kind = cursor.kind;
    const path = cursor.id ? kind === "section" ? "/api/admin/sections/" + cursor.id : kind === "group" ? "/api/admin/question-groups/" + cursor.id : "/api/admin/questions/" + cursor.id :
      kind === "section" ? url + "/sections" : kind === "group" ? "/api/admin/sections/" + cursor.sectionId + "/question-groups" : "/api/admin/question-groups/" + cursor.groupId + "/questions";
    const result = await mutate<AdminSection | AdminGroup | AdminQuestion>(path, cursor.id ? "PATCH" : "POST", payload);
    setCursor({ ...cursor, id: result.id, ...(kind === "section" ? { sectionId: result.id } : kind === "group" ? { groupId: result.id } : {}) });
    await saved();
  }
  async function validate(openPublish = false) {
    if (busy || dirty) return;
    setBusy(true); setError(null);
    try {
      const data = await adminApi<ValidationReport>(url + "/validate", { method: "POST" });
      setReport(data);
      if (openPublish && data.valid && !readOnly) setPublish(true);
      else if (openPublish) setTab("validation");
    } catch (err) { setError(adminError(err)); }
    finally { setBusy(false); }
  }
  function locate(issue: ValidationIssue) {
    if (issue.code === "NO_MODE_ENABLED") { changeTab("settings"); return; }
    let target: Cursor = { kind: "section" };
    for (const node of version?.sections ?? []) {
      if (node.id === issue.section_id) target = { kind: "section", id: node.id, sectionId: node.id };
      for (const item of node.question_groups) {
        if (item.id === issue.group_id) target = { kind: "group", id: item.id, sectionId: node.id, groupId: item.id };
        const found = item.questions.find((value) => value.id === issue.question_id);
        if (found) target = { kind: "question", id: found.id, sectionId: node.id, groupId: item.id };
      }
    }
    confirmLeave(() => { setTab("content"); setCursor(target); setRevision((value) => value + 1); });
  }
  if (!version) return <div className={s.workspaceGate}><Link className={s.backLink} href="/admin/tests"><AdminIcon name="back" />Danh sách đề</Link>
    {message && <Alert>{message} Tải lại nội dung để xem dữ liệu mới nhất.</Alert>}
    <Empty loading={resource.loading} title={resource.loading ? "Đang tải trình soạn…" : "Chưa thể tải phiên bản"} description={resource.error} onRetry={resource.error ? () => void resource.refresh() : undefined} /></div>;
  const kindLabel = cursor.kind === "section" ? version.test.type === "READING" ? "passage" : "section" : cursor.kind === "group" ? "nhóm câu hỏi" : "câu hỏi";
  const editorKey = (cursor.id ?? "new") + cursor.kind + revision;
  return <div className={s.workspace} aria-busy={busy || resource.loading}>
    <header className={s.workspaceHeader}><Link className={s.backLink} href={testUrl(version.test.id)}><AdminIcon name="back" /><span>Chi tiết đề</span></Link>
      <span className={s.headerDivider} /><h1 title={version.test.title}>{version.test.title}</h1><SkillBadge type={version.test.type} />
      <span className={s.badge}>Phiên bản {version.version_number}</span><StatusBadge status={version.status} />
      <span className={s.saveState} aria-live="polite"><AdminIcon name={dirty ? "edit" : "check"} />{busy || resource.loading ? "Đang xử lý…" : dirty ? "Có thay đổi chưa lưu" : "Nội dung đã lưu"}</span>
      <span className={s.avatar} title={user.profile.display_name ?? user.email ?? "Admin"}><AdminIcon name="user" /></span>
    </header>
    <div className={s.workspaceToolbar}><nav className={s.workspaceTabs} aria-label="Trình soạn phiên bản">
      {([["content", "Nội dung", "edit"], ["settings", "Cấu hình Practice/Mock", "settings"], ["validation", "Kiểm tra trước xuất bản", "shield"]] as const).map(([value, label, icon]) =>
        <button type="button" key={value} disabled={busy || resource.loading} aria-pressed={tab === value} className={tab === value ? s.tabActive : ""} onClick={() => changeTab(value)}><AdminIcon name={icon} />{label}
          {value === "validation" && report && <span className={report.valid ? s.badgeTeal : s.badgeRed}>{report.errors.length} lỗi · {report.warnings.length} cảnh báo</span>}</button>)}
    </nav><div className={s.toolbarActions}>
      <Link className={s.secondarySmall} href={versionUrl(version.id) + "/preview"}><AdminIcon name="eye" />Xem trước</Link>
      {!readOnly && tab !== "validation" && <button className={s.secondarySmall} type="submit" form="admin-editor-form" disabled={busy || resource.loading}><AdminIcon name="save" />Lưu thay đổi</button>}
      {!readOnly && <button className={s.primarySmall} type="button" disabled={busy || dirty || resource.loading} title={dirty ? "Lưu nội dung trước khi xuất bản" : undefined} onClick={() => void validate(true)}><AdminIcon name="publish" />Xuất bản</button>}
    </div></div>
    {(readOnly || message || error || version.test.status === "HIDDEN") && <div className={s.workspaceNotices}>
      {readOnly && <Alert>Phiên bản hoặc đề đã khóa chỉnh sửa. Bạn vẫn có thể xem nội dung, đáp án, cấu hình và preview.</Alert>}
      {version.test.status === "HIDDEN" && <Alert>Đề đang ẩn. Xuất bản phiên bản không tự hiện lại đề.</Alert>}
      {message && <div className={s.success} role="status"><AdminIcon name="check" />{message}<button className={s.iconButton} type="button" onClick={() => setMessage(null)} aria-label="Đóng thông báo"><AdminIcon name="close" /></button></div>}
      {error && <Alert danger>{error}</Alert>}
    </div>}
    {tab === "content" ? <>
      <div className={s.contentSummary}><button className={s.mobileOnly + " " + s.secondarySmall} type="button" aria-expanded={treeOpen} onClick={() => setTreeOpen(!treeOpen)}><AdminIcon name="menu" />Cấu trúc đề</button>
        <span><AdminIcon name={version.test.type === "READING" ? "book" : "headphones"} />{version.sections.length} {version.test.type === "READING" ? "passage" : "section"}</span>
        <span>{allQuestions.length} mục câu hỏi · {totalMarks} điểm tối đa</span>
        {section && <button className={s.passageToggle} type="button" aria-pressed={showPassage} onClick={() => setShowPassage(!showPassage)}><AdminIcon name="book" />{showPassage ? "Đóng nội dung tham chiếu" : "Nội dung tham chiếu"}</button>}
      </div>
      <div className={[s.contentGrid, showPassage ? s.showReference : ""].join(" ")} inert={busy || resource.loading}>
        {treeOpen && <button className={s.sidebarBackdrop} type="button" aria-label="Đóng cấu trúc đề" onClick={() => setTreeOpen(false)} />}
        <aside className={[s.contentTree, treeOpen ? s.treeOpen : ""].join(" ")} aria-label="Cấu trúc nội dung">
          <div className={s.treeHeading}><h2>Cấu trúc đề</h2>{!readOnly && <button className={s.secondarySmall} type="button" disabled={busy} onClick={() => select({ kind: "section" })}><AdminIcon name="plus" />{version.test.type === "READING" ? "Passage" : "Section"}</button>}</div>
          {!version.sections.length && <p className={s.muted}>Chưa có section. Thêm nội dung đầu tiên để bắt đầu.</p>}
          {version.sections.map((node) => <div className={s.treeSection} key={node.id}>
            <button className={[s.treeSectionButton, section?.id === node.id ? s.treeActive : ""].join(" ")} type="button" disabled={busy} onClick={() => select({ kind: "section", id: node.id, sectionId: node.id })}>
              <strong>{version.test.type === "READING" ? "Passage " : "Section "}{node.order_no}</strong><span className={s.badge}>{node.numbers ? numberLabel(node.numbers) : "Chưa có câu"}</span><small>{node.title || "Chưa có tiêu đề"}</small></button>
            {section?.id === node.id && <div className={s.treeGroups}>{node.question_groups.map((item) => <div key={item.id}>
              <button className={[s.treeGroupButton, group?.id === item.id && cursor.kind === "group" ? s.treeActive : ""].join(" ")} type="button" disabled={busy}
                onClick={() => select({ kind: "group", id: item.id, sectionId: node.id, groupId: item.id })}><AdminIcon name="questions" /><span>Nhóm {item.order_no}</span><small>{numberLabel(item.questions.flatMap((q) => q.numbers))}</small></button>
              {(group?.id === item.id || !group && cursor.kind === "section") && <div className={s.treeQuestions}>{item.questions.map((q) => <button key={q.id}
                className={[s.treeQuestionButton, cursor.kind === "question" && cursor.id === q.id ? s.treeQuestionActive : ""].join(" ")} type="button" disabled={busy}
                onClick={() => select({ kind: "question", id: q.id, sectionId: node.id, groupId: item.id })}>
                <span>Câu {numberLabel(q.numbers)}</span>{q.answer_key ? <span className={s.answerHint}>Có đáp án</span> : <span className={s.missingKey}>Thiếu đáp án</span>}</button>)}
                {!readOnly && <button className={s.treeAdd} type="button" disabled={busy} onClick={() => select({ kind: "question", sectionId: node.id, groupId: item.id })}><AdminIcon name="plus" />Thêm câu hỏi</button>}</div>}
            </div>)}
              {!readOnly && <button className={s.treeAdd} type="button" disabled={busy} onClick={() => select({ kind: "group", sectionId: node.id })}><AdminIcon name="plus" />Thêm nhóm câu hỏi</button>}
            </div>}
          </div>)}
        </aside>
        <section className={s.referencePane} aria-label="Nội dung tham chiếu" tabIndex={0}>
          {section ? <><div className={s.referenceHeader}><span className={s.eyebrow}>{version.test.type === "READING" ? "Passage " : "Section "}{section.order_no} · Nội dung đã lưu</span>
            <button className={s.textButton} type="button" disabled={busy} onClick={() => select({ kind: "section", id: section.id, sectionId: section.id })}><AdminIcon name="edit" />{readOnly ? "Thông tin section" : "Sửa nội dung"}</button></div>
            <h2>{section.title || (version.test.type === "READING" ? "Reading Passage " : "Listening Section ") + section.order_no}</h2>
            <div className={s.referenceInstruction}><Markdown text={section.instruction} /></div>
            {version.test.type === "READING" ? section.content ? <Markdown text={section.content} passage /> : <Alert>Passage chưa có nội dung. Chọn Sửa nội dung để bổ sung.</Alert> :
              section.audio ? <MediaAudio key={section.audio.url} url={section.audio.url} /> : <Alert>{section.audio_object_key ? "Chưa có URL audio khả dụng. Kiểm tra cấu hình storage." : "Section chưa gắn audio."}</Alert>}
            <div className={s.referenceGroups}><h3>Nhóm câu hỏi trong section</h3>{section.question_groups.map((item) =>
              <button className={s.referenceGroup} type="button" key={item.id} disabled={busy} onClick={() => select({ kind: "group", id: item.id, sectionId: section.id, groupId: item.id })}><strong>Nhóm {item.order_no}</strong><span>{numberLabel(item.questions.flatMap((q) => q.numbers))}</span><small>{item.instruction}</small><AdminIcon name="chevron" /></button>)}</div>
          </> : <Empty title={version.sections.length ? "Thêm nội dung mới" : "Bắt đầu biên soạn đề"} description="Cấu trúc gồm section, nhóm câu hỏi và câu hỏi. Nội dung nháp có thể được hoàn thiện dần." />}
        </section>
        <section className={s.inspector} aria-label="Form soạn nội dung">
          {cursor.kind === "section" ? !readOnly || section ? <SectionForm key={editorKey} section={section} skill={version.test.type} readOnly={readOnly} siblingCount={version.sections.length} onSave={saveNode} /> : <Empty title="Chọn nội dung để xem" /> :
            cursor.kind === "group" && section ? <GroupForm key={editorKey} group={group} readOnly={readOnly} siblingCount={section.question_groups.length} onSave={saveNode} /> :
            cursor.kind === "question" && group ? <QuestionForm key={editorKey} question={question} group={group} readOnly={readOnly} siblingCount={group.questions.length} onSave={saveNode}
              onSaveKey={async (payload) => { await mutate("/api/admin/questions/" + question!.id + "/answer-key", "PUT", payload); await saved(); }} /> :
              <Empty title="Chọn nhóm câu hỏi" description="Chọn nhóm trong cây nội dung để tiếp tục soạn." />}
          {!readOnly && selectedNode && <div className={s.deleteNode}><button className={s.dangerLink} type="button" disabled={busy} onClick={() => confirmLeave(() => setDeleting(cursor))}><AdminIcon name="trash" />Xóa {kindLabel}</button></div>}
        </section>
      </div>
    </> : <div className={s.workspacePage}>
      {tab === "settings" ? <div inert={busy || resource.loading}><SettingsForm key={"settings" + revision} version={version} readOnly={readOnly} onSave={async (payload) => { await mutate(url, "PATCH", payload); await saved(); }} /></div> :
        <ValidationPanel report={report} version={version} busy={busy} readOnly={readOnly} onValidate={() => void validate()} onPublish={() => void validate(true)} onLocate={locate} />}
    </div>}
    {deleting && <ConfirmModal title={"Xóa " + kindLabel} label={"Xóa " + kindLabel} danger
      description={deleting.kind === "section" ? "Passage/section này cùng tất cả nhóm, câu hỏi và đáp án bên trong sẽ bị xóa. Thứ tự các section sau sẽ được cập nhật." : deleting.kind === "group" ? "Nhóm này cùng các câu hỏi và đáp án bên trong sẽ bị xóa." : "Câu hỏi và đáp án của câu sẽ bị xóa. Số tự động của các câu sau có thể thay đổi."}
      onClose={() => setDeleting(null)} onConfirm={async () => {
        const path = deleting.kind === "section" ? "/api/admin/sections/" : deleting.kind === "group" ? "/api/admin/question-groups/" : "/api/admin/questions/";
        await mutate(path + deleting.id, "DELETE");
        setCursor(deleting.kind === "section" ? { kind: "section" } : { kind: "section", id: deleting.sectionId, sectionId: deleting.sectionId });
        await saved();
      }} />}
    {publish && <ConfirmModal title="Xuất bản phiên bản" label="Xuất bản" onClose={() => setPublish(false)}
      description={"Xuất bản Phiên bản " + version.version_number + " của “" + version.test.title + "”. Nội dung và cấu hình sẽ khóa; phiên bản hiện hành trước đó chuyển sang lưu trữ. Lượt làm và kết quả cũ được giữ nguyên." +
        (report?.warnings.length ? " Còn " + report.warnings.length + " cảnh báo không chặn xuất bản." : "") + (version.test.status === "HIDDEN" ? " Đề sẽ tiếp tục được ẩn." : "")}
      onConfirm={async () => {
        try { await mutate(url + "/publish", "POST"); setMessage("Đã xuất bản phiên bản. Nội dung và cấu hình hiện chỉ đọc."); setRevision((value) => value + 1); await resource.refresh(); }
        catch (err) {
          if (err instanceof AdminApiError && err.code === "VALIDATION_FAILED" && err.details && typeof err.details === "object" && "errors" in err.details) {
            setReport(err.details as ValidationReport); setTab("validation"); setPublish(false); setError(adminError(err));
          }
          throw err;
        }
      }} />}
  </div>;
}
