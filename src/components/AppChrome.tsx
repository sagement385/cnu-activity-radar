"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrapeControls } from "./ScrapeControls";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin") {
    return <>{children}</>;
  }

  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand">CNU Activity Radar</Link>
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
    </>
  );
}
