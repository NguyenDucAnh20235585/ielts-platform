import { Suspense } from "react";
import { AdminCataloguePage } from "@/frontend/features/admin/catalogue-page";

export default function Page() {
  return <Suspense><AdminCataloguePage /></Suspense>;
}
