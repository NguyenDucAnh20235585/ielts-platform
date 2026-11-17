"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { studentApi, jsonBody, errorText } from "./api";
import { useResource } from "./use-resource";
import { useStudent } from "./student-context";
import { Badge, Brand, Notice, StatusPanel } from "./ui";
import { StudentIcon } from "./student-icons";
import { durationLabel, isFinished, modeLabel, skillLabel } from "./format";
import type { AttemptPayload, TestDetail } from "./types";
import s from "./student.module.css";

export function PreparePage({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const { user } = useStudent();
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
  return <div className={s.preparePage}>
    <header className={s.workspaceHeader}><div className={s.workspaceBrand}><Link className={s.iconButton} href={data ? "/student/tests/" + data.attempt.test_id : "/student/tests"} aria-label="Quay lại chi tiết đề"><StudentIcon name="back" /></Link><Brand compact />
      <strong className={s.headerTitle} title={data?.test_version.title}>{data?.test_version.title ?? "Chuẩn bị bài"}</strong>{data && <Badge teal>{modeLabel(data.attempt.mode)}</Badge>}</div>
      <span className={s.avatar} title={user.email ?? "Tài khoản"}><StudentIcon name="user" width="18" height="18" /></span>
    </header>
    {resource.loading ? <StatusPanel loading /> : resource.error ? <StatusPanel title="Chưa thể chuẩn bị bài" description={resource.error.message} onRetry={resource.reload} />
      : data && <div className={s.prepareContainer}>
        <div className={s.prepareStatus}><Badge teal><span className={s.statusDot} />Chế độ: {modeLabel(data.attempt.mode)}</Badge><Badge>Chưa tính giờ</Badge></div>
        <section className={s.prepareCard}>
          <div className={s.prepareHeading}><span className={s.largeIcon}><StudentIcon name="clock" width="28" height="28" /></span><div><span className={s.eyebrow}>SẴN SÀNG CHO BUỔI LUYỆN TẬP</span><h1>Sẵn sàng bắt đầu bài làm?</h1></div></div>
          <div className={s.prepareFacts}>
            <div><span>Kỹ năng</span><strong>{skillLabel(data.test_version.type)}</strong><small>{detail.data ? detail.data.section_count + " phần" : "Nội dung theo đề"}</small></div>
            <div><span>Số câu</span><strong>{data.test_version.question_count} câu hỏi</strong><small>Trả lời và đánh dấu xem lại</small></div>
            <div><span>Thời lượng</span><strong>{durationLabel(data.test_version.duration_seconds)}</strong><small>Chỉ tính khi bắt đầu</small></div>
            <div><span>Chế độ</span><strong>{modeLabel(data.attempt.mode)}</strong><small>{data.attempt.mode === "MOCK" ? "Có giới hạn thời gian" : "Theo cấu hình đề"}</small></div>
          </div>
          <h2 className={s.prepareSubheading}><StudentIcon name="info" />Quy định và hướng dẫn làm bài</h2>
          <ol className={s.instructions}>
            <li><span>1</span><p>Đọc kỹ instruction và giới hạn từ của từng nhóm câu hỏi. Câu trả lời vượt giới hạn vẫn được lưu nhưng có thể không được tính điểm.</p></li>
            <li><span>2</span><p>Đáp án được tự lưu. Theo dõi trạng thái <strong>Đã lưu</strong> hoặc <strong>Chờ đồng bộ</strong> trong khi làm bài.</p></li>
            <li><span>3</span><p>Dùng <strong>Đánh dấu xem lại</strong> và bảng số câu để rà soát trước khi nộp. Tải lại trang không bắt đầu lại thời gian.</p></li>
          </ol>
          <h2 className={s.prepareSubheading}><StudentIcon name="cloud" />Kiểm tra tài nguyên</h2>
          <div className={s.readinessGrid}>
            <div><span className={s.readyCheck}><StudentIcon name="check" /></span><p><strong>Thông tin đề</strong><small>Đã sẵn sàng</small></p></div>
            <div><span className={s.readyCheck}><StudentIcon name="check" /></span><p><strong>Chế độ làm bài</strong><small>{modeLabel(data.attempt.mode)}</small></p></div>
            <div><span className={audio.status === "ready" ? s.readyCheck : s.pendingCheck}><StudentIcon name={audio.status === "ready" ? "check" : "headphones"} /></span><p><strong>{data.test_version.type === "LISTENING" ? "Tài nguyên audio" : "Chuẩn bị bài"}</strong><small>{audio.status === "ready" ? "Đã sẵn sàng" : audio.status === "error" ? "Chưa tải được" : audio.count + "/" + (data.preload?.audio.length ?? 0) + " audio đã tải"}</small></p></div>
          </div>
          {audio.status === "error" && <Notice danger>Không thể tải audio cần thiết. Kiểm tra kết nối hoặc quay lại chọn bài khác.<button type="button" className={s.textButton} onClick={() => setAudioRevision((n) => n + 1)}>Tải lại</button></Notice>}
          {error && <Notice danger>{error}</Notice>}
          <div className={s.prepareActions}><Link className={s.backLink} href={"/student/tests/" + data.attempt.test_id}>Quay lại chi tiết đề</Link><button className={s.primaryButton} type="button" disabled={audio.status !== "ready" || starting} onClick={() => void begin()}>{starting ? "Đang bắt đầu…" : "Bắt đầu làm bài"}<StudentIcon name="arrow" width="19" height="19" /></button></div>
        </section>
        <div className={s.prepareFooter}><span><StudentIcon name="shield" width="15" height="15" />Thời gian và kết quả được xác nhận bởi hệ thống</span><span>Phiên bản đề {data.test_version.version_number}</span></div>
      </div>}
  </div>;
}
