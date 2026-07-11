import type { OpportunityWithRecommendation } from "@/lib/types";

export function OpportunityItem({ item }: { item: OpportunityWithRecommendation }) {
  const recommendation = item.recommendation;
  const status = recommendation?.status ?? "maybe";
  const label = status === "recommend" ? "추천" : status === "maybe" ? "검토" : "제외";
  const reason = recommendation?.reasons?.[0] || recommendation?.warnings?.[0] || item.summary || "세부 내용을 확인해야 합니다.";

  return (
    <article className="opportunity">
      <div className="opportunity-poster">
        <span>{item.category.slice(0, 2)}</span>
        {item.poster_url ? <img src={item.poster_url} alt="공고 포스터" loading="lazy" /> : null}
      </div>
      <div className="opportunity-head">
        <div>
          <h3>{item.title}</h3>
          <div className="meta">
            <span>{item.source_name}</span>
            {(item.source_refs?.length ?? 0) > 1 ? <span>출처 {item.source_refs?.length}곳에서 확인됨</span> : null}
            <span>{item.category}</span>
            <span>마감 {item.deadline ?? "확인 필요"}</span>
            {recommendation?.is_paid ? <span>활동비 가능</span> : null}
            {recommendation?.is_major_relevant ? <span>전공 관련</span> : null}
          </div>
        </div>
        <span className={`pill ${status}`}>{label} {recommendation?.score ?? "-"}점</span>
      </div>
      <p className="reason">{reason}</p>
      {(item.source_refs?.length ?? 0) > 1 ? <p className="reason">확인 출처: {item.source_refs?.map((source) => source.sourceName).join(" · ")}</p> : null}
      {recommendation?.warnings?.length ? <p className="reason">주의: {recommendation.warnings[0]}</p> : null}
      <div className="actions">
        <a href={item.original_url} className="button secondary" target="_blank" rel="noreferrer">
          원문 보기
        </a>
      </div>
    </article>
  );
}
