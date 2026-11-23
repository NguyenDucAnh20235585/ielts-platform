import { WorkspacePage } from "@/features/student/workspace-page";
export const metadata = { title: "Làm bài | Ms Chau’s IELTS" };
export default async function Page({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <WorkspacePage key={attemptId} attemptId={attemptId} />;
}
