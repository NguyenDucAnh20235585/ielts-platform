"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import FoundationIcon from "@/features/foundation/foundation-icons";
import { useResource } from "./use-resource";
import { useStudent } from "./student-context";
import { StudentThemeShell, StudentThemeStatus } from "./student-theme-shell";
import { StudentIcon } from "./student-icons";
import { dateLabel, durationLabel, isFinished, modeLabel, statusLabel } from "./format";
import type { HistoryItem, Paginated, TestSummary } from "./types";
import s from "./history.module.css";

export function HistoryPage({ initialTestId = "" }: { initialTestId?: string }) {
  const { user, logout } = useStudent();
  const [status, setStatus] = useState("");
  const [testId, setTestId] = useState(initialTestId);
  const [page, setPage] = useState(1);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const params = new URLSearchParams({ page: String(page), limit: "10" });
  if (status) params.set("status", status);
  if (testId) params.set("test_id", testId);
  const resource = useResource<Paginated<HistoryItem>>("/api/attempts?" + params.toString());
  const tests = useResource<Paginated<TestSummary>>("/api/tests?limit=100");
  const hasFilters = Boolean(status || testId);

  function clearFilters() {
    setStatus(""); setTestId(""); setPage(1);
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    resultsHeading.current?.focus();
  }

  return (
    <StudentThemeShell user={user} onLogout={logout}>
      <div className={s.history}>
        <section className={s.hero} aria-labelledby="history-heading">
          <div className={s.heroText}>
            <span className={s.eyebrow}>TIẾN TRÌNH CỦA BẠN</span>
            <h1 id="history-heading">Lịch sử làm bài</h1>
            <p>Xem lại các lần luyện tập, kết quả và tiếp tục bài chưa hoàn tất.</p>
          </div>
          <div className={s.totalCard}>
            <span className={s.totalIcon}><StudentIcon name="history" width="25" height="25" /></span>
            <div><span className={s.totalLabel}>{hasFilters ? "Lần làm phù hợp" : "Tổng lần làm bài"}</span><strong>{resource.data?.pagination.total ?? "—"}<small>lần</small></strong></div>
          </div>
        </section>

        <section className={s.filters} aria-labelledby="history-filters-heading">
          <div className={s.filterHeading}>
            <h2 id="history-filters-heading"><FoundationIcon name="sliders" width="19" height="19" />Bộ lọc lịch sử</h2>
            {hasFilters && <button type="button" className={s.clearButton} onClick={clearFilters}><StudentIcon name="close" width="15" height="15" />Xóa bộ lọc</button>}
          </div>
          <div className={s.filterControls}>
            <div className={s.field}>
              <label htmlFor="history-status">Trạng thái</label>
              <select id="history-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                <option value="">Tất cả trạng thái</option>
                <option value="CREATED">Đang chuẩn bị</option>
                <option value="IN_PROGRESS">Đang làm</option>
                <option value="SUBMITTED">Đã nộp</option>
                <option value="AUTO_SUBMITTED">Tự động nộp</option>
              </select>
            </div>
            <div className={s.field}>
              <label htmlFor="history-test">Đề thi</label>
              <select id="history-test" value={testId} aria-busy={tests.loading} onChange={(event) => { setTestId(event.target.value); setPage(1); }}>
                <option value="">Tất cả đề</option>
                {testId && !tests.data?.items.some((test) => test.id === testId) && <option value={testId}>{resource.data?.items.find((item) => item.test.id === testId)?.test.title || "Đề đã chọn"}</option>}
                {tests.data?.items.map((test) => <option key={test.id} value={test.id}>{test.title}</option>)}
              </select>
            </div>
          </div>
          {tests.error && <div className={s.filterNotice} role="status"><StudentIcon name="info" width="18" height="18" /><p>Chưa thể tải danh sách đề để lọc. Bạn vẫn có thể xem lịch sử và lọc theo trạng thái.</p><button type="button" onClick={tests.reload}><StudentIcon name="replay" width="15" height="15" />Tải lại danh sách đề</button></div>}
        </section>

        <section aria-labelledby="history-results-heading" aria-busy={resource.loading}>
          <div className={s.sectionHeading}>
            <h2 id="history-results-heading" ref={resultsHeading} className={s.resultsHeading} tabIndex={-1}>Các lần làm bài</h2>
            <p role="status">{resource.loading ? "Đang tải lịch sử…" : resource.error ? "Chưa thể tải lịch sử" : `${resource.data?.pagination.total ?? 0} lần làm bài${hasFilters ? " phù hợp" : ""}`}</p>
          </div>
          {resource.loading ? (
            <StudentThemeStatus loading title="Đang tải lịch sử làm bài…" />
          ) : resource.error ? (
            <StudentThemeStatus error title="Chưa thể tải lịch sử" description={resource.error.message} onRetry={resource.reload} />
          ) : !resource.data?.items.length ? (
            <StudentThemeStatus icon={hasFilters ? "search" : "history"} title={hasFilters ? "Chưa có lần làm bài phù hợp" : "Bạn chưa có lịch sử làm bài"}
              description={hasFilters ? "Thử bỏ bộ lọc hoặc chọn một đề mới để bắt đầu." : "Chọn một đề Reading hoặc Listening để bắt đầu buổi luyện tập đầu tiên."}>
              <div className={s.emptyActions}>
                {hasFilters && <button type="button" className={s.secondaryButton} onClick={clearFilters}>Xóa bộ lọc<StudentIcon name="close" width="15" height="15" /></button>}
                <Link href="/student/tests" className={s.primaryButton}>Đến thư viện<StudentIcon name="arrow" width="17" height="17" /></Link>
              </div>
            </StudentThemeStatus>
          ) : (
            <>
              <div className={s.tableWrap} tabIndex={0} role="region" aria-label="Bảng lịch sử làm bài">
                <table className={s.table}>
                  <caption className={s.srOnly}>Các lần làm bài, điểm số và trạng thái. Mỗi dòng có liên kết xem kết quả hoặc tiếp tục làm bài.</caption>
                  <thead><tr><th scope="col">Đề thi</th><th scope="col">Chế độ</th><th scope="col">Thời điểm</th><th scope="col">Trạng thái</th><th scope="col">Điểm</th><th scope="col">Band</th><th scope="col">Thời gian</th><th scope="col"><span className={s.srOnly}>Thao tác</span></th></tr></thead>
                  <tbody>{resource.data.items.map((item) => (
                    <tr key={item.id}>
                      <th scope="row">
                        <div className={s.testCell}>
                          <span className={s.testIcon}><StudentIcon name={item.test.type === "READING" ? "book" : "headphones"} width="20" height="20" /></span>
                          <div><strong title={item.test.title}>{item.test.title}</strong><span className={s.testMeta}><span className={s.skillName}>{item.test.type === "READING" ? "Reading" : "Listening"}</span><span>· Phiên bản {item.version_number}</span></span></div>
                        </div>
                      </th>
                      <td><span className={s.modeBadge}>{modeLabel(item.mode)}</span></td>
                      <td><HistoryDate item={item} className={s.timestamp} /></td>
                      <td><HistoryStatus status={item.status} /></td>
                      <td><strong className={s.score}>{scoreLabel(item)}</strong></td>
                      <td><strong className={s.band}>{item.band_score === null ? "—" : item.band_score.toFixed(1)}</strong></td>
                      <td><span className={s.duration}>{item.time_taken_seconds === null ? "—" : durationLabel(item.time_taken_seconds)}</span></td>
                      <td><Link className={`${s.actionLink} ${!isFinished(item.status) ? s.continueLink : ""}`} href={attemptHref(item)} aria-label={`${isFinished(item.status) ? "Xem kết quả" : "Tiếp tục làm bài"} ${item.test.title}`}>{isFinished(item.status) ? "Kết quả" : "Tiếp tục"}<StudentIcon name="arrow" width="15" height="15" /></Link></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>

              <div className={s.cards}>{resource.data.items.map((item) => (
                <article key={item.id} className={s.attemptCard} aria-labelledby={"history-title-" + item.id}>
                  <div className={s.cardHeading}><span className={s.skillPill}><StudentIcon name={item.test.type === "READING" ? "book" : "headphones"} width="16" height="16" /><span>{item.test.type === "READING" ? "Reading" : "Listening"}</span></span><HistoryStatus status={item.status} /></div>
                  <h3 id={"history-title-" + item.id} className={s.cardTitle}>{item.test.title}</h3>
                  <p className={s.cardMeta}><span>{modeLabel(item.mode)}</span><span>Phiên bản {item.version_number}</span></p>
                  <p className={s.cardDate}><StudentIcon name="history" width="15" height="15" /><HistoryDate item={item} /></p>
                  <dl className={s.cardStats}>
                    <div><dt>Điểm</dt><dd>{scoreLabel(item)}</dd></div>
                    <div><dt>Band</dt><dd>{item.band_score === null ? "—" : item.band_score.toFixed(1)}</dd></div>
                    <div><dt>Thời gian</dt><dd>{item.time_taken_seconds === null ? "Chưa hoàn tất" : durationLabel(item.time_taken_seconds)}</dd></div>
                  </dl>
                  <Link className={isFinished(item.status) ? s.secondaryButton : s.primaryButton} href={attemptHref(item)} aria-label={`${isFinished(item.status) ? "Xem kết quả" : "Tiếp tục làm bài"} ${item.test.title}`}>
                    {isFinished(item.status) ? "Xem kết quả" : "Tiếp tục làm bài"}<StudentIcon name="arrow" width="17" height="17" />
                  </Link>
                </article>
              ))}</div>

              <HistoryPagination pagination={resource.data.pagination} onPage={changePage} />
            </>
          )}
        </section>
      </div>
    </StudentThemeShell>
  );
}

function scoreLabel(item: HistoryItem) {
  return item.raw_score === null ? "—" : item.raw_score + " / " + (item.max_score ?? "—");
}

function attemptHref(item: HistoryItem) {
  return "/student/attempts/" + item.id + (isFinished(item.status) ? "/result" : "");
}

function HistoryDate({ item, className }: { item: HistoryItem; className?: string }) {
  const date = item.submitted_at ?? item.started_at;
  return date ? <time className={className} dateTime={date}>{dateLabel(date)}</time> : <span className={className}>—</span>;
}

function HistoryStatus({ status }: { status: HistoryItem["status"] }) {
  return <span className={s.statusBadge} data-status={status}>
    <StudentIcon name={status === "IN_PROGRESS" ? "clock" : status === "CREATED" ? "questions" : status === "AUTO_SUBMITTED" ? "shield" : "check"} width="13" height="13" />{statusLabel(status)}
  </span>;
}

function HistoryPagination({ pagination, onPage }: { pagination: Paginated<unknown>["pagination"]; onPage: (page: number) => void }) {
  const { page, limit, total, total_pages } = pagination;
  if (!total) return null;
  const pages = [...new Set([1, total_pages, page - 1, page, page + 1])].filter((number) => number >= 1 && number <= total_pages).sort((a, b) => a - b);
  return (
    <div className={s.pagination}>
      <p className={s.paginationRange}>Hiển thị <strong>{(page - 1) * limit + 1}–{Math.min(page * limit, total)}</strong> trong <strong>{total}</strong> lần làm bài</p>
      <nav aria-label="Phân trang lịch sử làm bài" className={s.pageNumbers}>
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước"><StudentIcon name="back" width="16" height="16" /></button>
        {pages.map((number, index) => <span key={number} className={s.pageNumberItem}>
          {index > 0 && number > pages[index - 1] + 1 && <span className={s.pageEllipsis} aria-hidden="true">…</span>}
          <button type="button" aria-label={`Trang ${number}`} aria-current={page === number ? "page" : undefined} onClick={() => onPage(number)}>{number}</button>
        </span>)}
        <button type="button" disabled={page >= total_pages} onClick={() => onPage(page + 1)} aria-label="Trang sau"><StudentIcon name="arrow" width="16" height="16" /></button>
      </nav>
      <span className={s.pageSummary}>Trang {page} / {total_pages}</span>
    </div>
  );
}
