import type { ReactNode, SVGProps } from "react";

export type FoundationIconName =
  | "book" | "headphones" | "arrow" | "compass" | "save" | "check"
  | "scales" | "cloud" | "history" | "clipboard" | "user-plus"
  | "sliders" | "shield" | "user" | "menu" | "close" | "monitor";

const paths: Record<FoundationIconName, ReactNode> = {
  book: <><path d="M12 5.5C9.2 3.9 5.9 3.6 3 4.6v14c2.9-1 6.2-.7 9 .9 2.8-1.6 6.1-1.9 9-.9v-14c-2.9-1-6.2-.7-9 .9Z" /><path d="M12 5.5v14M6 8h3M6 11h3M15 8h3M15 11h3M15 14h3" /></>,
  headphones: <><path d="M4 14v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="12" width="4" height="8" rx="2" /><rect x="17" y="12" width="4" height="8" rx="2" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z" /></>,
  save: <><rect x="3" y="3" width="18" height="14" rx="2" /><path d="m8 10 3 3 5-5M2 21h20" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  scales: <><path d="M12 3v18M5 21h14M4 7h16M7 5v2M17 5v2M4 7l-3 7h6L4 7Zm16 0-3 7h6l-3-7Z" /><path d="M1 14a3 3 0 0 0 6 0m10 0a3 3 0 0 0 6 0" /></>,
  cloud: <><path d="M7 18H5a4 4 0 0 1-.8-7.9A7 7 0 0 1 18 9.5a4.3 4.3 0 0 1 1 8.5h-2" /><path d="m9 15 3-3 3 3m-3-3v9" /></>,
  history: <path d="M3 11a9 9 0 1 1 2.5 7.2M3 5v6h6M12 7v5l3 2" />,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><rect x="9" y="2" width="6" height="4" rx="1" /><path d="m9 13 2 2 4-4M9 18h6" /></>,
  "user-plus": <><circle cx="9" cy="7" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2H3Zm16-13v6m-3-3h6" /></>,
  sliders: <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 3v6m8 0v6m-6 0v6" /></>,
  shield: <><path d="m12 3 8 3v6c0 4.5-4 7.7-8 9-4-1.3-8-4.5-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  user: <><circle cx="12" cy="7" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2H5Z" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
};

export default function FoundationIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: FoundationIconName }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}
