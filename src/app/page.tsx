import type { Metadata } from "next";
import FoundationPage from "@/features/foundation/foundation-page";

export const metadata: Metadata = {
  title: "Ms Chau’s IELTS | Reading & Listening Practice",
  description:
    "Luyện tập IELTS Reading và Listening cùng Ms Chau’s IELTS. Chọn kỹ năng, luyện tập hoặc thi thử và theo dõi kết quả của bạn.",
};

export default function Home() {
  return <FoundationPage />;
}
