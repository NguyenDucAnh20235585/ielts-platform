import type { ReactNode, SVGProps } from "react";
import { StudentIcon, type IconName } from "@/features/student/student-icons";

type ExtraIcon = "plus" | "save" | "edit" | "trash" | "eye" | "hide" | "archive" | "settings" | "publish" | "chevron";
const paths: Record<ExtraIcon, ReactNode> = {
  plus: <path d="M12 4v16M4 12h16" />,
  save: <><path d="m16 3 5 5v13H3V3h13Z" /><path d="M7 3v6h9V3M7 21v-8h10v8" /></>,
  edit: <><path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z" /></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  hide: <><path d="m3 3 18 18M10 5c7-1 12 7 12 7s-1 3-4 5M6 6c-3 2-4 6-4 6s4 7 10 7c2 0 3-.5 4-1M9 9a4 4 0 0 0 6 6" /></>,
  archive: <><rect x="3" y="3" width="18" height="5" rx="1" /><path d="M5 8v13h14V8M9 12h6" /></>,
  settings: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" fill="currentColor" /><circle cx="16" cy="12" r="2" fill="currentColor" /><circle cx="10" cy="18" r="2" fill="currentColor" /></>,
  publish: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
};
export function AdminIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName | ExtraIcon }) {
  if (!(name in paths)) return <StudentIcon name={name as IconName} {...props} />;
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name as ExtraIcon]}</svg>;
}
