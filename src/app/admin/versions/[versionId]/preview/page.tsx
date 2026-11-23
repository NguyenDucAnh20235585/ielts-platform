import { AdminPreviewPage } from "@/features/admin/preview-page";

export default async function Page({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  return <AdminPreviewPage versionId={versionId} />;
}
