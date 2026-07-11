"use client";

import { useMemo, useState } from "react";
import type { OpportunityWithRecommendation } from "@/lib/types";

type Stats = {
  recommend: number;
  maybe: number;
  exclude: number;
  total: number;
};

type RadarDashboardProps = {
  rows: OpportunityWithRecommendation[];
  stats: Stats;
  lastScrapeAt: string | null;
  error?: string;
};

const CATEGORY_TABS = ["전체", "서포터즈", "공모전", "대외활동", "교육·캠프"];
const INTEREST_CATEGORIES = ["AI/IT", "교육/강연", "사회공헌", "마케팅/기획", "디자인"];

type MenuFilter = "recommend" | "saved" | "maybe" | "deadline";
type Scope = "전체" | "교내" | "교외";

function isExternal(item: OpportunityWithRecommendation) {
  return !item.source_id?.startsWith("jnu");
}

function dday(date: string | null) {
  if (!date) {
    return "마감 확인";
  }

  const target = new Date(`${date}T23:59:59+09:00`);
  const today = new Date();
  const remaining = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (remaining < 0) {
    return "마감";
  }

  return remaining === 0 ? "D-Day" : `D-${remaining}`;
}

function formatScrapeTime(value: string | null) {
  if (!value) {
    return "아직 수집 기록이 없습니다";
  }

  return `최근 수집 ${new Date(value).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
}

function Poster({ item, large = false }: { item: OpportunityWithRecommendation; large?: boolean }) {
  return (
    <div className={`poster ${large ? "poster-large" : ""}`}>
      <span className="poster-fallback" aria-hidden="true">{item.category.slice(0, 2)}</span>
      {item.poster_url ? <img src={item.poster_url} alt="공고 포스터" loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
    </div>
  );
}

function SourceBadge({ item }: { item: OpportunityWithRecommendation }) {
  return <span className={`source-badge ${isExternal(item) ? "external" : "campus"}`}>{isExternal(item) ? "교외" : "교내"}</span>;
}

export function RadarDashboard({ rows, stats, lastScrapeAt, error }: RadarDashboardProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("전체");
  const [scope, setScope] = useState<Scope>("전체");
  const [menuFilter, setMenuFilter] = useState<MenuFilter>("recommend");
  const [selectedId, setSelectedId] = useState("");

  const baseRows = useMemo(() => {
    return rows
      .filter((item) => {
        const status = item.recommendation?.status;
        if (menuFilter === "recommend") return status === "recommend";
        if (menuFilter === "maybe") return status === "maybe";
        if (menuFilter === "deadline") {
          const value = item.deadline ? dday(item.deadline) : "";
          return value.startsWith("D-") && Number(value.slice(2)) <= 7;
        }
        return status !== "exclude";
      })
      .filter((item) => scope === "전체" || (scope === "교외" ? isExternal(item) : !isExternal(item)))
      .sort((a, b) => (b.recommendation?.score ?? 0) - (a.recommendation?.score ?? 0));
  }, [menuFilter, rows, scope]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return baseRows.filter((item) => {
      const categoryMatch = activeCategory === "전체" || item.category === activeCategory;
      const searchMatch = !keyword || `${item.title} ${item.organization ?? ""} ${item.source_name} ${item.raw_text}`.toLowerCase().includes(keyword);
      return categoryMatch && searchMatch;
    });
  }, [activeCategory, baseRows, search]);

  const selected = filteredRows.find((item) => item.id === selectedId) ?? filteredRows[0] ?? null;
  const categoryCounts = new Map(CATEGORY_TABS.map((category) => [category, category === "전체" ? baseRows.length : baseRows.filter((item) => item.category === category).length]));
  const imminentCount = rows.filter((item) => item.deadline && dday(item.deadline).startsWith("D-") && Number(dday(item.deadline).slice(2)) <= 7).length;

  return (
    <>
      <section className="radar-toolbar">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="키워드, 기관, 분야로 검색해보세요" aria-label="공고 검색" />
          {search ? <button type="button" onClick={() => setSearch("")} aria-label="검색어 지우기">×</button> : null}
        </label>
        <button type="button" className="filter-button">관심 키워드 <span>⌄</span></button>
        <button type="button" className="filter-button">전공/학과 <span>⌄</span></button>
        <button type="button" className="filter-button">학년 <span>⌄</span></button>
        <button type="button" className="filter-button">활동 지역 <span>⌄</span></button>
        <button type="button" className="filter-button">기간 <span>⌄</span></button>
        <div className="scope-toggle" aria-label="공고 범위">
          {(["전체", "교내", "교외"] as Scope[]).map((value) => (
            <button type="button" className={scope === value ? "active" : ""} onClick={() => setScope(value)} key={value}>{value}</button>
          ))}
        </div>
      </section>

      <div className="category-tabs" role="tablist" aria-label="공고 카테고리">
        {CATEGORY_TABS.map((category) => (
          <button type="button" role="tab" aria-selected={activeCategory === category} className={activeCategory === category ? "active" : ""} onClick={() => setActiveCategory(category)} key={category}>
            <span aria-hidden="true">{category === "서포터즈" ? "♧" : category === "공모전" ? "♜" : category === "대외활동" ? "▣" : category === "교육·캠프" ? "▤" : "✦"}</span>
            {category}
            <small>{categoryCounts.get(category)}</small>
          </button>
        ))}
      </div>

      {error ? <div className="notice error-text">저장된 데이터를 불러오지 못했습니다. {error}</div> : null}

      <section className="radar-layout">
        <aside className="radar-sidebar">
          <h2>맞춤 탐색</h2>
          <button type="button" className={menuFilter === "recommend" ? "side-link active" : "side-link"} onClick={() => setMenuFilter("recommend")}><span>♧</span> 전체 추천 <b>{stats.recommend}</b></button>
          <button type="button" className={menuFilter === "saved" ? "side-link active" : "side-link"} onClick={() => setMenuFilter("saved")}><span>☆</span> 스크랩한 공고 <b>{stats.total}</b></button>
          <button type="button" className={menuFilter === "maybe" ? "side-link active" : "side-link"} onClick={() => setMenuFilter("maybe")}><span>◷</span> 검토 필요 <b>{stats.maybe}</b></button>
          <button type="button" className={menuFilter === "deadline" ? "side-link active" : "side-link"} onClick={() => setMenuFilter("deadline")}><span>♟</span> 마감 임박 (7일) <b>{imminentCount}</b></button>

          <div className="sidebar-divider" />
          <h2>관심 카테고리</h2>
          {INTEREST_CATEGORIES.map((category) => <button type="button" className="side-link category-interest" key={category} onClick={() => setSearch(category)}><span>◉</span> {category}</button>)}
          <button type="button" className="side-link add-category" onClick={() => setActiveCategory("전체")}><span>＋</span> 카테고리 관리</button>
        </aside>

        <div className="radar-main">
          <div className="stat-grid">
            <div className="stat-card"><span className="stat-icon green">✦</span><div><span>추천</span><strong>{stats.recommend}</strong><small>나에게 맞는 공고</small></div></div>
            <div className="stat-card"><span className="stat-icon orange">◷</span><div><span>검토 필요</span><strong>{stats.maybe}</strong><small>내용 확인이 필요해요</small></div></div>
            <div className="stat-card"><span className="stat-icon red">♟</span><div><span>마감 임박</span><strong>{imminentCount}</strong><small>7일 이내 마감</small></div></div>
            <div className="stat-card"><span className="stat-icon blue">▮</span><div><span>스크랩 기록</span><strong>{stats.total}</strong><small>{formatScrapeTime(lastScrapeAt)}</small></div></div>
          </div>

          <div className="section-heading">
            <div><h1>{activeCategory === "전체" ? "오늘 볼 만한 활동" : `${activeCategory} 추천`}</h1><span>{filteredRows.length}개 공고 · {formatScrapeTime(lastScrapeAt)}</span></div>
            <label className="sort-select">최신순 <span>⌄</span></label>
          </div>

          <div className="radar-list">
            {filteredRows.length ? filteredRows.slice(0, 30).map((item) => {
              const recommendation = item.recommendation;
              const status = recommendation?.status ?? "maybe";
              return (
                <article className={`radar-card ${selected?.id === item.id ? "selected" : ""}`} key={item.id}>
                  <button type="button" className="card-select" onClick={() => setSelectedId(item.id)} aria-label={`${item.title} 상세 보기`}>
                    <Poster item={item} />
                    <div className="card-content">
                      <div className="card-title-row"><span className={`match-pill ${status}`}>{status === "recommend" ? "매칭" : "검토"} {recommendation?.score ?? "-"}%</span><h3>{item.title}</h3></div>
                      <div className="card-meta"><span>▣ {item.organization ?? item.source_name}</span><span>◷ {item.deadline ?? "마감 확인 필요"} ({dday(item.deadline)})</span></div>
                      <div className="tag-row"><SourceBadge item={item} /><span>{item.category}</span>{recommendation?.is_major_relevant ? <span>전공 관련</span> : null}{recommendation?.is_paid ? <span>활동비 가능</span> : null}</div>
                      <p>{recommendation?.reasons?.[0] ?? recommendation?.warnings?.[0] ?? item.summary ?? "공고 세부 내용을 확인해보세요."}</p>
                    </div>
                  </button>
                  <span className="bookmark-mark" aria-hidden="true">♧</span>
                </article>
              );
            }) : <div className="empty">조건에 맞는 공고가 없습니다. 다른 카테고리나 교내·교외 범위를 선택해보세요.</div>}
          </div>
          {filteredRows.length > 30 ? <button className="more-button" type="button">더 많은 공고 보기 <span>⌄</span></button> : null}
        </div>

        <aside className="detail-panel">
          <div className="detail-heading"><h2>추천 공고 상세</h2><span aria-hidden="true">×</span></div>
          {selected ? <>
            <Poster item={selected} large />
            <h2 className="detail-title">{selected.title}</h2>
            <div className="detail-meta"><SourceBadge item={selected} /><span>{selected.organization ?? selected.source_name}</span><span>{selected.deadline ?? "마감 확인 필요"} ({dday(selected.deadline)})</span></div>
            <section className="detail-section"><h3>추천 이유</h3>{(selected.recommendation?.reasons?.length ? selected.recommendation.reasons : [selected.summary ?? "공고의 세부 내용을 확인하면 좋아요."]).slice(0, 3).map((reason) => <p key={reason}><b>✓</b>{reason}</p>)}</section>
            <section className="detail-section"><h3>주요 정보</h3><dl><div><dt>주최/주관</dt><dd>{selected.organization ?? selected.source_name}</dd></div><div><dt>활동 분야</dt><dd>{selected.category}</dd></div><div><dt>활동 장소</dt><dd>{selected.location ?? "광주/전남 또는 온라인 여부 확인 필요"}</dd></div></dl></section>
            <section className="detail-section"><h3>지원 포인트</h3><div className="tag-row">{(selected.tags ?? [selected.category]).slice(0, 4).map((tag) => <span key={tag}>#{tag}</span>)}</div></section>
            <div className="detail-actions"><a href={selected.original_url} target="_blank" rel="noreferrer" className="button secondary">스크랩 기록</a><a href={selected.original_url} target="_blank" rel="noreferrer" className="button">공고 자세히 보기 ↗</a></div>
          </> : <div className="empty">상세히 볼 공고를 선택해보세요.</div>}
        </aside>
      </section>

      <section className="summary-strip">
        <div><span>공고 요약</span><small>{activeCategory === "전체" ? "전체 추천 공고" : `${activeCategory} 카테고리`}의 핵심 정보</small></div>
        <div><small>평균 마감까지 남은 기간</small><strong>{selected?.deadline ? dday(selected.deadline).replace("D-", "") : "확인 필요"}</strong></div>
        <div><small>참여 시 혜택 비율</small><strong>{rows.filter((item) => item.recommendation?.is_paid).length ? "활동비·상금" : "공고별 확인"}</strong></div>
        <div><small>참가 대상</small><strong>재학생 중심</strong></div>
        <div><small>자주 등장 키워드</small><strong>AI, 공학, 콘텐츠</strong></div>
      </section>
    </>
  );
}
