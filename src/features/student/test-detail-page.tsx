"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { studentApi, jsonBody, errorText, StudentApiError } from "./api";
import { useResource } from "./use-resource";
import { StudentShell } from "./student-shell";
import { Badge, Notice, SkillBadge, StatusPanel } from "./ui";
import { StudentIcon } from "./student-icons";
import { dateLabel, durationLabel, modeLabel } from "./format";
import type { Mode, ModeOption, StartPayload, TestDetail } from "./types";
import s from "./student.module.css";

export function TestDetailPage({ testId, initialMode = null }: { testId: string; initialMode?: Mode | null }) {
  const router = useRouter();
  const resource = useResource<TestDetail>("/api/tests/" + encodeURIComponent(testId));
  const [selected, setSelected] = useState<Mode | null>(initialMode);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const test = resource.data;
  const mode = test?.modes.find((item) => item.mode === (selected ?? test.active_attempt?.mode)) ?? test?.modes[0];
  async function start() {
    if (!test || !mode || starting) return;
    if (test.active_attempt) { router.push("/student/attempts/" + test.active_attempt.attempt_id); return; }
    setStarting(true); setError(null);
    try {
      const data = await studentApi<StartPayload>("/api/tests/" + testId + "/attempts", { method: "POST", body: jsonBody({ mode: mode.mode }) });
      router.push("/student/attempts/" + data.attempt.id + "/prepare");
    } catch (err) {
      if (err instanceof StudentApiError && err.code === "ACTIVE_ATTEMPT_EXISTS" && typeof err.details?.attempt_id === "string") {
        router.push("/student/attempts/" + err.details.attempt_id);
      } else setError(errorText(err));
      setStarting(false);
    }
  }
  return <StudentShell>
    <nav className={s.breadcrumb} aria-label="Đường dẫn"><Link href="/student/tests"><StudentIcon name="library" width="16" height="16" />Thư viện đề</Link><span>›</span><strong className={s.oneLine}>{test?.title ?? "Chi tiết đề"}</strong></nav>
    {resource.loading ? <StatusPanel loading /> : resource.error ? <StatusPanel title="Chưa thể mở đề" description={resource.error.message} onRetry={resource.reload} />
      : test && <>
        <section className={s.detailHero}>
          <div className={s.detailMain}>
            <div className={s.tagRow}><SkillBadge type={test.type} /><Badge>{test.section_count} {test.type === "READING" ? "Passages" : "Sections"}</Badge><Badge>{test.question_count} câu hỏi</Badge><Badge teal>Phiên bản {test.latest_version.version_number}</Badge></div>
            <h1 className={s.detailTitle} title={test.title}>{test.title}</h1>
            <p>{test.description || "Lựa chọn chế độ phù hợp với nhu cầu luyện tập của bạn."}</p>
            <div className={s.detailFacts}>
              <div><span>Thời lượng</span><strong>{durationLabel(mode?.duration_seconds ?? null)}</strong></div>
              <div><span>Số câu</span><strong>{test.question_count} câu hỏi</strong></div>
              <div><span>Số phần</span><strong>{test.section_count} phần</strong></div>
              <div><span>Lượt còn lại</span><strong>{mode?.attempts_remaining === null ? "Không giới hạn" : mode?.attempts_remaining ?? "—"}</strong></div>
            </div>
          </div>
          <aside className={s.detailAside}><h2><StudentIcon name="shield" />Thông tin đề</h2><p>Kết quả được chấm sau khi bạn nộp bài. Quyền xem đáp án và lời giải phụ thuộc vào chế độ đã chọn.</p>
            <span><StudentIcon name="history" width="16" height="16" />Xuất bản: {dateLabel(test.latest_version.published_at).split(" · ")[0]}</span>
          </aside>
        </section>
        {test.active_attempt && <div className={s.activeAttempt}>
          <span className={s.activeIcon}><StudentIcon name="history" width="26" height="26" /></span>
          <div><strong>Bạn có một bài chưa hoàn tất <Badge teal>{test.active_attempt.status === "CREATED" ? "Đang chuẩn bị" : "Đang làm"}</Badge></strong>
            <p>Tiếp tục lần làm bài {modeLabel(test.active_attempt.mode).toLowerCase()} hiện tại để giữ tiến trình và thời gian đã bắt đầu.</p></div>
          <Link className={s.tealButton} href={"/student/attempts/" + test.active_attempt.attempt_id}>Tiếp tục ngay<StudentIcon name="arrow" width="18" height="18" /></Link>
        </div>}
        <div className={s.sectionHeading}><span className={s.eyebrow}>TÙY CHỌN PHƯƠNG THỨC</span><h2>Chọn chế độ làm bài</h2><p>Lựa chọn luyện tập linh hoạt hoặc thi thử có giới hạn thời gian.</p></div>
        <div className={s.modeGrid} role="radiogroup" aria-label="Chế độ làm bài">
          {test.modes.map((item) => <ModeCard key={item.mode} mode={item} type={test.type} selected={mode?.mode === item.mode}
            disabled={Boolean(test.active_attempt && test.active_attempt.mode !== item.mode)} onSelect={() => { setSelected(item.mode); setError(null); }} />)}
        </div>
        <section className={s.structureCard}>
          <div className={s.sectionHeading}><h2>Cấu trúc bài thi</h2><p>Nội dung từng phần và câu hỏi được mở khi bạn bắt đầu làm bài.</p></div>
          <div className={s.structureGrid}>{Array.from({ length: test.section_count }, (_, i) =>
            <div key={i}><span className={s.sectionNumber}>{i + 1}</span><strong>{test.type === "READING" ? "Passage" : "Section"} {i + 1}</strong><StudentIcon name={test.type === "READING" ? "book" : "headphones"} /></div>)}</div>
        </section>
        {error && <Notice danger>{error}</Notice>}
        <div className={s.detailBar}>
          <Link href="/student/tests" className={s.backLink}><StudentIcon name="back" width="18" height="18" />Quay lại thư viện</Link>
          <span className={s.selectedMode}>Chế độ đã chọn: <strong>{mode ? modeLabel(mode.mode) : "—"}</strong></span>
          <button type="button" className={s.primaryButton} disabled={starting || !mode || (!test.active_attempt && mode.attempts_remaining === 0)} onClick={() => void start()}>
            {starting ? "Đang chuẩn bị…" : test.active_attempt ? "Tiếp tục làm bài" : mode?.attempts_remaining === 0 ? "Đã hết lượt làm" : "Chuẩn bị làm bài"}<StudentIcon name="arrow" width="18" height="18" />
          </button>
        </div>
      </>}
  </StudentShell>;
}
function ModeCard({ mode, selected, onSelect, disabled, type }: { mode: ModeOption; selected: boolean; onSelect: () => void; disabled: boolean; type: string }) {
  const mock = mode.mode === "MOCK";
  return <button className={[s.modeCard, selected ? s.modeSelected : ""].join(" ")} role="radio" aria-checked={selected} type="button" disabled={disabled} onClick={onSelect}>
    <div className={s.modeCardHeading}><span className={s.selectionDot} /><div><h3>Chế độ {modeLabel(mode.mode)}</h3><small>{mock ? "Mock Test Mode" : "Practice Mode"}</small></div><Badge teal={!mock}>{mock ? "Thi thử" : "Linh hoạt"}</Badge></div>
    <p>{mock ? "Làm quen với áp lực thời gian và hoàn tất bài trong thời lượng được quy định." : "Tập trung rèn kỹ năng đọc hiểu và nghe theo nhịp độ phù hợp với bạn."}</p>
    <ul>
      <li><StudentIcon name={mode.duration_seconds === null ? "infinity" : "clock"} />{mode.duration_seconds === null ? "Không giới hạn thời gian" : "Thời lượng: " + durationLabel(mode.duration_seconds)}</li>
      <li><StudentIcon name="cloud" />Tự lưu đáp án trong quá trình làm bài</li>
      <li><StudentIcon name="book" />{mode.answer_visibility === "NEVER" ? "Chỉ xem kết quả tổng quan sau khi nộp" : "Xem đáp án và lời giải sau khi nộp"}</li>
      {type === "LISTENING" && <li><StudentIcon name="headphones" />{mode.allow_replay ? "Cho phép nghe lại theo giới hạn của đề" : "Không nghe lại audio"}</li>}
    </ul>
    <div className={s.modeRemaining}><span>Số lượt còn lại:</span><strong>{mode.attempts_remaining === null ? "Không giới hạn" : mode.attempts_remaining === 0 ? "Đã hết lượt" : "Còn " + mode.attempts_remaining + " lượt"}</strong></div>
  </button>;
}
