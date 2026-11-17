"use client";

import Link from "next/link";
import { useState } from "react";
import { useResource } from "./use-resource";
import { StudentShell } from "./student-shell";
import { Badge, Pagination, SkillBadge, StatusPanel } from "./ui";
import { StudentIcon } from "./student-icons";
import { dateLabel, durationLabel, isFinished, modeLabel, statusLabel } from "./format";
import type { HistoryItem, Paginated, TestSummary } from "./types";
import s from "./student.module.css";

export function HistoryPage({ initialTestId = "" }: { initialTestId?: string }) {
  const [status, setStatus] = useState("");
  const [testId, setTestId] = useState(initialTestId);
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), limit: "10" });
  if (status) params.set("status", status);
  if (testId) params.set("test_id", testId);
  const resource = useResource<Paginated<HistoryItem>>("/api/attempts?" + params.toString());
  const tests = useResource<Paginated<TestSummary>>("/api/tests?limit=100");
  return <StudentShell><div className={s.sectionHeading}><span className={s.eyebrow}>TIẾN TRÌNH CỦA BẠN</span><h1>Lịch sử làm bài</h1><p>Xem lại các lần luyện tập, kết quả và tiếp tục bài chưa hoàn tất.</p></div>
    <div className={s.historyFilters}><label>Trạng thái<select className={s.select} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option><option value="CREATED">Đang chuẩn bị</option><option value="IN_PROGRESS">Đang làm</option><option value="SUBMITTED">Đã nộp</option><option value="AUTO_SUBMITTED">Tự động nộp</option></select></label>
      <label>Đề thi<select className={s.select} value={testId} onChange={(event) => { setTestId(event.target.value); setPage(1); }}><option value="">Tất cả đề</option>{testId && !tests.data?.items.some((test) => test.id === testId) && <option value={testId}>{resource.data?.items[0]?.test.title || "Đề đã chọn"}</option>}{tests.data?.items.map((test) => <option key={test.id} value={test.id}>{test.title}</option>)}</select></label>
    </div>
    {resource.loading ? <StatusPanel loading /> : resource.error ? <StatusPanel title="Chưa thể tải lịch sử" description={resource.error.message} onRetry={resource.reload} /> : !resource.data?.items.length ? <StatusPanel title="Chưa có lần làm bài phù hợp" description="Thử bỏ bộ lọc hoặc chọn một đề mới để bắt đầu."><Link href="/student/tests" className={s.primaryButton}>Đến thư viện<StudentIcon name="arrow" width="17" height="17" /></Link></StatusPanel>
      : <><div className={s.historyTableWrap}><table className={s.historyTable}><thead><tr><th>Đề thi</th><th>Chế độ</th><th>Thời điểm</th><th>Trạng thái</th><th>Điểm</th><th>Band</th><th>Thời gian</th><th /></tr></thead><tbody>{resource.data.items.map((item) => <tr key={item.id}><td><div className={s.historyTitle}><strong title={item.test.title}>{item.test.title}</strong><small>{item.test.type === "READING" ? "Reading" : "Listening"} · Phiên bản {item.version_number}</small></div></td><td>{modeLabel(item.mode)}</td><td>{dateLabel(item.submitted_at ?? item.started_at)}</td><td><Badge teal={!isFinished(item.status)}>{statusLabel(item.status)}</Badge></td><td>{item.raw_score === null ? "—" : item.raw_score + "/" + item.max_score}</td><td>{item.band_score ?? "—"}</td><td>{item.time_taken_seconds === null ? "—" : durationLabel(item.time_taken_seconds)}</td><td><Link className={s.textLink} href={"/student/attempts/" + item.id + (isFinished(item.status) ? "/result" : "")}>{isFinished(item.status) ? "Kết quả" : "Tiếp tục"}<StudentIcon name="arrow" width="16" height="16" /></Link></td></tr>)}</tbody></table></div>
        <div className={s.historyCards}>{resource.data.items.map((item) => <article key={item.id}><div className={s.tagRow}><SkillBadge type={item.test.type} /><Badge teal>{statusLabel(item.status)}</Badge></div><h3 className={s.oneLine} title={item.test.title}>{item.test.title}</h3><p>{modeLabel(item.mode)} · {dateLabel(item.submitted_at ?? item.started_at)}</p><div className={s.historyCardStats}><span>Điểm: <strong>{item.raw_score === null ? "—" : item.raw_score + "/" + item.max_score}</strong></span><span>Band: <strong>{item.band_score ?? "—"}</strong></span><span>{item.time_taken_seconds === null ? "Chưa hoàn tất" : durationLabel(item.time_taken_seconds)}</span></div><Link className={s.secondaryButton} href={"/student/attempts/" + item.id + (isFinished(item.status) ? "/result" : "")}>{isFinished(item.status) ? "Xem kết quả" : "Tiếp tục làm bài"}<StudentIcon name="arrow" width="16" height="16" /></Link></article>)}</div>
        <Pagination pagination={resource.data.pagination} onPage={setPage} /></>}
  </StudentShell>;
}
