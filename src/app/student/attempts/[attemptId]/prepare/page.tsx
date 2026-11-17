import { PreparePage } from "@/features/student/prepare-page";
export const metadata = { title: "Chuẩn bị làm bài | Ms Chau’s IELTS" };
export default async function Page({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <PreparePage key={attemptId} attemptId={attemptId} />;
}
