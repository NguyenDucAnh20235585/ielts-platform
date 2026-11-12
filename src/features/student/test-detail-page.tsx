"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import FoundationIcon from "@/features/foundation/foundation-icons";
import { studentApi, jsonBody, errorText, StudentApiError } from "./api";
import { useResource } from "./use-resource";
import { useStudent } from "./student-context";
import { StudentThemeShell, StudentThemeStatus } from "./student-theme-shell";
import { StudentIcon } from "./student-icons";
import { dateLabel, durationLabel, modeLabel } from "./format";
import type { Mode, ModeOption, StartPayload, TestDetail } from "./types";
import s from "./test-detail.module.css";

export function TestDetailPage({ testId, initialMode = null }: { testId: string; initialMode?: Mode | null }) {
  const router = useRouter();
  const { user, logout } = useStudent();
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
  return (
    <StudentThemeShell user={user} onLogout={logout}>
      <div className={s.detail}>
        <nav className={s.breadcrumb} aria-label="Đường dẫn">
          <ol>
            <li><Link href="/student/tests"><StudentIcon name="library" width="16" height="16" />Thư viện đề</Link></li>
            <li className={s.breadcrumbCurrent}><span aria-hidden="true">/</span><span aria-current="page" title={test?.title}>{test?.title ?? "Chi tiết đề"}</span></li>
          </ol>
        </nav>

        {resource.loading ? (
          <StudentThemeStatus loading headingAs="h1" title="Đang tải chi tiết đề…" />
        ) : resource.error ? (
          <StudentThemeStatus error headingAs="h1" title="Chưa thể mở đề" description={resource.error.message} onRetry={resource.reload} />
        ) : !test ? (
          <StudentThemeStatus headingAs="h1" title="Không tìm thấy đề" description="Bạn có thể quay lại thư viện để chọn một đề khác.">
            <Link href="/student/tests" className={s.textLink}>Quay lại thư viện<StudentIcon name="arrow" width="16" height="16" /></Link>
          </StudentThemeStatus>
        ) : (
          <>
            <section className={s.hero} aria-labelledby="test-heading">
              <div className={s.heroMain}>
                <div className={s.heroHeading}>
                  <span className={s.skillIcon}><FoundationIcon name={test.type === "READING" ? "book" : "headphones"} width="30" height="30" strokeWidth="1.3" /></span>
                  <div className={s.skillDetails}>
                    <span className={s.skillName}>{test.type === "READING" ? "Reading" : "Listening"}</span>
                    <div className={s.tags}>
                      <span className={s.badge}>{test.section_count} {test.type === "READING" ? "Passages" : "Sections"}</span>
                      <span className={s.badge}>Phiên bản {test.latest_version.version_number}</span>
                    </div>
                  </div>
                </div>
                <h1 id="test-heading" className={s.title}>{test.title}</h1>
                <p className={s.description}>{test.description || "Lựa chọn chế độ phù hợp với nhu cầu luyện tập của bạn."}</p>
                <dl className={s.facts}>
                  <div><dt>Thời lượng</dt><dd>{mode ? durationLabel(mode.duration_seconds) : "—"}</dd></div>
                  <div><dt>Số câu</dt><dd>{test.question_count} câu hỏi</dd></div>
                  <div><dt>Số phần</dt><dd>{test.section_count} phần</dd></div>
                  <div><dt>Lượt còn lại</dt><dd className={mode?.attempts_remaining === 0 ? s.exhausted : undefined}>{mode?.attempts_remaining === null ? "Không giới hạn" : mode?.attempts_remaining ?? "—"}</dd></div>
                </dl>
              </div>
              <aside className={s.infoPanel} aria-labelledby="test-info-heading">
                <h2 id="test-info-heading"><StudentIcon name="shield" width="19" height="19" />Thông tin đề</h2>
                <p>Kết quả được chấm sau khi bạn nộp bài. Quyền xem đáp án và lời giải phụ thuộc vào chế độ đã chọn.</p>
                <div className={s.published}><StudentIcon name="history" width="16" height="16" /><span>Xuất bản: {dateLabel(test.latest_version.published_at).split(" · ")[0]}</span></div>
              </aside>
            </section>

            {test.active_attempt && (
              <section className={s.activeAttempt} aria-labelledby="active-attempt-heading">
                <span className={s.activeIcon}><StudentIcon name="history" width="24" height="24" /></span>
                <div className={s.activeDetails}>
                  <div className={s.activeHeading}><h2 id="active-attempt-heading">Bạn có một bài chưa hoàn tất</h2><span className={s.activeBadge}>{test.active_attempt.status === "CREATED" ? "Đang chuẩn bị" : "Đang làm"}</span></div>
                  <p>Tiếp tục lần làm bài {modeLabel(test.active_attempt.mode).toLowerCase()} hiện tại để giữ tiến trình và thời gian đã bắt đầu.</p>
                </div>
                <Link className={s.primaryButton} href={"/student/attempts/" + test.active_attempt.attempt_id}>Tiếp tục ngay<StudentIcon name="arrow" width="17" height="17" /></Link>
              </section>
            )}

            <section aria-labelledby="mode-heading">
              <div className={s.sectionHeading}>
                <span className={s.eyebrow}>TÙY CHỌN PHƯƠNG THỨC</span>
                <h2 id="mode-heading">Chọn chế độ làm bài</h2>
                <p>Lựa chọn luyện tập linh hoạt hoặc thi thử có giới hạn thời gian.</p>
              </div>
              {test.modes.length ? (
                <fieldset className={s.modeFieldset} aria-labelledby="mode-heading">
                  <legend className={s.srOnly}>Chế độ làm bài</legend>
                  <div className={s.modeGrid}>
                    {test.modes.map((item) => (
                      <ModeCard key={item.mode} mode={item} type={test.type} selected={mode?.mode === item.mode}
                        disabled={starting || Boolean(test.active_attempt && test.active_attempt.mode !== item.mode)}
                        onSelect={() => { setSelected(item.mode); setError(null); }} />
                    ))}
                  </div>
                </fieldset>
              ) : (
                <StudentThemeStatus title="Chưa có chế độ làm bài" description="Đề này hiện chưa có chế độ khả dụng. Bạn có thể chọn một đề khác trong thư viện." />
              )}
            </section>

            <section className={s.structureCard} aria-labelledby="structure-heading">
              <div className={s.sectionHeading}><h2 id="structure-heading">Cấu trúc bài thi</h2><p>Nội dung từng phần và câu hỏi được mở khi bạn bắt đầu làm bài.</p></div>
              <ol className={s.structureGrid}>
                {Array.from({ length: test.section_count }, (_, i) => (
                  <li key={i}><span className={s.sectionNumber}>{i + 1}</span><strong>{test.type === "READING" ? "Passage" : "Section"} {i + 1}</strong><StudentIcon name={test.type === "READING" ? "book" : "headphones"} width="19" height="19" /></li>
                ))}
              </ol>
            </section>

            {error && <div className={s.errorNotice} role="alert"><StudentIcon name="info" width="20" height="20" /><p>{error}</p></div>}

            <div className={s.actionBar}>
              <Link href="/student/tests" className={s.textLink}><StudentIcon name="back" width="17" height="17" />Quay lại thư viện</Link>
              <div className={s.selectionSummary}>
                <p>Chế độ đã chọn: <strong>{mode ? modeLabel(mode.mode) : "—"}</strong></p>
                {!test.active_attempt && mode?.attempts_remaining === 0 && <span className={s.exhausted}>Chế độ này đã hết lượt làm.</span>}
              </div>
              <button type="button" className={s.primaryButton} aria-busy={starting}
                disabled={starting || !mode || (!test.active_attempt && mode.attempts_remaining === 0)} onClick={() => void start()}>
                {starting ? "Đang chuẩn bị…" : test.active_attempt ? "Tiếp tục làm bài" : mode?.attempts_remaining === 0 ? "Đã hết lượt làm" : "Chuẩn bị làm bài"}
                {starting ? <span className={s.spinner} aria-hidden="true" /> : <StudentIcon name="arrow" width="18" height="18" />}
              </button>
            </div>
          </>
        )}
      </div>
    </StudentThemeShell>
  );
}

function ModeCard({ mode, selected, onSelect, disabled, type }: { mode: ModeOption; selected: boolean; onSelect: () => void; disabled: boolean; type: string }) {
  const mock = mode.mode === "MOCK";
  const id = `test-mode-${mode.mode}`;
  return (
    <div className={s.modeOption}>
      <input id={id} className={s.modeInput} type="radio" name="test-mode" checked={selected} disabled={disabled} onChange={onSelect}
        aria-labelledby={`${id}-title`} aria-describedby={`${id}-description ${id}-features ${id}-remaining`} />
      <label htmlFor={id} className={s.modeCard}>
        <span className={s.modeHeading}>
          <span className={s.selectionIndicator}>{selected && <StudentIcon name="check" width="14" height="14" />}</span>
          <span className={s.modeHeadingText}><span id={`${id}-title`} className={s.modeTitle}>Chế độ {modeLabel(mode.mode)}</span><span className={s.modeSubtitle}>{mock ? "Mock Test Mode" : "Practice Mode"}</span></span>
          <span className={s.modeBadge}>{mock ? "Thi thử" : "Linh hoạt"}</span>
        </span>
        <span id={`${id}-description`} className={s.modeDescription}>{mock ? "Làm quen với áp lực thời gian và hoàn tất bài trong thời lượng được quy định." : "Tập trung rèn kỹ năng đọc hiểu và nghe theo nhịp độ phù hợp với bạn."}</span>
        <span id={`${id}-features`} className={s.modeFeatures} role="list">
          <span role="listitem"><StudentIcon name={mode.duration_seconds === null ? "infinity" : "clock"} width="17" height="17" /><span>{mode.duration_seconds === null ? "Không giới hạn thời gian" : "Thời lượng: " + durationLabel(mode.duration_seconds)}</span></span>
          <span role="listitem"><StudentIcon name="cloud" width="17" height="17" /><span>Tự lưu đáp án trong quá trình làm bài</span></span>
          <span role="listitem"><StudentIcon name="book" width="17" height="17" /><span>{mode.answer_visibility === "NEVER" ? "Chỉ xem kết quả tổng quan sau khi nộp" : "Xem đáp án và lời giải sau khi nộp"}</span></span>
          {type === "LISTENING" && <span role="listitem"><StudentIcon name="headphones" width="17" height="17" /><span>{mode.allow_replay ? "Cho phép nghe lại theo giới hạn của đề" : "Không nghe lại audio"}</span></span>}
        </span>
        <span id={`${id}-remaining`} className={s.modeRemaining}>
          <span>Số lượt còn lại</span><strong className={mode.attempts_remaining === 0 ? s.exhausted : undefined}>{mode.attempts_remaining === null ? "Không giới hạn" : mode.attempts_remaining === 0 ? "Đã hết lượt" : "Còn " + mode.attempts_remaining + " lượt"}</strong>
        </span>
      </label>
    </div>
  );
}
