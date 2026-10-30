"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useResource } from "./use-resource";
import { StudentShell } from "./student-shell";
import { Badge, Notice, SkillBadge, StatusPanel } from "./ui";
import { StudentIcon } from "./student-icons";
import { answerLabel, dateLabel, durationLabel, modeLabel } from "./format";
import { QuestionCard } from "./question-card";
import { Markdown } from "./markdown";
import type { AnswerValue, AttemptPayload, ResultPayload, TestDetail } from "./types";
import s from "./student.module.css";

export function ResultPage({ attemptId }: { attemptId: string }) {
  const resource = useResource<ResultPayload>("/api/attempts/" + encodeURIComponent(attemptId) + "/result");
  const [review, setReview] = useState(false);
  const [sectionId, setSectionId] = useState("");
  const result = resource.data?.result;
  const content = useResource<AttemptPayload>(review ? "/api/attempts/" + attemptId : null);
  const detail = useResource<TestDetail>(result ? "/api/tests/" + result.test.id : null);
  const retryMode = detail.data?.modes.find((mode) => mode.mode === result?.mode);
  const canRetry = retryMode && retryMode.attempts_remaining !== 0;
  const answerMap = new Map(resource.data?.answers.map((answer) => [answer.question_id, answer]) ?? []);
  return <StudentShell>
    <nav className={s.breadcrumb} aria-label="Đường dẫn"><Link href="/student/history"><StudentIcon name="history" width="16" height="16" />Lịch sử làm bài</Link><span>›</span><strong>Kết quả</strong></nav>
    {resource.loading ? <StatusPanel loading title="Đang tải kết quả…" /> : resource.error ? <StatusPanel title="Kết quả chưa sẵn sàng" description={resource.error.message} onRetry={resource.reload} /> : result && resource.data && <>
      <section className={s.resultHero}><div className={s.tagRow}><SkillBadge type={result.test.type} /><Badge teal>{modeLabel(result.mode)}</Badge><Badge>Phiên bản {result.version_number}</Badge><Badge>{result.status === "AUTO_SUBMITTED" ? "Tự động nộp" : "Đã nộp"}</Badge></div>
        <h1 className={s.detailTitle} title={result.test.title}>{result.test.title}</h1><p>Hoàn thành lúc {dateLabel(result.submitted_at)} · Thời gian làm bài: {durationLabel(result.time_taken_seconds)}</p>
        <div className={s.resultStats}><div className={s.scoreCard}><span>Điểm bài làm</span><strong>{result.raw_score}<small> / {result.max_score}</small></strong></div>
          {result.band_score !== null && <div className={s.scoreCard}><span>Band tham khảo</span><strong>{result.band_score.toFixed(1)}</strong></div>}
          <div><span>Đúng</span><strong>{result.correct_count}</strong></div><div><span>Sai</span><strong>{result.incorrect_count}</strong></div><div><span>Bỏ trống</span><strong>{result.unanswered_count}</strong></div>
        </div>
        {result.band_score === null && <p className={s.smallNote}>Bài này không áp dụng quy đổi band. Điểm bài làm vẫn được hiển thị đầy đủ.</p>}
      </section>
      <section className={s.structureCard}><div className={s.sectionHeading}><h2>Kết quả theo phần</h2></div><div className={s.sectionResults}>{resource.data.section_results.map((section) => <div key={section.section_id}><strong title={section.title ?? ""}>{section.title || "Phần " + section.order_no}</strong><span>{section.correct_count} / {section.max_score}</span></div>)}</div></section>
      {!result.answers_visible && <Notice>Đề này không mở đáp án và lời giải. Bạn vẫn có thể xem lại câu trả lời của mình.</Notice>}
      <div className={s.resultActions}><button type="button" className={s.primaryButton} onClick={() => setReview(!review)}>{review ? "Thu gọn bài làm" : "Xem lại bài"}<StudentIcon name="book" width="17" height="17" /></button>
        {canRetry && <Link className={s.secondaryButton} href={"/student/tests/" + result.test.id + "?mode=" + result.mode}>Làm lại<StudentIcon name="replay" width="17" height="17" /></Link>}
        <Link className={s.secondaryButton} href="/student/tests">Về thư viện<StudentIcon name="arrow" width="17" height="17" /></Link></div>
      {review && <section className={s.reviewSection}><div className={s.sectionHeading}><h2>Xem lại bài làm</h2><select className={s.select} aria-label="Chọn phần xem lại" value={sectionId} onChange={(event) => setSectionId(event.target.value)}><option value="">Tất cả phần</option>{resource.data.section_results.map((section) => <option key={section.section_id} value={section.section_id}>{section.title || "Phần " + section.order_no}</option>)}</select></div>
        {content.loading ? <StatusPanel loading /> : content.error ? <StatusPanel title="Chưa thể tải nội dung bài" description={content.error.message} onRetry={content.reload} /> : content.data?.sections?.filter((section) => !sectionId || section.id === sectionId).map((section) => <section key={section.id} className={s.reviewBlock}>
          <h3>{section.title || "Phần " + section.order_no}</h3><div className={result.test.type === "READING" ? s.reviewSplit : s.reviewListening}>
            {section.content && <div className={s.reviewPassage}><Markdown text={section.instruction} /><Markdown text={section.content} passage /></div>}
            <div>{section.question_groups.map((group) => <div key={group.id} className={s.questionGroup}><div className={s.groupInstruction}><Markdown text={group.instruction} /><Markdown text={group.content} /></div>
              {group.image && <Image src={group.image.url} className={s.questionImage} alt="Hình minh họa của nhóm câu hỏi"
                width={0} height={0} unoptimized loading="eager" style={{ width: "auto", height: "auto" }} />}
              {group.questions.map((question) => {
                const answer = answerMap.get(question.id);
                return <div key={question.id}><QuestionCard question={question} value={(answer?.your_answer as AnswerValue | undefined) ?? null} flagged={false} current={false} disabled onChange={() => {}} onFlag={() => {}} onFocus={() => {}} />
                  {result.answers_visible && answer && <div className={s.answerReview}><Badge teal={answer.is_correct === true}>{answer.is_correct ? "Đúng" : answer.your_answer === null ? "Bỏ trống" : answer.score !== null && answer.score > 0 ? "Đúng một phần" : "Sai"}</Badge><span>Điểm: {answer.score}/{answer.marks}</span><p><strong>Đáp án:</strong> {answerLabel(answer.correct_answer)}</p><Markdown text={answer.explanation} /></div>}
                </div>;
              })}
            </div>)}</div>
          </div>
        </section>)}
      </section>}
    </>}
  </StudentShell>;
}
