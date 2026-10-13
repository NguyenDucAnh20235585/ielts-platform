import { Fragment, type ReactNode } from "react";
import s from "./student.module.css";

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\x60[^\x60]+\x60|\[[^\]]+\]\([^\s)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("\x60") && part.endsWith("\x60")) return <code key={i}>{part.slice(1, -1)}</code>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link && /^https?:\/\//i.test(link[2])) return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
export function Markdown({ text, passage = false }: { text: string | null; passage?: boolean }) {
  if (!text) return null;
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  return <div className={passage ? s.passageText : s.markdown}>
    {blocks.map((block, index) => {
      const lines = block.trim().split("\n");
      if (lines.length > 1 && /^\s*\|?\s*:?-{3,}/.test(lines[1])) {
        const rows = lines.filter((line, i) => i !== 1 && line.trim()).map((line) => line.replace(/^\s*\||\|\s*$/g, "").split("|"));
        return <div className={s.tableScroll} key={index}><table className={s.contentTable}>
          <thead><tr>{rows[0].map((cell, i) => <th key={i}>{inline(cell.trim())}</th>)}</tr></thead>
          <tbody>{rows.slice(1).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{inline(cell.trim())}</td>)}</tr>)}</tbody>
        </table></div>;
      }
      if (lines.every((line) => /^\s*[-*]\s/.test(line))) return <ul key={index}>{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*[-*]\s/, ""))}</li>)}</ul>;
      if (/^#{1,4}\s/.test(block)) return <h3 key={index}>{inline(block.replace(/^#{1,4}\s/, ""))}</h3>;
      const letter = passage && block.match(/^\*\*([A-Z])\*\*\s+([\s\S]*)$/);
      if (letter) return <div key={index} className={s.passageParagraph}><span className={s.paragraphLetter}>{letter[1]}</span><p>{inline(letter[2].replace(/\n/g, " "))}</p></div>;
      return <p key={index}>{inline(block.replace(/\n/g, " "))}</p>;
    })}
  </div>;
}
