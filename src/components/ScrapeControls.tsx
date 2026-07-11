"use client";

import { useCallback, useState, useTransition } from "react";

type ScrapeState = {
  label: string;
  detail: string;
  running: boolean;
};

export function ScrapeControls() {
  const [state, setState] = useState<ScrapeState>({
    label: "저장된 공고를 표시 중",
    detail: "사이트에 들어올 때마다 새로 긁지 않고 DB에 저장된 결과를 보여줍니다.",
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
          detail: payload.minutesSinceLastRun === null ? "최근 저장 결과를 사용합니다." : `${payload.minutesSinceLastRun}분 전에 확인해서 이번엔 건너뜁니다.`,
          running: false
        });
        return;
      }

      const upserted = payload.result?.upserted ?? 0;
      setState({
        label: "스크랩 완료",
        detail:
          payload.result?.mode === "live"
            ? `수집 ${payload.result?.scraped ?? 0}개, 맞춤 후보 ${payload.result?.recommendations ?? 0}개`
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

  return (
    <div className="scrape-shell">
      <div className="scrape-status" id="history">
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
    </div>
  );
}
