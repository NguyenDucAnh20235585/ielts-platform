"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import FoundationIcon from "@/features/foundation/foundation-icons";
import { useResource } from "./use-resource";
import { useStudent } from "./student-context";
import { StudentThemeShell, StudentThemeStatus } from "./student-theme-shell";
import { StudentIcon } from "./student-icons";
import { durationLabel, modeLabel } from "./format";
import type { Mode, Paginated, Skill, TestSummary } from "./types";
import s from "./catalogue.module.css";

export function CataloguePage({ initialType = "" }: { initialType?: Skill | "" }) {
  const { user, logout } = useStudent();
  const [type, setType] = useState<Skill | "">(initialType);
  const [mode, setMode] = useState<Mode | "">("");
  const [search, setSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
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
  const hasFilters = Boolean(type || mode || search);

  function clearFilters() {
    setSearch(""); setKeyword(""); setType(""); setMode(""); setPage(1);
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    resultsHeading.current?.focus();
  }

  return (
    <StudentThemeShell user={user} onLogout={logout}>
      <div className={s.catalogue}>
        <section className={s.hero} aria-labelledby="catalogue-heading">
          <div className={s.heroText}>
            <span className={s.eyebrow}>READING &amp; LISTENING PRACTICE</span>
            <h1 id="catalogue-heading">Thư viện đề</h1>
            <p>Chọn bài Reading hoặc Listening để luyện tập linh hoạt hoặc trải nghiệm chế độ thi thử tính giờ.</p>
          </div>
          <div className={s.totalCard}>
            <span className={s.totalIcon}><StudentIcon name="library" width="24" height="24" /></span>
            <div><span className={s.totalLabel}>Đề phù hợp</span><strong>{resource.data?.pagination.total ?? "—"}<small>đề</small></strong></div>
          </div>
        </section>

        <section className={s.filters} aria-label="Tìm kiếm và lọc đề">
          <div className={s.filterHeading}>
            <div className={s.filterTabs} role="group" aria-label="Lọc kỹ năng">
              {tabs.map((tab) => (
                <button key={tab.label} type="button" className={s.tabButton} aria-pressed={type === tab.value}
                  onClick={() => { setType(tab.value); setPage(1); }}>
                  {tab.value && <StudentIcon name={tab.value === "READING" ? "book" : "headphones"} className={s.tabIcon} width="16" height="16" />}
                  <span className={s.tabLabel}>{tab.label}</span>
                  <span className={s.tabCount}>{tab.count ?? "—"}</span>
                </button>
              ))}
            </div>
            {hasFilters && (
              <button type="button" className={s.clearButton} onClick={clearFilters}>
                <StudentIcon name="close" width="15" height="15" />Xóa bộ lọc
              </button>
            )}
          </div>
          <div className={s.filterControls}>
            <div className={s.field}>
              <label htmlFor="catalogue-search">Tìm theo tên đề</label>
              <div className={s.searchControl}>
                <StudentIcon name="search" width="18" height="18" />
                <input id="catalogue-search" type="search" value={search} maxLength={100}
                  onChange={(event) => setSearch(event.target.value)} placeholder="Nhập tên đề bạn muốn luyện tập…" />
              </div>
            </div>
            <div className={s.field}>
              <label htmlFor="catalogue-mode">Chế độ làm bài</label>
              <select id="catalogue-mode" value={mode} onChange={(event) => { setMode(event.target.value as Mode | ""); setPage(1); }}>
                <option value="">Tất cả chế độ</option>
                <option value="PRACTICE">Luyện tập</option>
                <option value="MOCK">Thi thử</option>
              </select>
            </div>
          </div>
        </section>

        {(all.error || reading.error || listening.error) && !resource.error && (
          <div className={s.notice} role="status">
            <StudentIcon name="info" width="19" height="19" />
            <p>Số lượng theo kỹ năng chưa tải được. Danh sách đề vẫn có thể sử dụng.</p>
          </div>
        )}

        <section aria-labelledby="catalogue-results-heading" aria-busy={resource.loading}>
          <div className={s.sectionHeading}>
            <h2 id="catalogue-results-heading" ref={resultsHeading} className={s.resultsHeading} tabIndex={-1}>Danh sách đề</h2>
            <p className={s.resultSummary} role="status">
              {resource.loading ? "Đang tải đề…" : resource.error ? "Chưa thể tải danh sách đề" : `${resource.data?.pagination.total ?? "—"} đề phù hợp`}
            </p>
          </div>
          {resource.loading ? (
            <StudentThemeStatus loading icon="library" title="Đang tải thư viện đề…" />
          ) : resource.error ? (
            <StudentThemeStatus error title="Chưa thể tải thư viện" description={resource.error.message} onRetry={resource.reload} />
          ) : !resource.data?.items.length ? (
            <StudentThemeStatus icon="search" title={hasFilters ? "Không tìm thấy đề" : "Chưa có đề luyện tập"}
              description={hasFilters ? "Thử tên đề khác hoặc bỏ bộ lọc để xem thêm bài luyện." : "Các đề luyện tập sẽ xuất hiện tại đây khi có sẵn."}>
              {hasFilters && <button type="button" className={s.secondaryButton} onClick={clearFilters}>Xóa bộ lọc<StudentIcon name="close" width="15" height="15" /></button>}
            </StudentThemeStatus>
          ) : (
            <>
              <div className={s.catalogueGrid}>{resource.data.items.map((test) => <TestCard key={test.id} test={test} />)}</div>
              <CataloguePagination pagination={resource.data.pagination} onPage={changePage} />
            </>
          )}
        </section>
      </div>
    </StudentThemeShell>
  );
}

export function TestCard({ test }: { test: TestSummary }) {
  const listening = test.type === "LISTENING";
  return (
    <article className={s.testCard} aria-labelledby={`test-title-${test.id}`}>
      <div className={s.cardHeading}>
        <span className={s.cardIcon}><FoundationIcon name={listening ? "headphones" : "book"} width="29" height="29" strokeWidth="1.3" /></span>
        <div className={s.cardLabels}>
          <span className={s.skillName}>{listening ? "Listening" : "Reading"}</span>
          <div className={s.modeBadges}>
            {test.active_attempt_id ? <span className={`${s.badge} ${s.activeBadge}`}>Đang làm dở</span>
              : test.modes.map((mode) => <span key={mode.mode} className={`${s.badge} ${mode.mode === "PRACTICE" ? s.practiceBadge : ""}`}>{modeLabel(mode.mode)}</span>)}
          </div>
        </div>
      </div>
      <h3 id={`test-title-${test.id}`} className={s.cardTitle} title={test.title}>{test.title}</h3>
      <p className={s.cardDescription}>{test.description || "Chọn chế độ phù hợp để bắt đầu luyện tập."}</p>
      <div className={s.cardFacts}>
        <p className={s.questionCount}><StudentIcon name="questions" width="16" height="16" /><strong>{test.question_count}</strong> câu hỏi</p>
        <div className={s.modeList}>
          {test.modes.map((mode) => (
            <div key={mode.mode} className={s.modeRow}>
              <span className={s.modeDuration}><StudentIcon name="clock" width="14" height="14" /><span>{modeLabel(mode.mode)}: {durationLabel(mode.duration_seconds)}</span></span>
              {mode.attempts_remaining !== null && <strong className={`${s.remaining} ${mode.attempts_remaining === 0 ? s.noAttempts : ""}`}>{mode.attempts_remaining} lượt còn lại</strong>}
            </div>
          ))}
        </div>
      </div>
      <Link className={s.primaryButton}
        href={test.active_attempt_id ? "/student/attempts/" + test.active_attempt_id : "/student/tests/" + test.id}
        aria-label={`${test.active_attempt_id ? "Tiếp tục làm bài" : "Xem đề"} ${test.title}`}>
        {test.active_attempt_id ? "Tiếp tục làm bài" : "Xem đề"}
        <StudentIcon name={test.active_attempt_id ? "play" : "arrow"} width="17" height="17" />
      </Link>
    </article>
  );
}

function CataloguePagination({ pagination, onPage }: { pagination: Paginated<unknown>["pagination"]; onPage: (page: number) => void }) {
  const { page, limit, total, total_pages } = pagination;
  if (!total) return null;
  const pages = [...new Set([1, total_pages, page - 1, page, page + 1])].filter((n) => n >= 1 && n <= total_pages).sort((a, b) => a - b);
  return (
    <div className={s.pagination}>
      <p className={s.paginationRange}>Hiển thị <strong>{(page - 1) * limit + 1}–{Math.min(page * limit, total)}</strong> trong <strong>{total}</strong> đề</p>
      <nav aria-label="Phân trang thư viện đề" className={s.pageNumbers}>
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước"><StudentIcon name="back" width="16" height="16" /></button>
        {pages.map((n, i) => (
          <span key={n} className={s.pageNumberItem}>
            {i > 0 && n > pages[i - 1] + 1 && <span className={s.pageEllipsis} aria-hidden="true">…</span>}
            <button type="button" aria-label={`Trang ${n}`} aria-current={page === n ? "page" : undefined} onClick={() => onPage(n)}>{n}</button>
          </span>
        ))}
        <button type="button" disabled={page >= total_pages} onClick={() => onPage(page + 1)} aria-label="Trang sau"><StudentIcon name="arrow" width="16" height="16" /></button>
      </nav>
      <span className={s.pageSummary}>Trang {page} / {total_pages}</span>
    </div>
  );
}
