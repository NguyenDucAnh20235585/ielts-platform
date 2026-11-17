"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useResource } from "./use-resource";
import { StudentShell } from "./student-shell";
import { Badge, Notice, Pagination, SkillBadge, StatusPanel } from "./ui";
import { StudentIcon } from "./student-icons";
import { durationLabel, modeLabel } from "./format";
import type { Mode, Paginated, Skill, TestSummary } from "./types";
import s from "./student.module.css";

export function CataloguePage({ initialType = "" }: { initialType?: Skill | "" }) {
  const [type, setType] = useState<Skill | "">(initialType);
  const [mode, setMode] = useState<Mode | "">("");
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = window.setTimeout(() => { setKeyword(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const filter = new URLSearchParams();
  if (mode) filter.set("mode", mode);
  if (keyword) filter.set("search", keyword);
  const countQuery = filter.toString();
  const all = useResource<Paginated<TestSummary>>("/api/tests?limit=1&" + countQuery);
  const reading = useResource<Paginated<TestSummary>>("/api/tests?limit=1&type=READING&" + countQuery);
  const listening = useResource<Paginated<TestSummary>>("/api/tests?limit=1&type=LISTENING&" + countQuery);
  filter.set("page", String(page));
  filter.set("limit", "6");
  if (type) filter.set("type", type);
  const resource = useResource<Paginated<TestSummary>>("/api/tests?" + filter.toString());
  const tabs = [
    { value: "" as const, label: "Tất cả", count: all.data?.pagination.total },
    { value: "READING" as const, label: "Reading", count: reading.data?.pagination.total },
    { value: "LISTENING" as const, label: "Listening", count: listening.data?.pagination.total },
  ];
  return <StudentShell>
    <section className={s.libraryHero}>
      <div><span className={s.eyebrow}><StudentIcon name="library" width="16" height="16" />LUYỆN IELTS READING & LISTENING</span>
        <h1>Thư viện đề</h1><p>Chọn bài Reading hoặc Listening để luyện tập linh hoạt hoặc trải nghiệm chế độ thi thử tính giờ.</p>
      </div>
      <div className={s.libraryTotal}><span>Đề phù hợp</span><strong>{all.data?.pagination.total ?? "—"}<small>đề khả dụng</small></strong></div>
    </section>
    <div className={s.filters}>
      <div className={s.filterTabs} role="group" aria-label="Lọc kỹ năng">{tabs.map((tab) =>
        <button key={tab.label} type="button" className={type === tab.value ? s.filterActive : ""} aria-pressed={type === tab.value}
          onClick={() => { setType(tab.value); setPage(1); }}>
          {tab.value && <StudentIcon name={tab.value === "READING" ? "book" : "headphones"} width="15" height="15" />}
          {tab.label}<span>{tab.count ?? "—"}</span>
        </button>)}</div>
      <label className={s.searchField}><StudentIcon name="search" width="18" height="18" /><input aria-label="Tìm theo tên đề" value={search} maxLength={100} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên đề thi…" /></label>
      <select aria-label="Lọc chế độ" className={s.select} value={mode} onChange={(event) => { setMode(event.target.value as Mode | ""); setPage(1); }}>
        <option value="">Tất cả chế độ</option><option value="PRACTICE">Luyện tập</option><option value="MOCK">Thi thử</option>
      </select>
    </div>
    {resource.loading ? <div className={s.catalogueGrid} aria-label="Đang tải đề">{Array.from({ length: 6 }, (_, i) => <div key={i} className={s.cardSkeleton} />)}</div>
      : resource.error ? <StatusPanel title="Chưa thể tải thư viện" description={resource.error.message} onRetry={resource.reload} />
      : !resource.data?.items.length ? <StatusPanel title="Không tìm thấy đề" description="Thử tên đề khác hoặc bỏ bộ lọc để xem thêm bài luyện.">
        <button type="button" className={s.secondaryButton} onClick={() => { setSearch(""); setKeyword(""); setType(""); setMode(""); setPage(1); }}>Xóa bộ lọc</button>
      </StatusPanel>
      : <><div className={s.catalogueGrid}>{resource.data.items.map((test) => <TestCard key={test.id} test={test} />)}</div>
        <Pagination pagination={resource.data.pagination} onPage={setPage} />
      </>}
    {(all.error || reading.error || listening.error) && !resource.error && <Notice>Số lượng theo kỹ năng chưa tải được. Danh sách đề vẫn có thể sử dụng.</Notice>}
  </StudentShell>;
}
export function TestCard({ test }: { test: TestSummary }) {
  return <article className={s.testCard}>
    <div className={s.cardBadges}><SkillBadge type={test.type} /><div className={s.modeBadges}>
      {test.active_attempt_id ? <Badge teal>Đang làm dở</Badge> : test.modes.map((mode) => <Badge key={mode.mode} teal={mode.mode === "PRACTICE"}>{modeLabel(mode.mode)}</Badge>)}
    </div></div>
    <h2 className={s.oneLine} title={test.title}>{test.title}</h2>
    <p className={s.cardDescription}>{test.description || "Chọn chế độ phù hợp để bắt đầu luyện tập."}</p>
    <div className={s.cardFacts}>
      <span><StudentIcon name="questions" width="16" height="16" />{test.question_count} câu hỏi</span>
      {test.modes.map((mode) => <div key={mode.mode} className={s.cardModeRow}>
        <span><StudentIcon name="clock" width="15" height="15" />{modeLabel(mode.mode)}: {durationLabel(mode.duration_seconds)}</span>
        {mode.attempts_remaining !== null && <strong className={mode.attempts_remaining === 0 ? s.dangerText : ""}>{mode.attempts_remaining} lượt</strong>}
      </div>)}
    </div>
    <Link className={test.active_attempt_id ? s.tealButton : s.primaryButton}
      href={test.active_attempt_id ? "/student/attempts/" + test.active_attempt_id : "/student/tests/" + test.id}>
      {test.active_attempt_id ? "Tiếp tục làm bài" : "Xem đề"}<StudentIcon name={test.active_attempt_id ? "play" : "arrow"} width="17" height="17" />
    </Link>
  </article>;
}
