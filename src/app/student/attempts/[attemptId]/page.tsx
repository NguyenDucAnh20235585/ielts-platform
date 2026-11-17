import { WorkspacePage } from "@/features/student/workspace-page";
export const metadata = { title: "Làm bài | IELTS R&L" };
export default async function Page({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <WorkspacePage key={attemptId} attemptId={attemptId} />;
}
