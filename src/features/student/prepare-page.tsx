"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FoundationIcon from "@/features/foundation/foundation-icons";
import { studentApi, jsonBody, errorText } from "./api";
import { useResource } from "./use-resource";
import { useStudent } from "./student-context";
import { StudentThemeShell, StudentThemeStatus } from "./student-theme-shell";
import { StudentIcon } from "./student-icons";
import { durationLabel, isFinished, modeLabel, skillLabel } from "./format";
import type { AttemptPayload, TestDetail } from "./types";
import s from "./prepare.module.css";

export function PreparePage({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const { user, logout } = useStudent();
  const resource = useResource<AttemptPayload>("/api/attempts/" + encodeURIComponent(attemptId));
  const data = resource.data;
  const detail = useResource<TestDetail>(data ? "/api/tests/" + data.attempt.test_id : null);
  const [audio, setAudio] = useState<{ status: "loading" | "ready" | "error"; count: number }>({ status: "loading", count: 0 });
  const [audioRevision, setAudioRevision] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!data) return;
    if (isFinished(data.attempt.status)) router.replace("/student/attempts/" + attemptId + "/result");
    else if (data.attempt.status === "IN_PROGRESS") router.replace("/student/attempts/" + attemptId);
  }, [data, router, attemptId]);
  useEffect(() => {
    if (!data || data.attempt.status !== "CREATED") return;
    let active = true;
    const players: HTMLAudioElement[] = [];
    const timers: number[] = [];
    let loaded = 0;
    const sources = data.preload?.audio ?? [];
    void Promise.resolve().then(() => {
      if (!active) return;
      if (data.test_version.type === "READING") { setAudio({ status: "ready", count: 0 }); return; }
      if (!sources.length) { setAudio({ status: "error", count: 0 }); return; }
      setAudio({ status: "loading", count: 0 });
      for (const source of sources) {
        const player = new Audio();
        players.push(player);
        player.preload = "auto";
        let done = false;
        const finish = (success: boolean) => {
          if (done || !active) return;
          done = true;
          window.clearTimeout(timeout);
          if (!success) { setAudio({ status: "error", count: loaded }); return; }
          loaded += 1;
          setAudio((current) => current.status === "error" ? current : { status: loaded === sources.length ? "ready" : "loading", count: loaded });
        };
        const timeout = window.setTimeout(() => finish(false), 30000);
        timers.push(timeout);
        player.oncanplay = () => finish(true);
        player.onerror = () => finish(false);
        player.src = source.url;
        player.load();
      }
    });
    return () => {
      active = false;
      timers.forEach(window.clearTimeout);
      players.forEach((player) => { player.oncanplay = null; player.onerror = null; player.removeAttribute("src"); player.load(); });
    };
  }, [data, audioRevision]);
  async function begin() {
    if (!data || audio.status !== "ready" || starting) return;
    setStarting(true); setError(null);
    try {
      await studentApi<AttemptPayload>("/api/attempts/" + attemptId + "/begin", { method: "POST", body: jsonBody({}) });
      router.push("/student/attempts/" + attemptId + (data.test_version.type === "LISTENING" ? "?start=1" : ""));
    } catch (err) { setError(errorText(err)); setStarting(false); }
  }
  return (
    <StudentThemeShell user={user} onLogout={logout}>
      <div className={s.prepare}>
        <nav className={s.breadcrumb} aria-label="Đường dẫn">
          <ol>
            <li><Link href="/student/tests"><StudentIcon name="library" width="16" height="16" />Thư viện đề</Link></li>
            {data && <li className={s.testCrumb}><span aria-hidden="true">/</span><Link href={"/student/tests/" + data.attempt.test_id} title={data.test_version.title}>{data.test_version.title}</Link></li>}
            <li><span aria-hidden="true">/</span><span aria-current="page">Chuẩn bị</span></li>
          </ol>
        </nav>

        {resource.loading ? (
          <StudentThemeStatus loading headingAs="h1" title="Đang chuẩn bị bài…" />
        ) : resource.error ? (
          <StudentThemeStatus error headingAs="h1" title="Chưa thể chuẩn bị bài" description={resource.error.message} onRetry={resource.reload} />
        ) : !data ? (
          <StudentThemeStatus headingAs="h1" title="Không tìm thấy bài làm" description="Bạn có thể quay lại thư viện để chọn một đề khác.">
            <Link href="/student/tests" className={s.textLink}>Quay lại thư viện<StudentIcon name="arrow" width="16" height="16" /></Link>
          </StudentThemeStatus>
        ) : isFinished(data.attempt.status) || data.attempt.status === "IN_PROGRESS" ? (
          <StudentThemeStatus loading headingAs="h1" title={isFinished(data.attempt.status) ? "Đang mở kết quả bài làm…" : "Đang tiếp tục bài làm…"} />
        ) : (
          <>
            <div className={s.statusRow}>
              <span className={s.modeBadge}><FoundationIcon name="sliders" width="15" height="15" />Chế độ: {modeLabel(data.attempt.mode)}</span>
              <span className={s.timerBadge}><StudentIcon name="clock" width="15" height="15" />Chưa tính giờ</span>
            </div>

            <section className={s.panel} aria-labelledby="prepare-heading">
              <div className={s.heroHeading}>
                <span className={s.heroIcon}><StudentIcon name="clock" width="28" height="28" /></span>
                <div className={s.heroText}>
                  <span className={s.eyebrow}>CHUẨN BỊ LÀM BÀI</span>
                  <h1 id="prepare-heading">Sẵn sàng bắt đầu bài làm?</h1>
                </div>
              </div>
              <p className={s.testTitle}>{data.test_version.title}</p>
              <dl className={s.facts}>
                <div><dt>Kỹ năng</dt><dd>{skillLabel(data.test_version.type)}</dd><dd className={s.factHint}>{detail.data ? detail.data.section_count + " phần" : "Nội dung theo đề"}</dd></div>
                <div><dt>Số câu</dt><dd>{data.test_version.question_count} câu hỏi</dd><dd className={s.factHint}>Trả lời và đánh dấu xem lại</dd></div>
                <div><dt>Thời lượng</dt><dd>{durationLabel(data.test_version.duration_seconds)}</dd><dd className={s.factHint}>{data.test_version.duration_seconds === null ? "Không giới hạn thời gian" : "Chỉ tính khi bắt đầu"}</dd></div>
                <div><dt>Chế độ</dt><dd>{modeLabel(data.attempt.mode)}</dd><dd className={s.factHint}>{data.attempt.mode === "MOCK" ? "Có giới hạn thời gian" : "Theo cấu hình đề"}</dd></div>
              </dl>
            </section>

            <section className={s.panel} aria-labelledby="instructions-heading">
              <div className={s.sectionHeading}><StudentIcon name="info" width="21" height="21" /><h2 id="instructions-heading">Quy định và hướng dẫn làm bài</h2></div>
              <ol className={s.instructions} role="list">
                <li><span className={s.instructionNumber} aria-hidden="true">1</span><p>Đọc kỹ hướng dẫn và giới hạn từ của từng nhóm câu hỏi. Câu trả lời vượt giới hạn vẫn được lưu nhưng có thể không được tính điểm.</p></li>
                <li><span className={s.instructionNumber} aria-hidden="true">2</span><p>Đáp án được tự lưu. Theo dõi trạng thái <strong>Đã lưu</strong> hoặc <strong>Chờ đồng bộ</strong> trong khi làm bài.</p></li>
                <li><span className={s.instructionNumber} aria-hidden="true">3</span><p>Dùng <strong>Đánh dấu xem lại</strong> và bảng số câu để rà soát trước khi nộp. Tải lại trang không bắt đầu lại thời gian.</p></li>
              </ol>
            </section>

            <section className={s.panel} aria-labelledby="readiness-heading">
              <div className={s.sectionHeading}><StudentIcon name="cloud" width="21" height="21" /><h2 id="readiness-heading">Kiểm tra tài nguyên</h2></div>
              <div className={s.readinessGrid}>
                <div className={s.checkCard}>
                  <span className={s.readyIcon}><StudentIcon name="check" width="17" height="17" /></span>
                  <div><h3>Thông tin đề</h3><p>Đã sẵn sàng</p></div>
                </div>
                <div className={s.checkCard}>
                  <span className={s.readyIcon}><StudentIcon name="check" width="17" height="17" /></span>
                  <div><h3>Chế độ làm bài</h3><p>{modeLabel(data.attempt.mode)}</p></div>
                </div>
                <div className={`${s.checkCard} ${audio.status === "error" ? s.failedCard : ""}`}>
                  <span className={audio.status === "ready" ? s.readyIcon : audio.status === "error" ? s.failedIcon : s.pendingIcon}>
                    {audio.status === "loading" ? <span className={s.spinner} aria-hidden="true" /> : <StudentIcon name={audio.status === "ready" ? "check" : "info"} width="17" height="17" />}
                  </span>
                  <div>
                    <h3>{data.test_version.type === "LISTENING" ? "Tài nguyên audio" : "Chuẩn bị bài"}</h3>
                    <p role="status">{audio.status === "ready" ? "Đã sẵn sàng" : audio.status === "error" ? "Chưa tải được" : data.test_version.type === "LISTENING" ? audio.count + "/" + (data.preload?.audio.length ?? 0) + " audio đã tải" : "Đang chuẩn bị…"}</p>
                  </div>
                </div>
              </div>
              {audio.status === "error" && (
                <div className={s.errorNotice} role="alert">
                  <StudentIcon name="info" width="20" height="20" />
                  <div><p>Không thể tải audio cần thiết. Kiểm tra kết nối hoặc quay lại chọn bài khác.</p>
                    <button type="button" className={s.retryButton} onClick={() => setAudioRevision((n) => n + 1)} aria-label="Tải lại tài nguyên audio"><StudentIcon name="replay" width="15" height="15" />Tải lại audio</button>
                  </div>
                </div>
              )}
            </section>

            {error && <div className={s.errorNotice} role="alert"><StudentIcon name="info" width="20" height="20" /><div><p>{error}</p></div></div>}

            <div className={s.actionBar}>
              <div className={s.actionInfo}>
                <Link className={s.textLink} href={"/student/tests/" + data.attempt.test_id}><StudentIcon name="back" width="17" height="17" />Quay lại chi tiết đề</Link>
                <p id="prepare-start-note" className={s.actionNote}>{audio.status === "error" ? "Hãy tải lại audio trước khi bắt đầu." : audio.status === "loading" ? "Vui lòng chờ tài nguyên sẵn sàng." : "Bài làm chỉ bắt đầu khi bạn nhấn “Bắt đầu làm bài”."}</p>
              </div>
              <button className={s.primaryButton} type="button" aria-busy={starting} aria-describedby="prepare-start-note" disabled={audio.status !== "ready" || starting} onClick={() => void begin()}>
                {starting ? "Đang bắt đầu…" : "Bắt đầu làm bài"}
                {starting ? <span className={s.spinner} aria-hidden="true" /> : <StudentIcon name="arrow" width="18" height="18" />}
              </button>
            </div>

            <div className={s.footnote}>
              <span><StudentIcon name="shield" width="15" height="15" />Thời gian và kết quả được xác nhận bởi hệ thống</span>
              <span>Phiên bản đề {data.test_version.version_number}</span>
            </div>
          </>
        )}
      </div>
    </StudentThemeShell>
  );
}
