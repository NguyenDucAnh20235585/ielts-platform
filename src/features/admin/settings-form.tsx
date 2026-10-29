"use client";

import { useState, type FormEvent } from "react";
import { useAdmin, useDraftGuard } from "./admin-context";
import { AdminIcon } from "./admin-icons";
import { Alert } from "./admin-ui";
import { adminError } from "./client-api";
import type { ModeSettings, ModeSettingsMap, VersionEditor } from "./client-types";
import type { SaveNode } from "./content-forms";
import s from "./admin.module.css";

export function SettingsForm({ version, readOnly, onSave }: { version: VersionEditor; readOnly: boolean; onSave: SaveNode }) {
  const { setDirty } = useAdmin();
  const [settings, setSettings] = useState<ModeSettingsMap>(version.settings);
  const [baseline] = useState(() => JSON.stringify(version.settings));
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(settings) !== baseline && JSON.stringify(settings) !== saved;
  useDraftGuard(dirty);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || readOnly) return;
    if (!settings.practice.enabled && !settings.mock.enabled) { setError("Phải bật ít nhất một chế độ."); return; }
    for (const mode of ["practice", "mock"] as const) {
      const value = settings[mode];
      if (mode === "mock" && value.duration_seconds === null || value.duration_seconds !== null && (value.duration_seconds < 60 || value.duration_seconds > 14400)) { setError("Thi thử cần có thời gian. Giới hạn thời gian nếu đặt phải từ 1 đến 240 phút."); return; }
      if (mode === "mock" && value.answer_visibility === "IMMEDIATELY_IN_PRACTICE") { setError("Thi thử không cho phép hiển thị đáp án ngay trong Practice."); return; }
      if (value.max_attempts !== null && (!Number.isInteger(value.max_attempts) || value.max_attempts < 1) || value.max_plays !== null && (!Number.isInteger(value.max_plays) || value.max_plays < 1)) { setError("Số lượt làm và số lần phát phải là số nguyên từ 1 trở lên."); return; }
    }
    setBusy(true); setError(null);
    try { await onSave(settings); setSaved(JSON.stringify(settings)); setDirty(false); }
    catch (err) { setError(adminError(err)); }
    finally { setBusy(false); }
  }
  const totalMarks = version.sections.flatMap((section) => section.question_groups.flatMap((group) => group.questions)).reduce((sum, question) => sum + question.marks, 0);
  return <form id="admin-editor-form" className={s.settingsPage} onSubmit={submit}>
    <div className={s.sectionHeading}><span className={s.headingIcon}><AdminIcon name="settings" /></span><div><h2>Cấu hình Practice / Mock</h2><p>Thiết lập điều kiện làm bài riêng cho từng chế độ.</p></div></div>
    {readOnly && <Alert>Phiên bản này chỉ đọc. Nội dung và cấu hình đã được khóa.</Alert>}
    {error && <Alert danger>{error}</Alert>}
    <fieldset disabled={readOnly || busy} className={s.modeGrid}>
      {(["practice", "mock"] as const).map((mode) => <ModeCard key={mode} mode={mode} value={settings[mode]} listening={version.test.type === "LISTENING"}
        onChange={(value) => setSettings((current) => ({ ...current, [mode]: value }))} />)}
    </fieldset>
    <section className={s.card}><div className={s.sectionHeading}><span className={s.headingIcon}><AdminIcon name="questions" /></span><div><h2>Bảng quy đổi band</h2><p>Dữ liệu chỉ đọc từ hệ thống · {version.band_conversion.source === "CUSTOM" ? "Bảng tùy chỉnh" : "Bảng mặc định"}.</p></div><span className={s.badge}>{totalMarks} điểm tối đa</span></div>
      {totalMarks !== 40 && <Alert>Tổng điểm khác 40: hệ thống chấm raw score và không có band score. Cảnh báo này không chặn xuất bản.</Alert>}
      <div className={s.bandGrid}>{version.band_conversion.ranges.map((range) => <div key={range.min_raw}><span>{range.min_raw === range.max_raw ? range.min_raw : range.min_raw + "–" + range.max_raw} điểm</span><strong>{range.band.toFixed(1)}</strong></div>)}</div>
    </section>
    {!readOnly && <div className={s.formFooter}><span className={s.muted}>{dirty ? "Có thay đổi chưa lưu" : "Cấu hình đã lưu"}</span><button className={s.primary} type="submit" disabled={busy || !dirty}><AdminIcon name="save" />{busy ? "Đang lưu…" : "Lưu cấu hình"}</button></div>}
  </form>;
}
function ModeCard({ mode, value, onChange, listening }: { mode: "practice" | "mock"; value: ModeSettings; onChange: (value: ModeSettings) => void; listening: boolean }) {
  const patch = (changes: Partial<ModeSettings>) => onChange({ ...value, ...changes });
  const mock = mode === "mock";
  return <section className={[s.modeCard, value.enabled ? "" : s.modeDisabled].join(" ")}>
    <header><span className={s.headingIcon}><AdminIcon name={mock ? "clock" : "book"} /></span><div><h3>{mock ? "Thi thử" : "Luyện tập"}</h3><p>{mock ? "Mock Test" : "Practice"}</p></div>
      <label className={s.switch}><input type="checkbox" checked={value.enabled} onChange={(event) => patch({ enabled: event.target.checked })} aria-label={mock ? "Bật chế độ Thi thử" : "Bật chế độ Luyện tập"} /><span /></label></header>
    <p className={s.modeDescription}>{mock ? "Có giới hạn thời gian và chính sách đáp án riêng." : "Luyện tập theo cấu hình thời gian và số lượt của đề."}</p>
    <div className={s.fields}>
      <div className={s.ruleBox}><h4>Thời gian làm bài</h4>{!mock && <label className={s.checkbox}><input type="checkbox" checked={value.duration_seconds === null} onChange={(event) => patch({ duration_seconds: event.target.checked ? null : 3600 })} />Không giới hạn thời gian</label>}
        <label className={s.field}><span>{mock ? "Thời gian bắt buộc" : "Thời gian giới hạn"} (phút)</span><input type="number" min={1} max={240} step="any" required={mock} disabled={value.duration_seconds === null} value={value.duration_seconds === null ? "" : Number((value.duration_seconds / 60).toFixed(3))}
          onChange={(event) => patch({ duration_seconds: event.target.value ? Math.round(Number(event.target.value) * 60) : null })} /><small>Cho phép từ 1 đến 240 phút.</small></label></div>
      <div className={s.ruleBox}><h4>Số lượt làm tối đa</h4><label className={s.checkbox}><input type="checkbox" checked={value.max_attempts === null} onChange={(event) => patch({ max_attempts: event.target.checked ? null : 1 })} />Không giới hạn lượt làm</label>
        <label className={s.field}><span>Số lượt / học viên</span><input type="number" min={1} step={1} disabled={value.max_attempts === null} required={value.max_attempts !== null} value={value.max_attempts ?? ""} onChange={(event) => patch({ max_attempts: Number(event.target.value) })} /></label></div>
      <label className={s.field}><span>Chính sách xem đáp án</span><select value={value.answer_visibility} onChange={(event) => patch({ answer_visibility: event.target.value as ModeSettings["answer_visibility"] })}>
        <option value="NEVER">Không hiển thị</option><option value="AFTER_SUBMIT">Sau khi nộp bài</option>{!mock && <option value="IMMEDIATELY_IN_PRACTICE">Ngay trong Practice</option>}
      </select><small>Quyền xem đáp án và lời giải do hệ thống quyết định theo cấu hình.</small></label>
      {listening && <div className={s.ruleBox}><h4>Chính sách audio</h4>
        {[["allow_pause", "Cho phép pause"], ["allow_replay", "Cho phép phát lại"], ["allow_seek", "Cho phép tua audio"]].map(([key, label]) =>
          <label className={s.checkbox} key={key}><input type="checkbox" checked={value[key as "allow_pause" | "allow_replay" | "allow_seek"]} onChange={(event) => patch({ [key]: event.target.checked })} />{label}</label>)}
        <label className={s.checkbox}><input type="checkbox" checked={value.max_plays === null} onChange={(event) => patch({ max_plays: event.target.checked ? null : 1 })} />Không giới hạn số lần phát</label>
        <label className={s.field}><span>Số lần phát tối đa</span><input type="number" min={1} step={1} disabled={value.max_plays === null} required={value.max_plays !== null} value={value.max_plays ?? ""} onChange={(event) => patch({ max_plays: Number(event.target.value) })} /></label>
      </div>}
    </div>
  </section>;
}
