"use client";

import Link from "next/link";
import FoundationIcon from "@/features/foundation/foundation-icons";
import { useStudent } from "./student-context";
import { StudentThemeShell, StudentThemeStatus } from "./student-theme-shell";
import { useResource } from "./use-resource";
import { StudentIcon } from "./student-icons";
import { dateLabel, durationLabel, modeLabel } from "./format";
import type { HistoryItem, Paginated, Skill } from "./types";
import s from "./overview.module.css";

const skills = [
  { type: "READING", label: "Reading", icon: "book", description: "Rèn kỹ năng đọc hiểu qua các dạng câu hỏi." },
  { type: "LISTENING", label: "Listening", icon: "headphones", description: "Làm quen với các bài nghe và cấu trúc đề." },
] as const;

function SkillPill({ type }: { type: Skill }) {
  return (
    <span className={s.skillPill}>
      <StudentIcon name={type === "LISTENING" ? "headphones" : "book"} width="14" height="14" />
      {type === "LISTENING" ? "Listening" : "Reading"}
    </span>
  );
}

export function OverviewPage() {
  const { user, logout } = useStudent();
  const ongoing = useResource<Paginated<HistoryItem>>("/api/attempts?status=IN_PROGRESS&limit=3");
  const prepared = useResource<Paginated<HistoryItem>>("/api/attempts?status=CREATED&limit=3");
  const submitted = useResource<Paginated<HistoryItem>>("/api/attempts?status=SUBMITTED&limit=1");
  const automatic = useResource<Paginated<HistoryItem>>("/api/attempts?status=AUTO_SUBMITTED&limit=1");
  const recent = useResource<Paginated<HistoryItem>>("/api/attempts?limit=6");
  const active = [...(ongoing.data?.items ?? []), ...(prepared.data?.items ?? [])];
  const results = recent.data?.items.filter((item) => item.raw_score !== null) ?? [];
  const stats = [
    { label: "Đang làm bài", value: ongoing.data?.pagination.total ?? "—", icon: "clock" },
    { label: "Đang chuẩn bị", value: prepared.data?.pagination.total ?? "—", icon: "clipboard" },
    { label: "Đã hoàn thành", value: submitted.data && automatic.data ? submitted.data.pagination.total + automatic.data.pagination.total : "—", icon: "check" },
  ] as const;

  return (
    <StudentThemeShell user={user} onLogout={logout}>
      <div className={s.overview}>
        <section className={s.hero} aria-labelledby="overview-heading">
          <div className={s.heroText}>
            <span className={s.eyebrow}>KHU VỰC HỌC VIÊN</span>
            <h1 id="overview-heading">Xin chào, {user.profile.display_name || "bạn"}!</h1>
            <p>Tiếp tục bài đang làm hoặc chọn một đề mới để bắt đầu buổi luyện tập.</p>
          </div>
          <Link href="/student/tests" className={s.primaryButton}>
            Khám phá đề<StudentIcon name="arrow" width="18" height="18" />
          </Link>
        </section>

        <section className={s.stats} aria-label="Thống kê làm bài">
          {stats.map((stat) => (
            <article key={stat.label} className={s.statCard}>
              <div><p className={s.statLabel}>{stat.label}</p><strong className={s.statValue}>{stat.value}</strong></div>
              <span className={s.statIcon}>
                {stat.icon === "clipboard"
                  ? <FoundationIcon name="clipboard" width="23" height="23" />
                  : <StudentIcon name={stat.icon} width="23" height="23" />}
              </span>
            </article>
          ))}
        </section>

        <section aria-labelledby="skills-heading">
          <div className={s.sectionHeading}><h2 id="skills-heading">Luyện tập theo kỹ năng</h2></div>
          <div className={s.skillsGrid}>
            {skills.map((skill) => (
              <Link key={skill.type} href={`/student/tests?type=${skill.type}`} className={s.skillCard} aria-label={`Luyện ${skill.label}`}>
                <FoundationIcon name={skill.icon} className={s.skillIcon} strokeWidth="1.2" />
                <div className={s.skillDescription}><h3>{skill.label}</h3><p>{skill.description}</p></div>
                <span className={s.skillArrow} aria-hidden="true"><StudentIcon name="arrow" width="18" height="18" /></span>
              </Link>
            ))}
          </div>
        </section>

        <div className={s.contentGrid}>
          <section className={s.contentSection} aria-labelledby="active-heading">
            <div className={s.sectionHeading}><h2 id="active-heading">Tiếp tục bài đang làm</h2></div>
            {ongoing.loading || prepared.loading ? (
              <StudentThemeStatus loading title="Đang tải bài đang làm…" />
            ) : ongoing.error || prepared.error ? (
              <StudentThemeStatus error title="Chưa thể tải bài đang làm" description={(ongoing.error ?? prepared.error)?.message}
                onRetry={() => { ongoing.reload(); prepared.reload(); }} />
            ) : !active.length ? (
              <StudentThemeStatus title="Chưa có bài đang làm" icon="book" description="Bạn chưa có bài làm dở. Chọn một đề để bắt đầu.">
                <Link href="/student/tests" className={s.textLink}>Đến thư viện đề<StudentIcon name="arrow" width="16" height="16" /></Link>
              </StudentThemeStatus>
            ) : (
              <div className={s.activeList}>
                {active.map((item) => (
                  <article key={item.id} className={s.attemptCard}>
                    <div className={s.tags}><SkillPill type={item.test.type} /><span className={s.modePill}>{item.status === "CREATED" ? "Đang chuẩn bị" : modeLabel(item.mode)}</span></div>
                    <h3 className={s.attemptTitle} title={item.test.title}>{item.test.title}</h3>
                    <p className={s.attemptTime}><StudentIcon name="clock" width="15" height="15" />{item.started_at ? "Bắt đầu: " + dateLabel(item.started_at) : "Bài đã được chuẩn bị, chưa tính giờ."}</p>
                    <div className={s.attemptAction}>
                      <Link className={s.primaryButton} href={"/student/attempts/" + item.id} aria-label={`Tiếp tục ${item.test.title}`}>
                        Tiếp tục<StudentIcon name="arrow" width="16" height="16" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className={s.contentSection} aria-labelledby="results-heading">
            <div className={s.sectionHeading}>
              <h2 id="results-heading">Kết quả gần đây</h2>
              <Link className={s.textLink} href="/student/history">Xem lịch sử<StudentIcon name="arrow" width="15" height="15" /></Link>
            </div>
            {recent.loading ? (
              <StudentThemeStatus loading title="Đang tải kết quả…" />
            ) : recent.error ? (
              <StudentThemeStatus error title="Chưa thể tải kết quả" description={recent.error.message} onRetry={recent.reload} />
            ) : !results.length ? (
              <StudentThemeStatus title="Chưa có kết quả gần đây" icon="history" description="Kết quả sẽ xuất hiện ở đây sau khi bạn hoàn tất bài làm." />
            ) : (
              <ul className={s.resultList}>
                {results.map((item) => (
                  <li key={item.id}>
                    <Link href={"/student/attempts/" + item.id + "/result"} className={s.resultRow}>
                      <span className={s.resultIcon}><StudentIcon name={item.test.type === "LISTENING" ? "headphones" : "book"} width="20" height="20" /></span>
                      <span className={s.resultDetails}>
                        <strong className={s.resultTitle} title={item.test.title}>{item.test.title}</strong>
                        <span className={s.resultMeta}>{dateLabel(item.submitted_at)} · {durationLabel(item.time_taken_seconds)}</span>
                      </span>
                      <span className={s.resultScore}><strong>{item.raw_score}<small>/{item.max_score ?? "—"}</small></strong><span>câu đúng</span></span>
                      <StudentIcon name="arrow" className={s.resultArrow} width="17" height="17" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </StudentThemeShell>
  );
}
