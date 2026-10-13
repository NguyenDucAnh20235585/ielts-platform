"use client";

import { AdminIcon } from "./admin-icons";
import { Alert, Empty } from "./admin-ui";
import { numberLabel, type ValidationReport, type ValidationIssue, type VersionEditor } from "./client-types";
import s from "./admin.module.css";

const titles: Record<string, string> = {
  NO_SECTIONS: "Chưa có section",
  EMPTY_SECTION: "Section chưa có nhóm câu hỏi",
  EMPTY_GROUP: "Nhóm chưa có câu hỏi",
  MISSING_PASSAGE: "Chưa nhập nội dung passage",
  MISSING_AUDIO: "Chưa gắn tệp âm thanh",
  MISSING_OPTIONS: "Thiếu lựa chọn trả lời",
  DUPLICATE_OPTION_KEY: "Trùng key của lựa chọn",
  MISSING_ANSWER_KEY: "Chưa có đáp án",
  INVALID_ANSWER_KEY: "Đáp án chưa hợp lệ",
  MISSING_WORD_LIMIT: "Chưa đặt giới hạn từ",
  ANSWER_EXCEEDS_WORD_LIMIT: "Đáp án vượt giới hạn từ",
  MISSING_SELECT_COUNT: "Chưa đặt số đáp án cần chọn",
  NUMBERING_GAP: "Thiếu số câu trong thứ tự đề",
  NUMBERING_DUPLICATE: "Trùng số câu",
  NO_MODE_ENABLED: "Chưa bật chế độ làm bài",
  BAND_NOT_AVAILABLE: "Không có band score",
  GAP_TOKEN_MISMATCH: "Placeholder không khớp số câu",
  AUDIO_NOT_VERIFIED: "Audio chưa được xác minh trong storage",
};
const descriptions: Record<string, string> = {
  NO_SECTIONS: "Thêm ít nhất một section trước khi xuất bản.",
  EMPTY_SECTION: "Thêm nhóm câu hỏi cho section này.",
  EMPTY_GROUP: "Thêm ít nhất một câu hỏi cho nhóm này.",
  MISSING_PASSAGE: "Bổ sung nội dung bài đọc cho passage này trước khi xuất bản.",
  MISSING_AUDIO: "Nhập audio object key cho section Listening.",
  MISSING_OPTIONS: "Bổ sung lựa chọn cho câu hỏi hoặc nhóm tương ứng.",
  DUPLICATE_OPTION_KEY: "Mỗi lựa chọn trong cùng danh sách cần một key khác nhau.",
  MISSING_ANSWER_KEY: "Nhập đáp án để hệ thống có thể chấm câu hỏi.",
  INVALID_ANSWER_KEY: "Kiểm tra đáp án có thuộc danh sách lựa chọn và đúng số đáp án cần chọn hay không.",
  MISSING_WORD_LIMIT: "Câu TEXT cần giới hạn từ ở nhóm hoặc cấu hình riêng.",
  ANSWER_EXCEEDS_WORD_LIMIT: "Sửa biến thể đáp án hoặc giới hạn từ đang áp dụng.",
  MISSING_SELECT_COUNT: "Câu nhiều đáp án cần số đáp án phải chọn từ 2 đến 5.",
  NUMBERING_GAP: "Kiểm tra số hiển thị bắt đầu và dải số của các câu.",
  NUMBERING_DUPLICATE: "Sửa số hiển thị để các câu không dùng chung số.",
  NO_MODE_ENABLED: "Bật Practice hoặc Mock trong cấu hình phiên bản.",
  BAND_NOT_AVAILABLE: "Tổng điểm tối đa khác 40. Raw score vẫn được chấm; band score không khả dụng. Cảnh báo không chặn xuất bản.",
  GAP_TOKEN_MISMATCH: "Kiểm tra các token {{gap:...}} và số câu trong nhóm.",
  AUDIO_NOT_VERIFIED: "Backend chưa kiểm tra tệp trong storage. Mở preview để kiểm tra khả năng tải và phát audio.",
};
export function ValidationPanel({ report, version, busy, readOnly, onValidate, onPublish, onLocate }: {
  report: ValidationReport | null; version: VersionEditor; busy: boolean; readOnly: boolean;
  onValidate: () => void; onPublish: () => void; onLocate: (issue: ValidationIssue) => void;
}) {
  return <section className={s.validationPage}>
    <div className={s.sectionHeading}><span className={s.headingIcon}><AdminIcon name="shield" /></span><div><h2>Kiểm tra trước khi xuất bản</h2><p>Chỉ các lỗi trong báo cáo mới chặn xuất bản. Cảnh báo có thể được giữ lại.</p></div>
      <button className={s.secondary} type="button" disabled={busy} onClick={onValidate}><AdminIcon name="replay" />{busy ? "Đang kiểm tra…" : report ? "Kiểm tra lại" : "Kiểm tra đề"}</button></div>
    {!report ? <Empty title="Chưa có kết quả kiểm tra" description="Chạy kiểm tra trên nội dung đã lưu của phiên bản." /> :
      <><div className={s.validationSummary}><span className={report.errors.length ? s.badgeRed : s.badgeTeal}>{report.errors.length} lỗi chặn xuất bản</span><span className={s.badgeAmber}>{report.warnings.length} cảnh báo</span></div>
        {report.valid && <Alert>Nội dung đã lưu hợp lệ để xuất bản.{report.warnings.length > 0 ? " Các cảnh báo bên dưới không chặn thao tác." : ""}</Alert>}
        {([{ title: "Lỗi chặn xuất bản", issues: report.errors, warning: false }, { title: "Cảnh báo", issues: report.warnings, warning: true }]).map(({ title, issues, warning }) => issues.length > 0 &&
          <section className={s.issueSection} key={title}><h3><AdminIcon name={warning ? "info" : "close"} />{title}</h3>{issues.map((issue, index) => {
            const section = version.sections.find((item) => item.id === issue.section_id);
            const group = section?.question_groups.find((item) => item.id === issue.group_id);
            return <article className={[s.issueCard, warning ? s.issueWarning : ""].join(" ")} key={issue.code + index}>
              <div className={s.inlineHeading}><h4>{titles[issue.code] ?? issue.code}</h4><span className={warning ? s.badgeAmber : s.badgeRed}>{warning ? "Cảnh báo" : "Cần sửa"}</span></div>
              <small>{[section ? (version.test.type === "READING" ? "Passage " : "Section ") + section.order_no : null, group ? "Nhóm " + group.order_no : null, issue.numbers?.length ? "Câu " + numberLabel(issue.numbers) : null].filter(Boolean).join(" · ") || "Toàn bộ đề"}</small>
              <p>{descriptions[issue.code] ?? issue.message}</p>
              {issue.code === "GAP_TOKEN_MISMATCH" && <details><summary>Chi tiết từ hệ thống</summary><p>{issue.message}</p></details>}
              {(issue.section_id || issue.group_id || issue.question_id || issue.code === "NO_SECTIONS" || issue.code === "NO_MODE_ENABLED") &&
                <button className={s.secondarySmall} type="button" disabled={busy} onClick={() => onLocate(issue)}>Đi đến nội dung<AdminIcon name="arrow" /></button>}
            </article>;
          })}</section>)}
        {!readOnly && <div className={s.formFooter}><span className={s.muted}>{report.valid ? "Có thể xuất bản phiên bản này" : "Sửa lỗi và kiểm tra lại để tiếp tục"}</span>
          <button className={s.primary} type="button" disabled={busy || !report.valid} onClick={onPublish}><AdminIcon name="publish" />Xuất bản</button></div>}
      </>}
  </section>;
}
