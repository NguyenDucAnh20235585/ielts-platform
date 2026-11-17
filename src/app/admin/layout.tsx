import type { Metadata } from "next";
import { AdminProvider } from "@/features/admin/admin-context";

export const metadata: Metadata = { title: "Quản trị | IELTS R&L", robots: { index: false, follow: false } };
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminProvider>{children}</AdminProvider>;
}
