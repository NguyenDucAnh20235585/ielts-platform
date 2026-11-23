"use client";

import { useRef, useState, type FormEvent } from "react";
import type { Option } from "@/features/test/question-options";
import { ALLOWED_FORMATS, defaultAnswerFormat } from "./question-rules";
import { dbValueOf, QUESTION_TYPES, ANSWER_FORMATS_API, type DbQuestionType } from "@/features/test/api-enums";
import type { RulesInput } from "@/features/grading/schemas";
import { Markdown } from "@/features/student/markdown";
import { useAdmin, useDraftGuard } from "./admin-context";
import { AdminIcon } from "./admin-icons";
import { Alert } from "./admin-ui";
import { adminError } from "./client-api";
import { numberLabel, questionLabels, type AdminSection, type AdminGroup, type AdminQuestion } from "./client-types";
import s from "./admin.module.css";

export type SaveNode = (payload: Record<string, unknown>) => Promise<void>;
type Props = { readOnly: boolean; onSave: SaveNode; siblingCount: number };
const objectKey = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._\-/]+$/;
function validateKey(value: string) {
  if (value && (!objectKey.test(value) || value.length > 500)) throw new Error("Nhập đường dẫn tệp tương đối, tối đa 500 ký tự; không dùng URL, dấu cách hoặc '..'.");
}
function validateOptions(options: Option[]) {
  if (new Set(options.map((option) => option.key.trim())).size !== options.length) throw new Error("Key của mỗi lựa chọn phải khác nhau.");
  if (options.some((option) => !option.key.trim() || !option.text.trim())) throw new Error("Nhập key và nội dung cho mỗi lựa chọn, hoặc xóa dòng trống.");
}
function useFormState(value: unknown) {
  const { setDirty } = useAdmin();
  const [baseline] = useState(() => JSON.stringify(value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const dirty = JSON.stringify(value) !== baseline && JSON.stringify(value) !== saved;
  useDraftGuard(dirty);
  async function save(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(null);
    try { await action(); setSaved(JSON.stringify(value)); setDirty(false); }
    catch (err) { setError(adminError(err)); }
    finally { setBusy(false); }
  }
  return { busy, error, dirty, save };
}
function FormFooter({ busy, readOnly, label = "Lưu thay đổi" }: { busy: boolean; readOnly: boolean; label?: string }) {
  return <div className={s.editorFooter}><span className={s.muted}>{readOnly ? "Nội dung chỉ đọc" : "Lưu nội dung trước khi chuyển mục"}</span>
    {!readOnly && <button className={s.primary} type="submit" disabled={busy}><AdminIcon name="save" />{busy ? "Đang lưu…" : label}</button>}</div>;
}
function InsertPosition({ value, onChange, count }: { value: string; onChange: (value: string) => void; count: number }) {
  return <label className={s.field}><span>Vị trí chèn</span><select value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">Thêm cuối</option>{Array.from({ length: count }, (_, index) => <option key={index} value={index + 1}>Trước mục {index + 1}</option>)}</select></label>;
}
export function OptionsEditor({ value, onChange }: { value: Option[]; onChange: (value: Option[]) => void }) {
  return <div className={s.optionsEditor}><div className={s.inlineHeading}><strong>Danh sách lựa chọn</strong><small>{value.length}/40</small></div>
    {value.map((option, index) => <div className={s.optionRow} key={index}>
      <input aria-label={"Key lựa chọn " + (index + 1)} maxLength={10} placeholder="A" value={option.key} onChange={(event) => onChange(value.map((item, i) => i === index ? { ...item, key: event.target.value } : item))} />
      <textarea rows={2} aria-label={"Nội dung lựa chọn " + (index + 1)} maxLength={500} placeholder="Nội dung lựa chọn" value={option.text} onChange={(event) => onChange(value.map((item, i) => i === index ? { ...item, text: event.target.value } : item))} />
      <button className={s.iconButton} type="button" aria-label={"Xóa lựa chọn " + (index + 1)} onClick={() => onChange(value.filter((_, i) => i !== index))}><AdminIcon name="trash" /></button>
    </div>)}
    <button className={s.secondarySmall} type="button" disabled={value.length >= 40} onClick={() => {
      const keys = new Set(value.map((option) => option.key));
      const key = Array.from({ length: 40 }, (_, i) => i < 26 ? String.fromCharCode(65 + i) : String(i + 1)).find((item) => !keys.has(item)) ?? "";
      onChange([...value, { key, text: "" }]);
    }}><AdminIcon name="plus" />Thêm lựa chọn</button>
  </div>;
}
export function RulesEditor({ value, onChange, multi = false }: { value: RulesInput; onChange: (value: RulesInput) => void; multi?: boolean }) {
  return <div className={s.ruleFields}>
    <label className={s.field}><span>Giới hạn số từ</span><input type="number" min={0} max={10} step={1} value={value.max_words ?? ""}
      onChange={(event) => onChange({ ...value, max_words: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Chưa đặt" /><small>0–10 từ. Câu trả lời text phải có giới hạn từ trước khi xuất bản.</small></label>
    <label className={s.checkbox}><input type="checkbox" checked={value.allow_number ?? false} onChange={(event) => onChange({ ...value, allow_number: event.target.checked })} />Cho phép thêm một số trong đáp án</label>
    <label className={s.checkbox}><input type="checkbox" checked={value.allow_option_reuse ?? false} onChange={(event) => onChange({ ...value, allow_option_reuse: event.target.checked })} />Cho phép dùng lại lựa chọn</label>
    {multi && <label className={s.field}><span>Số đáp án cần chọn</span><input required type="number" min={2} max={5} step={1} value={value.select_count ?? 2}
      onChange={(event) => onChange({ ...value, select_count: Number(event.target.value) })} /></label>}
  </div>;
}

export function SectionForm({ section, skill, readOnly, onSave, siblingCount }: Props & { section?: AdminSection; skill: "READING" | "LISTENING" }) {
  const [title, setTitle] = useState(section?.title ?? "");
  const [instruction, setInstruction] = useState(section?.instruction ?? "");
  const [content, setContent] = useState(section?.content ?? "");
  const [audioKey, setAudioKey] = useState(section?.audio_object_key ?? "");
  const [position, setPosition] = useState("");
  const [preview, setPreview] = useState(false);
  const form = useFormState({ title, instruction, content, audioKey, position });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    void form.save(async () => {
      validateKey(audioKey.trim());
      await onSave({ title: title.trim() || null, instruction: instruction || null,
        content: skill === "READING" ? content || null : null,
        audio_object_key: skill === "LISTENING" ? audioKey.trim() || null : null,
        ...(!section && position ? { order_no: Number(position) } : {}) });
    });
  }
  return <form id="admin-editor-form" className={s.editorForm} onSubmit={submit}>
    <div className={s.inspectorHeading}><span className={s.headingIcon}><AdminIcon name={skill === "READING" ? "book" : "headphones"} /></span><div><h2>{section ? (skill === "READING" ? "Passage " : "Section ") + section.order_no : skill === "READING" ? "Thêm passage" : "Thêm section"}</h2><p>{section ? "Nội dung và hướng dẫn của section" : "Tạo nội dung mới trong phiên bản nháp"}</p></div></div>
    {form.error && <Alert danger>{form.error}</Alert>}
    <fieldset disabled={readOnly || form.busy} className={s.fields}>
      <label className={s.field}><span>Tiêu đề</span><input maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={skill === "READING" ? "Tiêu đề bài đọc" : "Tiêu đề section nghe"} /></label>
      <label className={s.field}><span>Hướng dẫn làm bài</span><textarea rows={3} maxLength={5000} value={instruction} onChange={(event) => setInstruction(event.target.value)} /></label>
      {skill === "READING" ? <div className={s.field}><div className={s.inlineHeading}><strong>Nội dung passage</strong><button className={s.textButton} type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}><AdminIcon name="eye" />{preview ? "Soạn nội dung" : "Xem trước"}</button></div>
        {preview ? <div className={s.markdownPreview}><Markdown text={content} passage />{!content && <p className={s.muted}>Chưa có nội dung.</p>}</div> :
          <textarea aria-label="Nội dung passage bằng Markdown" rows={16} maxLength={100000} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Nhập nội dung Markdown. Dùng **A** ở đầu đoạn để đánh dấu đoạn A." />}
        <small>Markdown: **in đậm**, *in nghiêng*, heading và nhãn đoạn. Không bắt buộc độ dài tối thiểu.</small></div> :
        <><label className={s.field}><span>Audio object key</span><input maxLength={500} value={audioKey} onChange={(event) => setAudioKey(event.target.value)} placeholder="tests/listening-sample/v1/section-1.mp3" /><small>Đường dẫn tệp đã có trong storage; không nhập URL đầy đủ.</small></label>
          {section?.audio && audioKey === section.audio_object_key ? <MediaAudio url={section.audio.url} /> : <Alert>{audioKey ? "Lưu đường dẫn để tải bản xem trước audio. Tệp chưa được xác minh trong storage." : "Section chưa có tệp âm thanh."}</Alert>}</>}
      {!section && <InsertPosition value={position} onChange={setPosition} count={siblingCount} />}
    </fieldset><FormFooter busy={form.busy} readOnly={readOnly} label={section ? "Lưu section" : "Tạo section"} />
  </form>;
}

export function GroupForm({ group, readOnly, onSave, siblingCount }: Props & { group?: AdminGroup }) {
  const [instruction, setInstruction] = useState(group?.instruction ?? "");
  const [content, setContent] = useState(group?.content ?? "");
  const [imageKey, setImageKey] = useState(group?.image_object_key ?? "");
  const [options, setOptions] = useState<Option[]>(group?.options ?? []);
  const [rules, setRules] = useState<RulesInput>(group?.rules ?? { max_words: null, allow_number: false, allow_option_reuse: false });
  const [position, setPosition] = useState("");
  const [preview, setPreview] = useState(false);
  const form = useFormState({ instruction, content, imageKey, options, rules, position });
  return <form id="admin-editor-form" className={s.editorForm} onSubmit={(event) => {
    event.preventDefault();
    if (readOnly) return;
    void form.save(async () => {
      if (!instruction.trim()) throw new Error("Nhập hướng dẫn cho nhóm câu hỏi.");
      validateKey(imageKey.trim()); validateOptions(options);
      await onSave({ instruction: instruction.trim(), content: content || null, image_object_key: imageKey.trim() || null,
        options: options.length ? options.map((option) => ({ key: option.key.trim(), text: option.text.trim() })) : null, rules,
        ...(!group && position ? { order_no: Number(position) } : {}) });
    });
  }}>
    <div className={s.inspectorHeading}><span className={s.headingIcon}><AdminIcon name="questions" /></span><div><h2>{group ? "Nhóm câu hỏi " + group.order_no : "Thêm nhóm câu hỏi"}</h2><p>Hướng dẫn, lựa chọn và quy tắc dùng chung</p></div></div>
    {form.error && <Alert danger>{form.error}</Alert>}<fieldset disabled={readOnly || form.busy} className={s.fields}>
      <label className={s.field}><span>Hướng dẫn nhóm <b>*</b></span><textarea required rows={4} maxLength={5000} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Questions 1–5. Choose the correct letter…" /></label>
      <div className={s.field}><div className={s.inlineHeading}><strong>Nội dung bổ sung</strong><button className={s.textButton} type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>{preview ? "Soạn" : "Xem trước"}</button></div>
        {preview ? <div className={s.markdownPreview}><Markdown text={content} /></div> : <textarea aria-label="Nội dung nhóm" rows={6} maxLength={100000} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Markdown, bảng, nội dung completion…" />}
        <div className={s.gapTools}><small>Chỗ trống: {"{{gap:14}}"}</small><button className={s.textButton} type="button" onClick={() => setContent((value) => value + " {{gap:" + (group?.questions[0]?.numbers[0] ?? 1) + "}}")}>Chèn chỗ trống</button></div></div>
      <OptionsEditor value={options} onChange={setOptions} />
      <div className={s.ruleBox}><h3>Quy tắc nhóm</h3><RulesEditor value={rules} onChange={setRules} /></div>
      <label className={s.field}><span>Image object key <small>Tùy chọn</small></span><input maxLength={500} value={imageKey} onChange={(event) => setImageKey(event.target.value)} placeholder="tests/sample/v1/map.png" /></label>
      {group?.image && imageKey === group.image_object_key && <MediaImage url={group.image.url} />}
      {!group && <InsertPosition value={position} onChange={setPosition} count={siblingCount} />}
    </fieldset><FormFooter busy={form.busy} readOnly={readOnly} label={group ? "Lưu nhóm câu hỏi" : "Tạo nhóm câu hỏi"} />
  </form>;
}

export function QuestionForm({ question, group, readOnly, onSave, onSaveKey, siblingCount }: Props & { question?: AdminQuestion; group: AdminGroup; onSaveKey: SaveNode }) {
  const { confirmLeave } = useAdmin();
  const [tab, setTab] = useState<"content" | "key" | "rules">("content");
  const [type, setType] = useState(question?.type ?? "MCQ_SINGLE");
  const [format, setFormat] = useState(question?.answer_format ?? "CHOICE");
  const [content, setContent] = useState(question?.content ?? "");
  const [displayNumber, setDisplayNumber] = useState(question?.display_number?.toString() ?? "");
  const [position, setPosition] = useState("");
  const [optionsMode, setOptionsMode] = useState<"keep" | "group" | "own">(question ? "keep" : group.options?.length ? "group" : "own");
  const [options, setOptions] = useState<Option[]>(question?.options ?? [{ key: "A", text: "" }, { key: "B", text: "" }]);
  const [ruleMode, setRuleMode] = useState<"keep" | "group" | "custom">(question ? "keep" : "group");
  const [rules, setRules] = useState<RulesInput>(question?.config ?? group.rules);
  const [selectCount, setSelectCount] = useState(question?.config.select_count ?? 2);
  const value = { type, format, content, displayNumber, position, optionsMode, options, ruleMode, rules, selectCount };
  const initial = useRef(value);
  const form = useFormState(value);
  const dbType = dbValueOf(QUESTION_TYPES, type) as DbQuestionType;
  const allowed = ALLOWED_FORMATS[dbType];
  const ownOptions = type === "MCQ_SINGLE" || type === "MCQ_MULTI";
  function changeType(next: string) {
    const parsed = dbValueOf(QUESTION_TYPES, next) as DbQuestionType;
    setType(QUESTION_TYPES[parsed]);
    setFormat(ANSWER_FORMATS_API[defaultAnswerFormat(parsed, Boolean(group.options?.length))]);
    setOptionsMode(group.options?.length ? "group" : "own");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    void form.save(async () => {
      if (!content.trim()) throw new Error("Nhập nội dung câu hỏi.");
      if (ownOptions && optionsMode === "own") validateOptions(options);
      if (type === "MCQ_MULTI" && (selectCount < 2 || selectCount > 5)) throw new Error("Số đáp án cần chọn phải từ 2 đến 5.");
      const payload: Record<string, unknown> = { type, answer_format: format, content: content.trim(), display_number: displayNumber ? Number(displayNumber) : null };
      if (!question && position) payload.order_no = Number(position);
      if (ownOptions && optionsMode !== "keep") payload.options = optionsMode === "own" && options.length ? options.map((option) => ({ key: option.key.trim(), text: option.text.trim() })) : null;
      if (!ownOptions && type !== question?.type) payload.options = null;
      if (ruleMode !== "keep") payload.config = ruleMode === "group" ? type === "MCQ_MULTI" ? { select_count: selectCount } : {} : { ...rules, ...(type === "MCQ_MULTI" ? { select_count: selectCount } : {}) };
      else if (type === "MCQ_MULTI" && (selectCount !== question?.config.select_count || question?.type !== "MCQ_MULTI")) payload.config = { ...rules, select_count: selectCount };
      await onSave(payload);
    });
  }
  // Chuyển sang đáp án sẽ bỏ bản soạn chưa lưu sau khi người dùng xác nhận.
  if (tab === "key" && question) return <AnswerKeyForm question={question} readOnly={readOnly} onSave={onSaveKey} onBack={() => setTab("content")} />;
  return <form id="admin-editor-form" className={s.editorForm} onSubmit={submit}>
    <div className={s.inspectorHeading}><span className={s.questionNumber}>{question ? numberLabel(question.numbers) : "+"}</span><div><h2>{question ? "Câu hỏi " + numberLabel(question.numbers) : "Thêm câu hỏi"}</h2><p>{question ? questionLabels[type] : "Chọn dạng câu hỏi và soạn nội dung"}</p></div></div>
    <div className={s.inspectorTabs} role="tablist" aria-label="Thông tin câu hỏi">
      {[["content", "Nội dung"], ["key", "Đáp án & lời giải"], ["rules", "Quy tắc"]].map(([value, label]) =>
        <button type="button" role="tab" aria-selected={tab === value} key={value} disabled={value === "key" && !question || form.busy}
          className={tab === value ? s.tabActive : ""} onClick={() => {
            if (value === "key") confirmLeave(() => {
              const baseline = initial.current;
              setType(baseline.type); setFormat(baseline.format); setContent(baseline.content); setDisplayNumber(baseline.displayNumber);
              setPosition(baseline.position); setOptionsMode(baseline.optionsMode); setOptions(baseline.options);
              setRuleMode(baseline.ruleMode); setRules(baseline.rules); setSelectCount(baseline.selectCount);
              setTab("key");
            });
            else setTab(value as typeof tab);
          }}>{label}</button>)}
    </div>{form.error && <Alert danger>{form.error}</Alert>}
    <fieldset disabled={readOnly || form.busy} className={s.fields}>
      {tab === "content" ? <>
        <label className={s.field}><span>Dạng câu hỏi</span><select value={type} onChange={(event) => changeType(event.target.value)}>{Object.entries(questionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {allowed.length > 1 && <label className={s.field}><span>Định dạng trả lời</span><select value={format} onChange={(event) => setFormat(event.target.value as typeof format)}>{allowed.map((value) => <option key={value} value={ANSWER_FORMATS_API[value]}>{value === "text" ? "Nhập text" : value === "choice" ? "Chọn một đáp án" : "Chọn nhiều đáp án"}</option>)}</select></label>}
        <label className={s.field}><span>Nội dung câu hỏi <b>*</b></span><textarea required rows={5} maxLength={5000} value={content} onChange={(event) => setContent(event.target.value)} /></label>
        <label className={s.field}><span>Số hiển thị bắt đầu</span><input type="number" min={1} max={200} value={displayNumber} onChange={(event) => setDisplayNumber(event.target.value)} placeholder="Tự động theo thứ tự đề" /><small>Để trống để đánh số tự động. Một mục nhiều đáp án chiếm nhiều số liên tiếp.</small></label>
        {type === "MCQ_MULTI" && <label className={s.field}><span>Số đáp án cần chọn</span><input type="number" required min={2} max={5} step={1} value={selectCount} onChange={(event) => setSelectCount(Number(event.target.value))} /></label>}
        {ownOptions ? <><label className={s.field}><span>Nguồn lựa chọn</span><select value={optionsMode} onChange={(event) => setOptionsMode(event.target.value as typeof optionsMode)}>{question && <option value="keep">Giữ lựa chọn hiện tại</option>}<option value="group">Dùng lựa chọn của nhóm</option><option value="own">Tùy chỉnh cho câu này</option></select></label>
          {optionsMode === "own" ? <OptionsEditor value={options} onChange={setOptions} /> : <div className={s.optionSummary}>{(optionsMode === "keep" ? question?.options : group.options)?.map((option) => <p key={option.key}><strong>{option.key}</strong> {option.text}</p>) ?? <p>Nhóm chưa có lựa chọn. Bạn có thể bổ sung trong phần soạn nhóm.</p>}</div>}</> :
          format === "CHOICE" && <Alert>{type === "TRUE_FALSE_NOT_GIVEN" || type === "YES_NO_NOT_GIVEN" ? "Dạng này sử dụng bộ lựa chọn cố định." : "Lựa chọn được lấy từ nhóm câu hỏi."}</Alert>}
        {!question && <InsertPosition value={position} onChange={setPosition} count={siblingCount} />}
        {!question && <Alert>Tạo câu hỏi trước, sau đó mở tab Đáp án & lời giải để nhập answer key.</Alert>}
      </> : <>
        <label className={s.field}><span>Quy tắc câu hỏi</span><select value={ruleMode} onChange={(event) => setRuleMode(event.target.value as typeof ruleMode)}>{question && <option value="keep">Giữ quy tắc hiện tại</option>}<option value="group">Dùng quy tắc nhóm</option><option value="custom">Tùy chỉnh câu này</option></select></label>
        {ruleMode === "custom" ? <RulesEditor value={rules} onChange={setRules} /> : <div className={s.ruleBox}><h3>Quy tắc đang áp dụng</h3><p>Giới hạn từ: {(ruleMode === "keep" ? question?.config : group.rules)?.max_words ?? "Chưa đặt"}</p><p>Cho phép số: {(ruleMode === "keep" ? question?.config : group.rules)?.allow_number ? "Có" : "Không"}</p><p>Dùng lại lựa chọn: {(ruleMode === "keep" ? question?.config : group.rules)?.allow_option_reuse ? "Có" : "Không"}</p></div>}
        {type === "MCQ_MULTI" && <label className={s.field}><span>Số đáp án cần chọn</span><input type="number" required min={2} max={5} value={selectCount} onChange={(event) => setSelectCount(Number(event.target.value))} /></label>}
        <Alert>Câu trả lời text cần giới hạn từ trước khi xuất bản. Chọn “Tùy chỉnh câu này” hoặc đặt giới hạn ở nhóm.</Alert>
      </>}
      <div className={s.scoreBox}><span>Điểm tối đa (chỉ đọc)</span><strong>{format === "MULTI_CHOICE" ? selectCount : 1} điểm</strong></div>
    </fieldset><FormFooter busy={form.busy} readOnly={readOnly} label={question ? "Lưu câu hỏi" : "Tạo câu hỏi"} />
  </form>;
}

function AnswerKeyForm({ question, readOnly, onSave, onBack }: { question: AdminQuestion; readOnly: boolean; onSave: SaveNode; onBack: () => void }) {
  const { confirmLeave } = useAdmin();
  const key = question.answer_key?.correct_answer as { choice?: string; choices?: string[]; accepted?: string[] } | undefined;
  const config = question.answer_key?.grading_config as { case_sensitive?: boolean; strip_punctuation?: boolean } | undefined;
  const [choices, setChoices] = useState<string[]>(key?.choices ?? (key?.choice ? [key.choice] : []));
  const [accepted, setAccepted] = useState<string[]>(key?.accepted ?? [""]);
  const [explanation, setExplanation] = useState(question.answer_key?.explanation ?? "");
  const [caseSensitive, setCaseSensitive] = useState(config?.case_sensitive ?? false);
  const [stripPunctuation, setStripPunctuation] = useState(config?.strip_punctuation ?? true);
  const form = useFormState({ choices, accepted, explanation, caseSensitive, stripPunctuation });
  return <form id="admin-editor-form" className={s.editorForm} onSubmit={(event) => {
    event.preventDefault();
    if (readOnly) return;
    void form.save(async () => {
      let correct: Record<string, unknown>;
      if (question.answer_format === "TEXT") {
        const variants = accepted.map((answer) => answer.trim()).filter(Boolean);
        if (variants.length === 0) throw new Error("Nhập ít nhất một đáp án được chấp nhận.");
        correct = { accepted: [...new Set(variants)] };
      } else {
        const count = question.answer_format === "MULTI_CHOICE" ? question.marks : 1;
        if (choices.length !== count) throw new Error("Chọn đúng " + count + " đáp án.");
        correct = question.answer_format === "MULTI_CHOICE" ? { choices } : { choice: choices[0] };
      }
      await onSave({ correct_answer: correct, explanation: explanation || null,
        grading_config: question.answer_format === "TEXT" ? { case_sensitive: caseSensitive, strip_punctuation: stripPunctuation } : null });
    });
  }}>
    <div className={s.inspectorHeading}><span className={s.questionNumber}>{numberLabel(question.numbers)}</span><div><h2>Đáp án & lời giải</h2><p>Câu {numberLabel(question.numbers)}</p></div></div>
    <button className={s.backLink} type="button" onClick={() => confirmLeave(onBack)}><AdminIcon name="back" />Nội dung & quy tắc</button>
    {!question.answer_key && <Alert>Câu hỏi chưa có đáp án. Bạn có thể lưu answer key ở đây.</Alert>}
    {form.error && <Alert danger>{form.error}</Alert>}<fieldset disabled={readOnly || form.busy} className={s.fields}>
      <div className={s.ruleBox}><Markdown text={question.content} /></div>
      {question.answer_format === "TEXT" ? <>
        <div className={s.optionsEditor}><div className={s.inlineHeading}><strong>Đáp án được chấp nhận</strong><small>{accepted.length}/20</small></div>
          {accepted.map((answer, index) => <div className={s.acceptedRow} key={index}><input aria-label={"Đáp án được chấp nhận " + (index + 1)} maxLength={200} value={answer} onChange={(event) => setAccepted(accepted.map((item, i) => i === index ? event.target.value : item))} />
            <button className={s.iconButton} type="button" aria-label={"Xóa đáp án " + (index + 1)} disabled={accepted.length <= 1} onClick={() => setAccepted(accepted.filter((_, i) => i !== index))}><AdminIcon name="trash" /></button></div>)}
          <button className={s.secondarySmall} type="button" disabled={accepted.length >= 20} onClick={() => setAccepted([...accepted, ""])}><AdminIcon name="plus" />Thêm biến thể</button></div>
        <small className={s.muted}>Giới hạn đang áp dụng: {question.config.max_words ?? "Chưa đặt"} từ{question.config.allow_number ? " và một số" : ""}.</small>
        <label className={s.checkbox}><input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} />Phân biệt hoa/thường</label>
        <label className={s.checkbox}><input type="checkbox" checked={stripPunctuation} onChange={(event) => setStripPunctuation(event.target.checked)} />Bỏ qua dấu câu khi chấm</label>
      </> : <div className={s.answerChoices}><strong>{question.answer_format === "MULTI_CHOICE" ? "Chọn " + question.marks + " đáp án đúng" : "Chọn đáp án đúng"}</strong>
        {question.options?.map((option) => <label key={option.key} className={choices.includes(option.key) ? s.answerSelected : ""}><input type={question.answer_format === "MULTI_CHOICE" ? "checkbox" : "radio"}
          name="answer-key" value={option.key} checked={choices.includes(option.key)} onChange={() => setChoices(question.answer_format === "CHOICE" ? [option.key] : choices.includes(option.key) ? choices.filter((value) => value !== option.key) : [...choices, option.key])} />
          <strong>{option.key}</strong><span>{option.text}</span></label>)}
        {!question.options?.length && <Alert danger>Bổ sung lựa chọn cho câu hoặc nhóm trước khi nhập đáp án.</Alert>}</div>}
      <label className={s.field}><span>Lời giải <small>Markdown · Tùy chọn</small></span><textarea rows={8} maxLength={5000} value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="Giải thích đáp án và dẫn chứng từ passage…" /></label>
    </fieldset><FormFooter busy={form.busy} readOnly={readOnly} label="Lưu đáp án" />
  </form>;
}

export function MediaAudio({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  return <div className={s.mediaBox}><audio controls preload="metadata" src={url} onError={() => setFailed(true)} onLoadedMetadata={() => setFailed(false)} />
    {failed && <Alert danger>Không thể tải audio. Kiểm tra đường dẫn tệp và cấu hình storage.</Alert>}</div>;
}
export function MediaImage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <Alert danger>Không tải được hình minh họa. Kiểm tra đường dẫn tệp.</Alert> :
    // Ảnh do storage cung cấp, URL không cần cấu hình domain của next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={s.mediaImage} src={url} alt="Hình minh họa của nhóm câu hỏi" onError={() => setFailed(true)} />;
}
