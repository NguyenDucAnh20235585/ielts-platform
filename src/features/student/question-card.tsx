"use client";

import { countWordsAndNumbers, withinWordLimit } from "@/features/grading/word-limit";
import type { AnswerValue, StudentQuestion } from "./types";
import { StudentIcon } from "./student-icons";
import { Markdown } from "./markdown";
import s from "./student.module.css";

export function QuestionCard({ question, value, flagged, current, disabled, onChange, onFlag, onFocus }: {
  question: StudentQuestion; value: AnswerValue | undefined; flagged: boolean; current: boolean; disabled: boolean;
  onChange: (value: AnswerValue) => void; onFlag: () => void; onFocus: () => void;
}) {
  const id = "question-" + question.id;
  const text = value && "text" in value ? value.text : "";
  const limitOk = withinWordLimit(text, { maxWords: question.config.max_words, allowNumber: question.config.allow_number });
  const words = countWordsAndNumbers(text);
  const choice = value && "choice" in value ? value.choice : "";
  const choices = value && "choices" in value ? value.choices : [];
  const matching = question.type.startsWith("MATCHING_");
  const boolean = question.type === "TRUE_FALSE_NOT_GIVEN" || question.type === "YES_NO_NOT_GIVEN";
  const maxChoices = question.config.select_count ?? question.marks;
  return <fieldset id={id} className={[s.questionCard, current ? s.questionCurrent : ""].join(" ")} onFocus={onFocus}>
    <legend className={s.srOnly}>Câu {question.numbers.join("–")}</legend>
    <div className={s.questionHeading}>
      <span className={current ? s.currentQuestionNumber : s.questionNumber}>{question.numbers.join("–")}</span>
      <div id={"question-label-" + question.id} className={s.questionPrompt}><Markdown text={question.content} /></div>
      <button type="button" className={[s.flagButton, flagged ? s.flaggedButton : ""].join(" ")}
        disabled={disabled} aria-label={flagged ? "Bỏ đánh dấu câu " + question.numbers.join("–") : "Đánh dấu xem lại câu " + question.numbers.join("–")}
        aria-pressed={flagged} title={flagged ? "Bỏ đánh dấu xem lại" : "Đánh dấu xem lại"} onClick={onFlag}>
        <StudentIcon name="flag" width="18" height="18" />{flagged && <span>Xem lại</span>}
      </button>
    </div>
    {question.answer_format === "TEXT" ? <div className={s.textAnswer}>
      <input aria-labelledby={"question-label-" + question.id} aria-describedby={"word-count-" + question.id}
        value={text} maxLength={200} placeholder="Nhập câu trả lời…" disabled={disabled} autoComplete="off" autoCapitalize="none" spellCheck={false}
        className={!limitOk ? s.inputInvalid : ""} onChange={(event) => onChange(event.target.value.trim() ? { text: event.target.value } : null)} />
      <span id={"word-count-" + question.id} className={limitOk ? s.wordCount : s.dangerText}>
        {text ? (!limitOk ? "Vượt giới hạn từ" : "Đã điền (" + (words.words + words.numbers) + " từ)") : question.config.max_words === null ? "Chưa trả lời" : "Giới hạn: " + question.config.max_words + " từ" + (question.config.allow_number ? " và/hoặc 1 số" : "")}
      </span>
    </div> : question.answer_format === "CHOICE" && matching ? <select className={s.matchingSelect}
      aria-labelledby={"question-label-" + question.id} value={choice} disabled={disabled} onChange={(event) => onChange(event.target.value ? { choice: event.target.value } : null)}>
      <option value="">Chọn đáp án…</option>{question.options?.map((option) => <option value={option.key} key={option.key}>{option.key} — {option.text}</option>)}
    </select> : <div className={boolean ? s.booleanChoices : s.answerChoices}>
      {question.options?.map((option) => {
        const multiple = question.answer_format === "MULTI_CHOICE";
        const checked = multiple ? choices.includes(option.key) : choice === option.key;
        return <label key={option.key} className={[s.choiceLabel, checked ? s.choiceSelected : ""].join(" ")}>
          <input type={multiple ? "checkbox" : "radio"} name={"answer-" + question.id} checked={checked}
            disabled={disabled || (multiple && !checked && choices.length >= maxChoices)} onChange={() => {
              if (!multiple) { onChange({ choice: option.key }); return; }
              const next = checked ? choices.filter((item) => item !== option.key) : [...choices, option.key];
              onChange(next.length ? { choices: next } : null);
            }} />
          <span>{boolean ? option.text : <><strong>{option.key}.</strong> {option.text}</>}</span>
        </label>;
      })}
    </div>}
    <div className={s.questionActions}>
      {question.answer_format === "MULTI_CHOICE" && <span>Chọn {maxChoices} đáp án · Đã chọn {choices.length}</span>}
      {value && <button type="button" className={s.clearAnswer} disabled={disabled} onClick={() => onChange(null)}>Xóa đáp án</button>}
    </div>
  </fieldset>;
}
