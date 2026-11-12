import { CataloguePage } from "@/features/student/catalogue-page";
export const metadata = { title: "Thư viện đề | Ms Chau’s IELTS" };
export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  return <CataloguePage key={type ?? "all"} initialType={type === "READING" || type === "LISTENING" ? type : ""} />;
}
