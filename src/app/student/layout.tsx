import type { ReactNode } from "react";
import { StudentProvider } from "@/frontend/features/student/state/student-context";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return <StudentProvider>{children}</StudentProvider>;
}
