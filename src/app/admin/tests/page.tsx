import { Suspense } from "react";
import { AdminCataloguePage } from "@/frontend/features/admin/pages/catalogue-page";

export default function Page() {
  return <Suspense><AdminCataloguePage /></Suspense>;
}
