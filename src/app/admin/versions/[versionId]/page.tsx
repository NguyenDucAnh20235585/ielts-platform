import { AdminWorkspacePage } from "@/features/admin/workspace-page";

export default async function Page({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;
  return <AdminWorkspacePage versionId={versionId} />;
}
