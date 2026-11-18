import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import Script from "next/script";
import { foundationThemeInitScript } from "@/features/foundation/foundation-theme-config";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-be-vietnam-pro",
});

export const metadata: Metadata = {
  title: "IELTS Reading & Listening",
  description:
    "Luyện đọc và nghe, trải nghiệm chế độ thi thử và xem lại kết quả để hiểu rõ bài làm của bạn.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnamPro.variable} h-full`} suppressHydrationWarning>
      <head>
        <Script
          id="foundation-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: foundationThemeInitScript }}
        />
      </head>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
