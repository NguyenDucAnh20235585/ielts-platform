import { TestDetailPage } from "@/features/student/test-detail-page";
export const metadata = { title: "Chi tiết đề | IELTS R&L" };
export default async function Page({ params, searchParams }: { params: Promise<{ testId: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { testId } = await params;
  const { mode } = await searchParams;
  return <TestDetailPage key={testId} testId={testId} initialMode={mode === "PRACTICE" || mode === "MOCK" ? mode : null} />;
}
