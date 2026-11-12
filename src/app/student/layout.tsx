import type { ReactNode } from "react";
import { StudentProvider } from "@/features/student/student-context";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return <StudentProvider>{children}</StudentProvider>;
}
