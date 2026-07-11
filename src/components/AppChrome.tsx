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
        <div className="brand-wrap">
          <Link href="/" className="brand">CNU Activity Radar</Link>
          <span className="brand-subtitle">내 상황에 맞는 공고를 자동으로 찾는 맞춤형 탐색 도구</span>
        </div>
        <nav className="primary-nav">
          <Link href="/" className={pathname === "/" ? "active" : undefined} aria-current={pathname === "/" ? "page" : undefined}>
            <span aria-hidden="true">★</span> 오늘 추천
          </Link>
          <Link href="/opportunities" className={pathname === "/opportunities" ? "active" : undefined} aria-current={pathname === "/opportunities" ? "page" : undefined}>
            <span aria-hidden="true">▤</span> 전체 공고
          </Link>
          <Link href="/opportunities#history">
            <span aria-hidden="true">▣</span> 수집 기록
          </Link>
          <Link href="/settings" className={pathname.startsWith("/settings") ? "active" : undefined} aria-current={pathname.startsWith("/settings") ? "page" : undefined}>
            <span aria-hidden="true">⚙</span> 설정
          </Link>
        </nav>
        <div className="profile-chip" aria-label="현재 사용자">김</div>
      </header>
      <main>
        <ScrapeControls />
        {children}
      </main>
    </>
  );
}
