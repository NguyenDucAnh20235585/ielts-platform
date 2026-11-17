import { ResultPage } from "@/features/student/result-page";
export const metadata = { title: "Kết quả | IELTS R&L" };
export default async function Page({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <ResultPage key={attemptId} attemptId={attemptId} />;
}
