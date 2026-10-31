"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useAttempt } from "./use-attempt";
import { useStudent } from "./student-context";
import { Badge, Brand, Notice, StatusPanel } from "./ui";
import { StudentIcon } from "./student-icons";
import { answeredSlots, clockLabel, dateLabel, modeLabel } from "./format";
import { QuestionCard } from "./question-card";
import { ListeningPlayer } from "./listening-player";
import { Markdown } from "./markdown";
import type { Answers, StudentQuestion, StudentSection } from "./types";
import s from "./student.module.css";

type Cursor = { section: string; question: string | null };

export function WorkspacePage({ attemptId }: { attemptId: string }) {
  const attempt = useAttempt(attemptId);
  const { user } = useStudent();
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"passage" | "questions">("questions");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const submitDialog = useRef<HTMLDialogElement>(null);
  const navigatorDialog = useRef<HTMLDialogElement>(null);
  const questionsPane = useRef<HTMLDivElement>(null);
  const navigateScroll = useRef(false);
  const cursorReady = useRef(false);
  const data = attempt.payload;
  const sections = data?.sections ?? [];
  const section = sections.find((item) => item.id === sectionId) ?? sections[0];
  const sectionQuestions = section?.question_groups.flatMap((group) => group.questions) ?? [];
  const allQuestions = sections.flatMap((item) => item.question_groups.flatMap((group) => group.questions));
  const answered = allQuestions.reduce((sum, question) => sum + answeredSlots(question, attempt.answers[question.id]), 0);
  const sectionAnswered = sectionQuestions.reduce((sum, question) => sum + answeredSlots(question, attempt.answers[question.id]), 0);
  const sectionMarks = sectionQuestions.reduce((sum, question) => sum + question.marks, 0);
  const flagged = allQuestions.filter((question) => attempt.flags[question.id]).reduce((sum, question) => sum + question.numbers.length, 0);
  const cursorKey = "ielts:cursor:" + user.id + ":" + attemptId;
  const listening = data?.test_version.type === "LISTENING";
  const disabled = attempt.submitting || attempt.expired;
  useEffect(() => {
    if (!data?.sections) return;
    let active = true;
    cursorReady.current = false;
    let cursor: Cursor | null = null;
    try { cursor = JSON.parse(localStorage.getItem(cursorKey) ?? "null") as Cursor | null; } catch {}
    const restored = data.sections.find((item) => item.id === cursor?.section) ?? data.sections[0];
    const questionIds = restored?.question_groups.flatMap((group) => group.questions.map((question) => question.id)) ?? [];
    void Promise.resolve().then(() => {
      if (!active || !restored) return;
      cursorReady.current = true;
      navigateScroll.current = true;
      setSectionId(restored.id);
      setActiveQuestion(cursor?.question && questionIds.includes(cursor.question) ? cursor.question : questionIds[0] ?? null);
    });
    return () => { active = false; cursorReady.current = false; };
  }, [data, cursorKey]);
  useEffect(() => {
    if (!section || !cursorReady.current) return;
    try { localStorage.setItem(cursorKey, JSON.stringify({ section: section.id, question: activeQuestion })); } catch {}
    if (!navigateScroll.current || !activeQuestion) return;
    const frame = requestAnimationFrame(() => {
      const node = document.getElementById("question-" + activeQuestion);
      const pane = questionsPane.current;
      if (node && pane) pane.scrollTo({ top: pane.scrollTop + node.getBoundingClientRect().top - pane.getBoundingClientRect().top - 12,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      navigateScroll.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [section, activeQuestion, mobilePane, cursorKey]);
  useEffect(() => {
    const dialog = submitDialog.current;
    if (!dialog) return;
    if (submitOpen && !attempt.expired && !dialog.open) dialog.showModal();
    else if ((!submitOpen || attempt.expired) && dialog.open) dialog.close();
  }, [submitOpen, attempt.expired]);
  useEffect(() => {
    const dialog = navigatorDialog.current;
    if (!dialog) return;
    if (navigatorOpen && !dialog.open) dialog.showModal();
    else if (!navigatorOpen && dialog.open) dialog.close();
  }, [navigatorOpen]);
  function goTo(target: StudentSection, question?: StudentQuestion) {
    setSectionId(target.id); setActiveQuestion(question?.id ?? target.question_groups[0]?.questions[0]?.id ?? null);
    setMobilePane("questions"); setNavigatorOpen(false); navigateScroll.current = true;
  }
  if (attempt.loading) return <div className={s.workspaceLoading}><Brand /><StatusPanel loading title="Đang khôi phục bài làm…" /></div>;
  if (!data || !section) return <div className={s.workspaceLoading}><Brand /><StatusPanel title="Chưa thể mở bài làm" description={attempt.error ?? "Nội dung bài chưa sẵn sàng."} onRetry={attempt.reload} /></div>;
  const saveLabel = { saved: attempt.savedAt ? "Đã lưu lúc " + dateLabel(attempt.savedAt, true) : "Chưa có thay đổi", saving: "Đang lưu…", pending: "Chờ đồng bộ", offline: "Mất kết nối · lưu trên thiết bị", error: "Lưu chưa thành công" }[attempt.saveState];
  return <div className={[s.workspace, listening ? s.listeningWorkspace : ""].join(" ")}>
    <header className={s.workspaceHeader}>
      <div className={s.workspaceBrand}><button type="button" className={s.iconButton} onClick={() => void attempt.leave()} aria-label="Về lịch sử làm bài"><StudentIcon name="back" /></button><Brand compact />
        <strong className={s.headerTitle} title={data.test_version.title}>{data.test_version.title}</strong><Badge teal>{modeLabel(data.attempt.mode)}</Badge>
      </div>
      <div className={s.workspaceTools}><span className={[s.timer, attempt.remaining !== null && attempt.remaining < 300 ? s.timerWarning : ""].join(" ")}><StudentIcon name="clock" width="18" height="18" />{clockLabel(attempt.remaining)}</span>
        <span className={s.saveStatus} title={saveLabel} aria-live="polite"><StudentIcon name={attempt.saveState === "saved" ? "check" : "cloud"} width="16" height="16" />{saveLabel}</span>
        <button type="button" className={s.primaryButton} disabled={disabled} onClick={() => setSubmitOpen(true)}>{attempt.submitting ? "Đang nộp…" : "Nộp bài"}<StudentIcon name="arrow" width="17" height="17" /></button>
      </div>
    </header>
    {(attempt.error || attempt.cacheWarning) && <div className={s.workspaceNotice}><Notice danger={Boolean(attempt.error)}>{attempt.error || attempt.cacheWarning}
      <button type="button" className={s.textButton} disabled={attempt.submitting} onClick={() => { if (attempt.expired) void attempt.submit(true); else void attempt.flush().catch(() => {}); }}>{attempt.expired ? "Thử nộp lại" : "Đồng bộ lại"}</button>
    </Notice></div>}
    {attempt.expired && <div className={s.expiredBanner} role="status">Đã hết thời gian. {attempt.submitting ? "Đang hoàn tất bài làm…" : "Đáp án đã được khóa. Hệ thống đang hoàn tất bài làm."}</div>}
    {listening && <ListeningPlayer sections={sections} version={data.test_version} attemptId={attemptId} selectedSection={section.id} disabled={disabled}
      onSection={(id) => { setSectionId(id); setActiveQuestion(null); }} />}
    <div className={s.workspaceTabs}><div className={s.sectionTabs} role="group" aria-label="Chọn phần thi">{sections.map((item) =>
      <button key={item.id} type="button" className={section.id === item.id ? s.sectionTabActive : ""} aria-pressed={section.id === item.id} onClick={() => goTo(item)}>
        {listening ? "Section" : "Passage"} {item.order_no}{item.numbers && <span> (Câu {item.numbers[0]}–{item.numbers[1]})</span>}
      </button>)}</div><span className={s.sectionProgress}>Tiến độ: <strong>{sectionAnswered} / {sectionMarks}</strong><span className={s.progressTrack}><span style={{ width: (sectionMarks ? sectionAnswered / sectionMarks * 100 : 0) + "%" }} /></span></span></div>
    {!listening && <div className={s.mobilePaneTabs}><button type="button" aria-pressed={mobilePane === "passage"} onClick={() => setMobilePane("passage")}>Bài đọc</button><button type="button" aria-pressed={mobilePane === "questions"} onClick={() => setMobilePane("questions")}>Câu hỏi</button></div>}
    <div className={s.workspaceBody}>
      {!listening && <section className={[s.passagePane, mobilePane !== "passage" ? s.hideMobilePane : ""].join(" ")} aria-label="Bài đọc" tabIndex={0}>
        <Badge>ACADEMIC READING · SECTION {section.order_no}</Badge><h1>{section.title || "Reading Passage " + section.order_no}</h1>
        <div className={s.passageInstruction}><Markdown text={section.instruction} /></div><Markdown text={section.content} passage />
      </section>}
      <div ref={questionsPane} className={[s.questionsPane, !listening && mobilePane !== "questions" ? s.hideMobilePane : ""].join(" ")} aria-label="Câu hỏi" role="region" tabIndex={0}>
        {listening && section.instruction && <div className={s.groupInstruction}><Markdown text={section.instruction} /></div>}
        {listening && section.content && <Markdown text={section.content} />}
        {section.question_groups.map((group) => <section className={s.questionGroup} key={group.id} aria-label={"Nhóm câu " + group.questions.flatMap((q) => q.numbers).join(", ")}>
          <div className={s.groupInstruction}><Markdown text={group.instruction} />{group.content && <Markdown text={group.content} />}
            {group.options && group.questions.some((q) => q.type.startsWith("MATCHING_")) && <ul className={s.optionBank}>{group.options.map((option) => <li key={option.key}><strong>{option.key}</strong>{option.text}</li>)}</ul>}
          </div>
          {group.image && <Image className={s.questionImage} src={group.image.url} alt="Hình minh họa của nhóm câu hỏi"
            width={0} height={0} unoptimized loading="eager" style={{ width: "auto", height: "auto" }} />}
          {group.questions.map((question) => <QuestionCard key={question.id} question={question} value={attempt.answers[question.id]}
            flagged={Boolean(attempt.flags[question.id])} current={(activeQuestion ?? sectionQuestions[0]?.id) === question.id} disabled={disabled}
            onChange={(value) => attempt.changeAnswer(question.id, value)} onFlag={() => attempt.toggleFlag(question.id)} onFocus={() => setActiveQuestion(question.id)} />)}
        </section>)}
      </div>
    </div>
    <footer className={s.questionNavigator}>
      <div className={s.navigatorLegend}><span><i className={s.answeredDot} />Đã trả lời</span><span><i className={s.unansweredDot} />Chưa trả lời</span><span><i className={s.flaggedDot} />Xem lại</span><span><i className={s.currentDot} />Câu hiện tại</span></div>
      <div className={s.navigatorNumbers}><QuestionButtons questions={sectionQuestions} answers={attempt.answers} flags={attempt.flags}
        current={activeQuestion ?? sectionQuestions[0]?.id ?? null} onGo={(question) => goTo(section, question)} /></div>
      <button type="button" className={s.mobileNavigatorButton} onClick={() => setNavigatorOpen(true)}><StudentIcon name="questions" width="18" height="18" />Bảng câu hỏi</button>
      <button type="button" className={s.nextSection} disabled={sections.indexOf(section) >= sections.length - 1} onClick={() => goTo(sections[sections.indexOf(section) + 1])}>{listening ? "Section" : "Passage"} kế tiếp<StudentIcon name="arrow" width="16" height="16" /></button>
    </footer>
    <dialog className={s.modal} ref={submitDialog} aria-labelledby="submit-title" onCancel={() => setSubmitOpen(false)} onClose={() => setSubmitOpen(false)}>
      <div className={s.modalHeader}><h2 id="submit-title">Xác nhận nộp bài</h2><button type="button" className={s.iconButton} aria-label="Đóng" onClick={() => setSubmitOpen(false)}><StudentIcon name="close" /></button></div>
      <p>Sau khi nộp, bạn không thể chỉnh sửa câu trả lời của lần làm bài này.</p>
      <div className={s.submitStats}><div><strong>{answered}</strong><span>Đã trả lời</span></div><div><strong>{Math.max(0, data.test_version.question_count - answered)}</strong><span>Chưa trả lời</span></div><div><strong>{flagged}</strong><span>Đánh dấu xem lại</span></div></div>
      {answered < data.test_version.question_count && <Notice>Bạn vẫn còn câu chưa trả lời. Có thể quay lại kiểm tra hoặc tiếp tục nộp bài.</Notice>}
      <div className={s.modalActions}><button type="button" className={s.secondaryButton} onClick={() => setSubmitOpen(false)}>Quay lại làm bài</button><button type="button" className={s.primaryButton} onClick={() => { setSubmitOpen(false); void attempt.submit(); }}>Xác nhận nộp bài<StudentIcon name="arrow" width="17" height="17" /></button></div>
    </dialog>
    <dialog className={[s.modal, s.navigatorModal].join(" ")} ref={navigatorDialog} aria-labelledby="navigator-title" onCancel={() => setNavigatorOpen(false)} onClose={() => setNavigatorOpen(false)}>
      <div className={s.modalHeader}><h2 id="navigator-title">Bảng câu hỏi</h2><button type="button" className={s.iconButton} aria-label="Đóng bảng câu hỏi" onClick={() => setNavigatorOpen(false)}><StudentIcon name="close" /></button></div>
      {sections.map((item) => <div key={item.id}><h3>{listening ? "Section" : "Passage"} {item.order_no}</h3><div className={s.modalQuestionNumbers}><QuestionButtons questions={item.question_groups.flatMap((group) => group.questions)} answers={attempt.answers} flags={attempt.flags} current={activeQuestion} onGo={(question) => goTo(item, question)} /></div></div>)}
    </dialog>
  </div>;
}
function QuestionButtons({ questions, answers, flags, current, onGo }: { questions: StudentQuestion[]; answers: Answers; flags: Record<string, boolean>; current: string | null; onGo: (question: StudentQuestion) => void }) {
  return <>{questions.flatMap((question) => question.numbers.map((number, index) => <button key={number} type="button" title={"Câu " + number + (flags[question.id] ? " — đánh dấu xem lại" : "")}
    aria-label={"Đến câu " + number + (flags[question.id] ? ", đã đánh dấu" : "")} aria-current={current === question.id ? "step" : undefined}
    className={[s.numberButton, index < answeredSlots(question, answers[question.id]) ? s.numberAnswered : "", current === question.id ? s.numberCurrent : "", flags[question.id] ? s.numberFlagged : ""].join(" ")}
    onClick={() => onGo(question)}>{number}{flags[question.id] && <span className={s.flagIndicator} />}</button>))}</>;
}
