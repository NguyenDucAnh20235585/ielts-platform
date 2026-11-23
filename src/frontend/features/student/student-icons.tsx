import type { ReactNode, SVGProps } from "react";

export type IconName = "book" | "library" | "home" | "history" | "headphones" | "arrow" | "back" | "clock" | "check" | "flag" | "search" | "menu" | "close" | "logout" | "user" | "info" | "cloud" | "shield" | "play" | "pause" | "replay" | "volume" | "questions" | "infinity";
const paths: Record<IconName, ReactNode> = {
  book: <><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z" /><path d="M12 5v15M6 8h3M6 11h3M15 8h3M15 11h3" /></>,
  library: <><rect x="5" y="3" width="16" height="17" rx="2" /><path d="M2 7v15h15M9 7h8M9 11h8M9 15h5" /></>,
  home: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M9 9h12" /></>,
  history: <path d="M3 11a9 9 0 1 1 2.5 7.2M3 5v6h6M12 7v5l3 2" />,
  headphones: <><path d="M4 14v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="12" width="4" height="8" rx="2" /><rect x="17" y="12" width="4" height="8" rx="2" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  back: <path d="M20 12H4m6-6-6 6 6 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  flag: <path d="M5 21V3h13l-3 5 3 5H5" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  logout: <><path d="M10 3H4v18h6M10 12h11m-4-4 4 4-4 4" /></>,
  user: <><circle cx="12" cy="7" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2H5Z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  cloud: <><path d="M6 18H5a4 4 0 0 1-.8-7.9A7 7 0 0 1 18 9.5a4.3 4.3 0 0 1 1 8.5h-2" /><path d="m9 15 3-3 3 3m-3-3v9" /></>,
  shield: <><path d="m12 3 8 3v6c0 4.5-4 7.7-8 9-4-1.3-8-4.5-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  play: <path d="m8 4 12 8-12 8V4Z" />,
  pause: <><path d="M8 4v16M16 4v16" /></>,
  replay: <><path d="M3 10a9 9 0 1 1 1 7M3 3v7h7" /></>,
  volume: <><path d="m12 4-6 5H2v6h4l6 5V4ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
  questions: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h5" /></>,
  infinity: <path d="M12 12c-3-5-5-6-7-4s-2 6 0 8 4 1 7-4c3-5 5-6 7-4s2 6 0 8-4 1-7-4Z" />,
};
export function StudentIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
