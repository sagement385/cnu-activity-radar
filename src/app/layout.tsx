import type { Metadata } from "next";
import { AppChrome } from "@/components/AppChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "CNU Activity Radar",
  description: "전남대 맞춤 공고 큐레이터"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
