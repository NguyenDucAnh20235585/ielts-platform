import { HistoryPage } from "@/features/student/history-page";
export const metadata = { title: "Lịch sử làm bài | IELTS R&L" };
export default async function Page({ searchParams }: { searchParams: Promise<{ test_id?: string }> }) {
  const { test_id } = await searchParams;
  return <HistoryPage key={test_id ?? "all"} initialTestId={test_id ?? ""} />;
}
