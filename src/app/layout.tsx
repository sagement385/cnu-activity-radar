import type { Metadata } from "next";
import Link from "next/link";
import { ScrapeControls } from "@/components/ScrapeControls";
import "./globals.css";

export const metadata: Metadata = {
  title: "CNU Activity Radar",
  description: "전남대 맞춤 공고 큐레이터"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            CNU Activity Radar
          </Link>
          <nav>
            <Link href="/">오늘 추천</Link>
            <Link href="/opportunities">전체 공고</Link>
            <Link href="/settings">설정</Link>
          </nav>
        </header>
        <main>
          <ScrapeControls />
          {children}
        </main>
      </body>
    </html>
  );
}
