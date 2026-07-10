"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

type ScrapeState = {
  label: string;
  detail: string;
  running: boolean;
};

const AUTO_INTERVAL_MS = 60 * 60 * 1000;

export function ScrapeControls() {
  const [state, setState] = useState<ScrapeState>({
    label: "스크랩 대기",
    detail: "사이트가 열리면 새 공고를 확인합니다.",
    running: false
  });
  const [isPending, startTransition] = useTransition();

  const runScrape = useCallback(async (force = false, reloadOnUpdate = false) => {
    setState({
      label: "스크랩 중",
      detail: "전남대/기계공학부/링커리어를 확인하고 있어요.",
      running: true
    });

    try {
      const response = await fetch(`/api/scrape${force ? "?force=1" : ""}`, {
        cache: "no-store"
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "스크랩 실패");
      }

      if (payload.skipped) {
        setState({
          label: "최근 스크랩 완료",
          detail: payload.minutesSinceLastRun === null ? "최근 결과를 사용합니다." : `${payload.minutesSinceLastRun}분 전에 확인해서 이번엔 건너뜁니다.`,
          running: false
        });
        return;
      }

      const upserted = payload.result?.upserted ?? 0;
      setState({
        label: "스크랩 완료",
        detail: `수집 ${payload.result?.scraped ?? 0}개, 저장/갱신 ${upserted}개`,
        running: false
      });

      if (reloadOnUpdate) {
        window.setTimeout(() => window.location.reload(), 600);
      }
    } catch (error) {
      setState({
        label: "스크랩 확인 필요",
        detail: error instanceof Error ? error.message : "환경변수 또는 DB 연결을 확인해야 합니다.",
        running: false
      });
    }
  }, []);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DISABLE_AUTO_SCRAPE === "true") {
      return;
    }

    runScrape(false, true);
    const intervalId = window.setInterval(() => runScrape(false, true), AUTO_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [runScrape]);

  return (
    <div className="scrape-status">
      <div>
        <strong>{state.label}</strong>
        <span>{state.detail}</span>
      </div>
      <button
        className="button secondary"
        type="button"
        disabled={state.running || isPending}
        onClick={() => startTransition(() => runScrape(true, true))}
      >
        지금 스크랩
      </button>
    </div>
  );
}
