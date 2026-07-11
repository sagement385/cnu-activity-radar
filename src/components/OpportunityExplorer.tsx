"use client";

import { useMemo, useState } from "react";
import { OpportunityItem } from "./OpportunityItem";
import type { OpportunityWithRecommendation } from "@/lib/types";

type SortMode = "score" | "deadline" | "latest" | "benefit" | "major";
type SourceFilter = "all" | "jnu" | "international" | "career" | "education" | "engineering" | "mechanical" | "external";

const SOURCE_FILTERS: Array<[SourceFilter, string]> = [
  ["all", "전체"], ["jnu", "전남대학교"], ["international", "국제협력"], ["career", "취업지원"],
  ["education", "비교과"], ["engineering", "공과대학"], ["mechanical", "기계공학부"], ["external", "외부 사이트"]
];

function sourceMatches(item: OpportunityWithRecommendation, filter: SourceFilter) {
  const id = item.source_id ?? "";
  if (filter === "all") return true;
  if (filter === "jnu") return id.startsWith("jnu_");
  if (filter === "international") return id.includes("international");
  if (filter === "career") return id.includes("jobcenter");
  if (filter === "education") return id.includes("education") || id === "jnu_events";
  if (filter === "engineering") return id.includes("engineering");
  if (filter === "mechanical") return id.includes("mech");
  return !id.startsWith("jnu_");
}

export function OpportunityExplorer({ rows, lastScrapeAt }: { rows: OpportunityWithRecommendation[]; lastScrapeAt: string | null }) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [quickFilter, setQuickFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("score");

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows
      .filter((item) => sourceMatches(item, sourceFilter))
      .filter((item) => {
        if (!quickFilter) return true;
        if (quickFilter === "마감") {
          if (!item.deadline) return false;
          const days = Math.ceil((new Date(`${item.deadline}T23:59:59+09:00`).getTime() - Date.now()) / 86400000);
          return days >= 0 && days <= 7;
        }
        return `${item.title} ${item.category} ${item.source_name} ${item.raw_text}`.includes(quickFilter);
      })
      .filter((item) => !keyword || `${item.title} ${item.organization ?? ""} ${item.category} ${item.raw_text}`.toLowerCase().includes(keyword))
      .sort((a, b) => {
        if (sort === "deadline") return (a.deadline ?? "9999-12-31").localeCompare(b.deadline ?? "9999-12-31");
        if (sort === "latest") return new Date(b.first_seen_at).getTime() - new Date(a.first_seen_at).getTime();
        if (sort === "benefit") return Number(b.recommendation?.is_paid) - Number(a.recommendation?.is_paid) || (b.recommendation?.score ?? 0) - (a.recommendation?.score ?? 0);
        if (sort === "major") return Number(b.recommendation?.is_major_relevant) - Number(a.recommendation?.is_major_relevant) || (b.recommendation?.score ?? 0) - (a.recommendation?.score ?? 0);
        return (b.recommendation?.score ?? 0) - (a.recommendation?.score ?? 0);
      });
  }, [quickFilter, rows, search, sort, sourceFilter]);

  const categories = Array.from(new Set(filtered.map((item) => item.category)));
  return <>
    <section className="opportunity-filters">
      <label className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="제목, 기관, 분야 검색" /></label>
      <div className="source-filter-row" role="group" aria-label="출처 필터">{SOURCE_FILTERS.map(([value, label]) => <button type="button" className={sourceFilter === value ? "active" : ""} onClick={() => setSourceFilter(value)} key={value}>{label}</button>)}</div>
      <div className="quick-filter-row">{["전남대", "기계공학", "국제교류", "장학", "취업", "마감"].map((label) => <button type="button" className={quickFilter === label ? "active" : ""} onClick={() => setQuickFilter(quickFilter === label ? "" : label)} key={label}>{label === "마감" ? "마감 임박" : label}</button>)}</div>
      <label className="sort-control">정렬<select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="score">추천순</option><option value="deadline">마감 임박순</option><option value="latest">최신 등록순</option><option value="benefit">활동비·장학금순</option><option value="major">전공 적합도순</option></select></label>
    </section>

    <section className="panel opportunity-results">
      <div className="result-heading"><h2>전체 공고</h2><span>{filtered.length}건</span></div>
      {filtered.length ? categories.map((category) => <div className="category-group" key={category}><h3>{category}</h3><div className="list">{filtered.filter((item) => item.category === category).map((item) => <OpportunityItem key={item.id} item={item} />)}</div></div>) : <div className="empty">현재 조건에 맞는 새로운 공고가 없습니다.<br />마지막 확인: {lastScrapeAt ? new Date(lastScrapeAt).toLocaleString("ko-KR") : "수집 기록 없음"}</div>}
    </section>
  </>;
}
