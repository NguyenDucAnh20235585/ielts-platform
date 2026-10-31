"use client";

import Link from "next/link";
import { useStudent } from "./student-context";
import { StudentShell } from "./student-shell";
import { useResource } from "./use-resource";
import { Badge, SkillBadge, StatusPanel } from "./ui";
import { StudentIcon } from "./student-icons";
import { dateLabel, durationLabel, modeLabel } from "./format";
import type { HistoryItem, Paginated } from "./types";
import s from "./student.module.css";

export function OverviewPage() {
  const { user } = useStudent();
  const ongoing = useResource<Paginated<HistoryItem>>("/api/attempts?status=IN_PROGRESS&limit=3");
  const prepared = useResource<Paginated<HistoryItem>>("/api/attempts?status=CREATED&limit=3");
  const submitted = useResource<Paginated<HistoryItem>>("/api/attempts?status=SUBMITTED&limit=1");
  const automatic = useResource<Paginated<HistoryItem>>("/api/attempts?status=AUTO_SUBMITTED&limit=1");
  const recent = useResource<Paginated<HistoryItem>>("/api/attempts?limit=6");
  const active = [...(ongoing.data?.items ?? []), ...(prepared.data?.items ?? [])];
  const results = recent.data?.items.filter((item) => item.raw_score !== null) ?? [];
  return <StudentShell>
    <section className={s.libraryHero}><div><span className={s.eyebrow}>KHU VỰC HỌC VIÊN</span><h1>Xin chào, {user.profile.display_name || "bạn"}!</h1><p>Tiếp tục bài đang làm hoặc chọn một đề mới để bắt đầu buổi luyện tập.</p></div><Link href="/student/tests" className={s.primaryButton}>Khám phá đề<StudentIcon name="arrow" width="18" height="18" /></Link></section>
    <div className={s.overviewStats}><div><span>Đang làm bài</span><strong>{ongoing.data?.pagination.total ?? "—"}</strong></div><div><span>Đang chuẩn bị</span><strong>{prepared.data?.pagination.total ?? "—"}</strong></div><div><span>Đã hoàn thành</span><strong>{submitted.data && automatic.data ? submitted.data.pagination.total + automatic.data.pagination.total : "—"}</strong></div></div>
    <div className={s.sectionHeading}><h2>Tiếp tục bài đang làm</h2></div>
    {ongoing.loading || prepared.loading ? <StatusPanel loading /> : ongoing.error || prepared.error ? <StatusPanel title="Chưa thể tải bài đang làm" description={(ongoing.error ?? prepared.error)?.message} onRetry={() => { ongoing.reload(); prepared.reload(); }} />
      : !active.length ? <div className={s.emptyCard}><StudentIcon name="book" /><p>Bạn chưa có bài làm dở. Chọn một đề để bắt đầu.</p><Link href="/student/tests" className={s.textLink}>Đến thư viện đề<StudentIcon name="arrow" width="17" height="17" /></Link></div>
      : <div className={s.activeGrid}>{active.map((item) => <article key={item.id} className={s.activeCard}><div className={s.tagRow}><SkillBadge type={item.test.type} /><Badge teal>{item.status === "CREATED" ? "Đang chuẩn bị" : modeLabel(item.mode)}</Badge></div><h3 className={s.oneLine} title={item.test.title}>{item.test.title}</h3><p>{item.started_at ? "Bắt đầu: " + dateLabel(item.started_at) : "Bài đã được chuẩn bị, chưa tính giờ."}</p><Link className={s.tealButton} href={"/student/attempts/" + item.id}>Tiếp tục<StudentIcon name="arrow" width="17" height="17" /></Link></article>)}</div>}
    <div className={s.sectionHeading}><h2>Kết quả gần đây</h2><Link className={s.textLink} href="/student/history">Xem lịch sử<StudentIcon name="arrow" width="16" height="16" /></Link></div>
    {recent.loading ? <StatusPanel loading /> : recent.error ? <StatusPanel title="Chưa thể tải kết quả" description={recent.error.message} onRetry={recent.reload} /> : !results.length ? <div className={s.emptyCard}><StudentIcon name="history" /><p>Kết quả sẽ xuất hiện sau khi bạn hoàn tất bài làm.</p></div>
      : <div className={s.recentList}>{results.map((item) => <Link href={"/student/attempts/" + item.id + "/result"} key={item.id}><SkillBadge type={item.test.type} /><div><strong title={item.test.title}>{item.test.title}</strong><small>{dateLabel(item.submitted_at)} · {durationLabel(item.time_taken_seconds)}</small></div><strong>{item.raw_score}/{item.max_score}</strong><StudentIcon name="arrow" width="18" height="18" /></Link>)}</div>}
    <div className={s.skillLinks}><Link href="/student/tests?type=READING"><StudentIcon name="book" width="28" height="28" /><div><h3>Luyện Reading</h3><p>Rèn kỹ năng đọc hiểu qua các dạng câu hỏi.</p></div><StudentIcon name="arrow" /></Link><Link href="/student/tests?type=LISTENING"><StudentIcon name="headphones" width="28" height="28" /><div><h3>Luyện Listening</h3><p>Làm quen với các bài nghe và cấu trúc đề.</p></div><StudentIcon name="arrow" /></Link></div>
  </StudentShell>;
}
