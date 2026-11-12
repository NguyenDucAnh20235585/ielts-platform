import { ResultPage } from "@/features/student/result-page";
export const metadata = { title: "Kết quả bài làm | Ms Chau’s IELTS" };
export default async function Page({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <ResultPage key={attemptId} attemptId={attemptId} />;
}
