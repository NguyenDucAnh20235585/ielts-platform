import { HistoryPage } from "@/frontend/features/student/pages/history-page";
export const metadata = { title: "Lịch sử làm bài | Ms Chau’s IELTS" };
export default async function Page({ searchParams }: { searchParams: Promise<{ test_id?: string }> }) {
  const { test_id } = await searchParams;
  return <HistoryPage key={test_id ?? "all"} initialTestId={test_id ?? ""} />;
}
