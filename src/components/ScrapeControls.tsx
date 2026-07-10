"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

type ScrapeState = {
  label: string;
  detail: string;
  running: boolean;
};

type LiveItem = {
  id: string;
  title: string;
  source_name: string;
  category: string;
  deadline: string | null;
  original_url: string;
  recommendation?: {
    score: number;
    status: "recommend" | "maybe" | "exclude";
    reasons: string[];
    warnings: string[];
  };
};

const AUTO_INTERVAL_MS = 60 * 60 * 1000;

export function ScrapeControls() {
  const [state, setState] = useState<ScrapeState>({
    label: "스크랩 대기",
    detail: "사이트가 열리면 새 공고를 확인합니다.",
    running: false
  });
  const [items, setItems] = useState<LiveItem[]>([]);
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
      const liveItems = Array.isArray(payload.result?.items) ? payload.result.items : [];
      setItems(liveItems.filter((item: LiveItem) => item.recommendation?.status !== "exclude").slice(0, 12));
      setState({
        label: "스크랩 완료",
        detail:
          payload.result?.mode === "live"
            ? `수집 ${payload.result?.scraped ?? 0}개, 맞춤 후보 ${liveItems.length}개`
            : `수집 ${payload.result?.scraped ?? 0}개, 저장/갱신 ${upserted}개 · 만료 삭제 ${payload.result?.deleted ?? 0}개`,
        running: false
      });

      if (reloadOnUpdate && payload.result?.mode !== "live") {
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
    <div className="scrape-shell">
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

      {items.length ? (
        <section className="live-panel">
          <h2>오늘 볼 만한 활동</h2>
          <div className="category-groups">
            {Array.from(new Set(items.map((item) => item.category))).map((category) => (
              <div className="category-group" key={category}>
                <h3>{category}</h3>
                <div className="live-list">
                  {items.filter((item) => item.category === category).map((item) => (
                    <a className="live-item" href={item.original_url} target="_blank" rel="noreferrer" key={item.id}>
                      <strong>{item.title}</strong>
                      <span>
                        {item.source_name} · {item.deadline ?? "마감 확인 필요"} · {item.recommendation?.score ?? "-"}점
                      </span>
                      <small>{item.recommendation?.reasons?.[0] ?? item.recommendation?.warnings?.[0] ?? "조건 확인 필요"}</small>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
