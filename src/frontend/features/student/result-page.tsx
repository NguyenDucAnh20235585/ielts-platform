"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useResource } from "./use-resource";
import { useStudent } from "./student-context";
import { StudentThemeShell, StudentThemeStatus } from "./student-theme-shell";
import { StudentIcon } from "./student-icons";
import { answerLabel, dateLabel, durationLabel, modeLabel } from "./format";
import { QuestionCard } from "./question-card";
import { Markdown } from "./markdown";
import type { AnswerValue, AttemptPayload, ResultPayload, TestDetail } from "./types";
import s from "./result.module.css";

export function ResultPage({ attemptId }: { attemptId: string }) {
  const { user, logout } = useStudent();
  const resource = useResource<ResultPayload>("/api/attempts/" + encodeURIComponent(attemptId) + "/result");
  const [review, setReview] = useState(false);
  const [sectionId, setSectionId] = useState("");
  const result = resource.data?.result;
  const content = useResource<AttemptPayload>(review ? "/api/attempts/" + attemptId : null);
  const detail = useResource<TestDetail>(result ? "/api/tests/" + result.test.id : null);
  const retryMode = detail.data?.modes.find((mode) => mode.mode === result?.mode);
  const canRetry = retryMode && retryMode.attempts_remaining !== 0;
  const answerMap = new Map(resource.data?.answers.map((answer) => [answer.question_id, answer]) ?? []);
  const reviewSections = content.data?.sections?.filter((section) => !sectionId || section.id === sectionId) ?? [];

  return (
    <StudentThemeShell user={user} onLogout={logout}>
      <div className={s.result}>
        <nav className={s.breadcrumb} aria-label="Đường dẫn">
          <ol>
            <li><Link href="/student/history"><StudentIcon name="history" width="16" height="16" />Lịch sử làm bài</Link></li>
            <li><span aria-hidden="true">/</span><span aria-current="page">Kết quả</span></li>
          </ol>
        </nav>

        {resource.loading ? (
          <StudentThemeStatus loading headingAs="h1" title="Đang tải kết quả…" description="Đang tổng hợp điểm và câu trả lời của bạn." />
        ) : resource.error ? (
          <StudentThemeStatus error headingAs="h1" title="Kết quả chưa sẵn sàng" description={resource.error.message} onRetry={resource.reload} />
        ) : !result || !resource.data ? (
          <StudentThemeStatus headingAs="h1" title="Chưa có kết quả bài làm" description="Bạn có thể trở về lịch sử để xem các lần làm bài khác.">
            <Link href="/student/history" className={s.textLink}>Về lịch sử làm bài<StudentIcon name="arrow" width="16" height="16" /></Link>
          </StudentThemeStatus>
        ) : (
          <>
            <div className={s.pageHeading}>
              <span className={s.eyebrow}>READING & LISTENING PRACTICE</span>
              <h1>Kết quả bài làm</h1>
              <p>Xem tổng kết và đối chiếu câu trả lời để chuẩn bị cho lần luyện tập tiếp theo.</p>
            </div>

            <section className={s.hero} aria-labelledby="result-test-title">
              <div className={s.heroMain}>
                <div className={s.heroHeading}>
                  <span className={s.skillIcon}><StudentIcon name={result.test.type === "READING" ? "book" : "headphones"} width="29" height="29" /></span>
                  <div className={s.skillDetails}>
                    <span className={s.skillName}>{result.test.type === "READING" ? "Reading" : "Listening"}</span>
                    <div className={s.tags}><span className={s.badge}>{modeLabel(result.mode)}</span><span className={s.badge}>Phiên bản {result.version_number}</span></div>
                  </div>
                </div>
                <h2 id="result-test-title" className={s.testTitle}>{result.test.title}</h2>
                <span className={s.submittedBadge}><StudentIcon name="check" width="14" height="14" />{result.status === "AUTO_SUBMITTED" ? "Tự động nộp" : "Đã nộp"}</span>
                <dl className={s.facts}>
                  <div><dt><StudentIcon name="history" width="15" height="15" />Hoàn thành lúc</dt><dd>{dateLabel(result.submitted_at)}</dd></div>
                  <div><dt><StudentIcon name="clock" width="15" height="15" />Thời gian làm bài</dt><dd>{durationLabel(result.time_taken_seconds)}</dd></div>
                </dl>
              </div>
              <div className={s.scoreCard}>
                <span className={s.scoreIcon}><StudentIcon name="check" width="23" height="23" /></span>
                <p>Điểm bài làm</p>
                <strong className={s.scoreValue}>{result.raw_score}<span> / {result.max_score}</span></strong>
                {result.band_score !== null ? (
                  <div className={s.bandScore}><span>Band tham khảo</span><strong>{result.band_score.toFixed(1)}</strong></div>
                ) : <p className={s.bandNote}>Bài này không áp dụng quy đổi band.</p>}
              </div>
            </section>

            <section className={s.stats} aria-label="Thống kê câu trả lời">
              <div className={s.statCard}><dl><dt>Đúng</dt><dd>{result.correct_count}</dd></dl><span className={s.statIcon}><StudentIcon name="check" width="23" height="23" /></span></div>
              <div className={`${s.statCard} ${s.incorrectStat}`}><dl><dt>Sai</dt><dd>{result.incorrect_count}</dd></dl><span className={s.statIcon}><StudentIcon name="close" width="23" height="23" /></span></div>
              <div className={`${s.statCard} ${s.unansweredStat}`}><dl><dt>Bỏ trống</dt><dd>{result.unanswered_count}</dd></dl><span className={s.statIcon}><StudentIcon name="questions" width="23" height="23" /></span></div>
            </section>

            <section className={s.sectionCard} aria-labelledby="section-results-title">
              <div className={s.sectionHeading}><div><h2 id="section-results-title">Kết quả theo phần</h2><p>Số câu trả lời đúng trong từng phần của bài làm.</p></div><StudentIcon name="questions" width="23" height="23" /></div>
              {resource.data.section_results.length ? (
                <ol className={s.sectionResults}>
                  {resource.data.section_results.map((section) => (
                    <li key={section.section_id}>
                      <span className={s.sectionNumber}>{section.order_no}</span>
                      <div className={s.sectionInfo}><span>{result.test.type === "READING" ? "Passage" : "Section"} {section.order_no}</span><h3>{section.title || "Phần " + section.order_no}</h3></div>
                      <div className={s.sectionScore}><strong>{section.correct_count}<span> / {section.max_score}</span></strong><span>Câu đúng</span></div>
                    </li>
                  ))}
                </ol>
              ) : <p className={s.emptyNote}>Chưa có thống kê chi tiết theo phần.</p>}
            </section>

            {!result.answers_visible && (
              <div className={s.notice} role="status"><StudentIcon name="shield" width="20" height="20" /><p>Đề này không mở đáp án và lời giải. Bạn vẫn có thể xem lại câu trả lời của mình.</p></div>
            )}

            <div className={s.actions}>
              <button type="button" className={s.primaryButton} aria-expanded={review} aria-controls="review-content" onClick={() => setReview(!review)}>
                <StudentIcon name="book" width="18" height="18" />{review ? "Thu gọn bài làm" : "Xem lại bài"}
              </button>
              <div className={s.secondaryActions}>
                {canRetry && <Link className={s.secondaryButton} href={"/student/tests/" + result.test.id + "?mode=" + result.mode}><StudentIcon name="replay" width="17" height="17" />Làm lại</Link>}
                <Link className={s.secondaryButton} href="/student/tests">Về thư viện<StudentIcon name="arrow" width="17" height="17" /></Link>
              </div>
            </div>

            <section id="review-content" className={s.reviewSection} hidden={!review} aria-labelledby="review-title">
              {review && <>
                <div className={s.reviewHeading}>
                  <div><h2 id="review-title">Xem lại bài làm</h2><p>Câu trả lời được giữ nguyên như khi bạn nộp bài.</p></div>
                  <label className={s.reviewFilter}><span>Phần xem lại</span><select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
                    <option value="">Tất cả phần</option>
                    {resource.data.section_results.map((section) => <option key={section.section_id} value={section.section_id}>{section.title || "Phần " + section.order_no}</option>)}
                  </select></label>
                </div>
                {content.loading ? (
                  <StudentThemeStatus loading title="Đang tải bài làm…" />
                ) : content.error ? (
                  <StudentThemeStatus error title="Chưa thể tải nội dung bài" description={content.error.message} onRetry={content.reload} />
                ) : !reviewSections.length ? (
                  <StudentThemeStatus title="Chưa có nội dung xem lại" description="Nội dung của phần này hiện chưa sẵn sàng." onRetry={content.reload} />
                ) : reviewSections.map((section) => (
                  <section key={section.id} className={s.reviewBlock} aria-labelledby={"review-section-" + section.id}>
                    <div className={s.reviewBlockHeading}>
                      <span className={s.sectionNumber}>{section.order_no}</span>
                      <div><span className={s.eyebrow}>{result.test.type === "READING" ? "PASSAGE" : "SECTION"} {section.order_no}</span><h3 id={"review-section-" + section.id}>{section.title || "Phần " + section.order_no}</h3></div>
                      {section.numbers && <span className={s.questionRange}>Câu {section.numbers[0]}–{section.numbers[1]}</span>}
                    </div>
                    <div className={result.test.type === "READING" && section.content ? s.reviewSplit : s.reviewSingle}>
                      {(section.content || section.instruction) && <div className={result.test.type === "READING" && section.content ? s.reviewPassage : s.reviewContext} tabIndex={result.test.type === "READING" && section.content ? 0 : undefined} role="region" aria-label={result.test.type === "READING" ? "Bài đọc xem lại" : "Nội dung phần nghe"}>
                        <div className={s.passageInstruction}><Markdown text={section.instruction} classNames={s} /></div>
                        <Markdown text={section.content} passage classNames={s} />
                      </div>}
                      <div className={s.reviewQuestions}>
                        {section.question_groups.map((group) => (
                          <div key={group.id} className={s.questionGroup}>
                            <div className={s.groupInstruction}>
                              <Markdown text={group.instruction} classNames={s} /><Markdown text={group.content} classNames={s} />
                              {group.options && group.questions.some((question) => question.type.startsWith("MATCHING_")) && <ul className={s.optionBank}>{group.options.map((option) => <li key={option.key}><strong>{option.key}</strong><span>{option.text}</span></li>)}</ul>}
                            </div>
                            {group.image && <Image src={group.image.url} className={s.questionImage} alt="Hình minh họa của nhóm câu hỏi" width={0} height={0} unoptimized loading="eager" style={{ width: "auto", height: "auto" }} />}
                            {group.questions.map((question) => {
                              const answer = answerMap.get(question.id);
                              const status = !answer ? "" : answer.is_correct ? "Đúng" : answer.your_answer === null ? "Bỏ trống" : answer.score !== null && answer.score > 0 ? "Đúng một phần" : "Sai";
                              return (
                                <div key={question.id} className={s.reviewQuestion}>
                                  <QuestionCard question={question} value={(answer?.your_answer as AnswerValue | undefined) ?? null} classNames={s} flagged={false} current={false} disabled onChange={() => {}} onFlag={() => {}} onFocus={() => {}} />
                                  {result.answers_visible && answer && (
                                    <div className={`${s.answerReview} ${answer.is_correct ? s.correctReview : answer.your_answer !== null && answer.score === 0 ? s.incorrectReview : ""}`}>
                                      <div className={s.answerReviewHeading}><span className={s.answerStatus}><StudentIcon name={answer.is_correct ? "check" : answer.your_answer === null ? "questions" : answer.score !== null && answer.score > 0 ? "info" : "close"} width="15" height="15" />{status}</span><span className={s.answerScore}>Điểm: <strong>{answer.score} / {answer.marks}</strong></span></div>
                                      <p className={s.correctAnswer}><strong>Đáp án:</strong> {answerLabel(answer.correct_answer)}</p>
                                      {answer.explanation && <div className={s.explanation}><h4>Lời giải</h4><Markdown text={answer.explanation} classNames={s} /></div>}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                ))}
              </>}
            </section>
          </>
        )}
      </div>
    </StudentThemeShell>
  );
}
