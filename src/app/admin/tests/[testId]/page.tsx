import { AdminTestDetailPage } from "@/features/admin/test-detail-page";

export default async function Page({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  return <AdminTestDetailPage testId={testId} />;
}
