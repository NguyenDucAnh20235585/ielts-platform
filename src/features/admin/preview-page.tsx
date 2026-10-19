"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { QuestionCard } from "@/features/student/question-card";
import { Markdown } from "@/features/student/markdown";
import { Brand, SkillBadge } from "@/features/student/ui";
import type { AnswerValue, Answers, StudentQuestion } from "@/features/student/types";
import { AdminIcon } from "./admin-icons";
import { Alert, Empty } from "./admin-ui";
import { useAdminResource } from "./client-api";
import { MediaImage } from "./content-forms";
import { versionUrl, type VersionEditor, type StudentContent } from "./client-types";
import s from "./admin.module.css";
import student from "@/features/student/student.module.css";

export function AdminPreviewPage({ versionId }: { versionId: string }) {
  const version = useAdminResource<VersionEditor>("/api/admin/test-versions/" + encodeURIComponent(versionId));
  const [chosenMode, setChosenMode] = useState<"PRACTICE" | "MOCK" | null>(null);
  const modes = version.data ? (["MOCK", "PRACTICE"] as const).filter((mode) => version.data!.settings[mode === "MOCK" ? "mock" : "practice"].enabled) : [];
  const mode = chosenMode && modes.includes(chosenMode) ? chosenMode : modes[0];
  const preview = useAdminResource<StudentContent>(mode ? "/api/admin/test-versions/" + encodeURIComponent(versionId) + "/preview?mode=" + mode : null);
  return <div className={student.root}><div className={s.preview}>
    <header className={s.previewHeader}><Brand compact /><Link className={s.backLink} href={versionUrl(versionId)}><AdminIcon name="back" />Quay lại trình soạn</Link><span className={s.badgeTeal}>Chế độ xem trước</span>
      {version.data && <><SkillBadge type={version.data.test.type} /><label className={s.previewMode}>Chế độ <select value={mode} disabled={preview.loading} onChange={(event) => setChosenMode(event.target.value as "PRACTICE" | "MOCK")}>
        {modes.map((value) => <option key={value} value={value}>{value === "MOCK" ? "Thi thử" : "Luyện tập"}</option>)}</select></label></>}
    </header>
    <div className={s.previewNotice}><AdminIcon name="info" /><p>Trả lời thử để kiểm tra cách hiển thị. Không tạo lượt làm bài, không chấm điểm và không lưu vào lịch sử.</p></div>
    {version.error ? <Empty title="Chưa thể tải phiên bản" description={version.error} onRetry={() => void version.refresh()} /> :
      version.loading || preview.loading ? <Empty loading title="Đang tải bản xem trước…" /> :
      preview.error ? <Empty title="Chưa thể mở preview" description={preview.error} onRetry={() => void preview.refresh()} /> :
      preview.data ? <PreviewContent key={preview.data.test_version.mode} content={preview.data} /> : <Empty title="Chưa có chế độ để xem trước" />}
  </div></div>;
}

function PreviewContent({ content }: { content: StudentContent }) {
  const { sections, test_version: version } = content;
  const [sectionId, setSectionId] = useState(sections[0]?.id);
  const [active, setActive] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [pane, setPane] = useState<"passage" | "questions">("questions");
  const listening = version.type === "LISTENING";
  const section = sections.find((item) => item.id === sectionId) ?? sections[0];
  const questions = section?.question_groups.flatMap((group) => group.questions) ?? [];
  const answered = questions.filter((question) => Boolean(answers[question.id])).length;
  function goTo(question: StudentQuestion) {
    setActive(question.id); setPane("questions");
    requestAnimationFrame(() => document.getElementById("question-" + question.id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  if (!section) return <Empty title="Phiên bản chưa có section" description="Quay lại trình soạn để thêm nội dung." />;
  return <div className={s.previewContent}>
    <div className={s.previewTitle}><h1>{version.title}</h1><span className={s.muted}>Phiên bản {version.version_number} · {version.duration_seconds === null ? "Không giới hạn thời gian" : "Giới hạn " + Math.round(version.duration_seconds / 60) + " phút"}</span></div>
    <div className={student.workspaceTabs}><div className={student.sectionTabs}>{sections.map((item) => <button type="button" key={item.id} className={section.id === item.id ? student.sectionTabActive : ""}
      aria-pressed={section.id === item.id} onClick={() => { setSectionId(item.id); setActive(null); }}>{listening ? "Section " : "Passage "}{item.order_no}{item.numbers ? " · " + item.numbers[0] + "–" + item.numbers[1] : ""}</button>)}</div>
      <span className={student.sectionProgress}>{answered}/{questions.length} mục đã trả lời thử</span></div>
    {listening && <PreviewAudio key={section.id + version.mode} url={section.audio?.url ?? null} title={section.title ?? "Section " + section.order_no} policy={version.settings} />}
    {!listening && <div className={student.mobilePaneTabs}><button type="button" aria-pressed={pane === "passage"} onClick={() => setPane("passage")}>Bài đọc</button><button type="button" aria-pressed={pane === "questions"} onClick={() => setPane("questions")}>Câu hỏi</button></div>}
    <div className={[student.workspaceBody, listening ? s.previewListening : ""].join(" ")}>
      {!listening && <section className={[student.passagePane, pane !== "passage" ? student.hideMobilePane : ""].join(" ")} aria-label="Bài đọc" tabIndex={0}>
        <span className={s.eyebrow}>Reading Passage {section.order_no}</span><h1>{section.title || "Reading Passage " + section.order_no}</h1>
        <div className={student.passageInstruction}><Markdown text={section.instruction} /></div><Markdown text={section.content} passage />
      </section>}
      <section className={[student.questionsPane, !listening && pane !== "questions" ? student.hideMobilePane : ""].join(" ")} aria-label="Câu hỏi" tabIndex={0}>
        {listening && <Markdown text={section.instruction} />}
        {section.question_groups.map((group) => <section className={student.questionGroup} key={group.id}>
          <div className={student.groupInstruction}><Markdown text={group.instruction} /><Markdown text={group.content} />
            {group.options && group.questions.some((question) => question.type.startsWith("MATCHING_")) && <ul className={student.optionBank}>{group.options.map((option) => <li key={option.key}><strong>{option.key}</strong>{option.text}</li>)}</ul>}</div>
          {group.image && <MediaImage key={group.image.url} url={group.image.url} />}
          {group.questions.map((question) => <QuestionCard key={question.id} question={question} value={answers[question.id] ?? null} flagged={Boolean(flags[question.id])} current={(active ?? questions[0]?.id) === question.id} disabled={false}
            onChange={(answer: AnswerValue) => setAnswers((current) => ({ ...current, [question.id]: answer }))}
            onFlag={() => setFlags((current) => ({ ...current, [question.id]: !current[question.id] }))} onFocus={() => setActive(question.id)} />)}
        </section>)}
        {!questions.length && <Empty title="Section chưa có câu hỏi" />}
      </section>
    </div>
    <footer className={s.previewNavigator}><div className={s.previewNumbers}>{questions.flatMap((question) => question.numbers.map((number) =>
      <button key={question.id + number} className={[student.numberButton, answers[question.id] ? student.numberAnswered : "", flags[question.id] ? student.numberFlagged : "", active === question.id ? student.numberCurrent : ""].join(" ")} type="button" aria-label={"Đến câu " + number} onClick={() => goTo(question)}>{number}</button>))}</div>
      <button className={s.secondarySmall} type="button" onClick={() => { setAnswers({}); setFlags({}); }}>Xóa trả lời thử</button></footer>
  </div>;
}

function PreviewAudio({ url, title, policy }: { url: string | null; title: string; policy: StudentContent["test_version"]["settings"] }) {
  const player = useRef<HTMLAudioElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [plays, setPlays] = useState(0);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const atStart = useRef(true);
  const label = (value: number) => Math.floor(value / 60) + ":" + String(Math.floor(value % 60)).padStart(2, "0");
  if (!url) return <Alert danger>Audio chưa khả dụng. Kiểm tra đường dẫn tệp và cấu hình storage.</Alert>;
  async function play() {
    if (!player.current || !ready) return;
    if (playing) { if (policy.allow_pause) player.current.pause(); return; }
    if (ended && !policy.allow_replay || atStart.current && policy.max_plays !== null && plays >= policy.max_plays) return;
    if (ended) player.current.currentTime = 0;
    try {
      await player.current.play();
      if (atStart.current) { setPlays((value) => value + 1); atStart.current = false; }
      setEnded(false); setError(null);
    } catch { setError("Trình duyệt chưa cho phép phát audio. Hãy thử bấm Phát lại."); }
  }
  return <section className={student.listeningPlayer} aria-label="Xem trước audio">
    <audio ref={player} src={url} preload="auto" onCanPlay={() => setReady(true)} onLoadedMetadata={() => setDuration(Number.isFinite(player.current?.duration) ? player.current!.duration : 0)}
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={() => setTime(player.current?.currentTime ?? 0)}
      onEnded={() => { setEnded(true); setPlaying(false); atStart.current = true; }} onError={() => { setReady(false); setError("Không thể tải audio. Kiểm tra tệp hoặc thử tải lại."); }} />
    <button className={student.audioPlayButton} type="button" aria-label={playing ? "Pause audio" : "Phát audio"} disabled={!ready || playing && !policy.allow_pause || ended && (!policy.allow_replay || policy.max_plays !== null && plays >= policy.max_plays)} onClick={() => void play()}><AdminIcon name={playing ? "pause" : ended ? "replay" : "play"} width="24" height="24" /></button>
    <div className={student.audioBody}><div className={student.audioTitle}><strong>{title}</strong><span>{playing ? "Đang phát" : ready ? "Sẵn sàng" : "Đang tải"} · {plays}{policy.max_plays !== null ? "/" + policy.max_plays : ""} lần phát thử</span></div>
      <input type="range" aria-label="Vị trí audio" disabled={!ready || !policy.allow_seek} min={0} max={duration || 1} step={0.1} value={Math.min(time, duration || 1)} onChange={(event) => { if (player.current && policy.allow_seek) { player.current.currentTime = Number(event.target.value); setTime(Number(event.target.value)); } }} />
      {error && <div className={student.audioError}>{error}<button className={student.textButton} type="button" onClick={() => { setError(null); player.current?.load(); }}>Tải lại</button></div>}
    </div><span className={student.audioClock}>{label(time)} / {label(duration)}</span>
    <label className={student.volume}><AdminIcon name="volume" /><input type="range" aria-label="Âm lượng" min={0} max={1} step={0.05} value={volume} onChange={(event) => { setVolume(Number(event.target.value)); if (player.current) player.current.volume = Number(event.target.value); }} /></label>
  </section>;
}
