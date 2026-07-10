import { OpportunityItem } from "@/components/OpportunityItem";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const data = await getDashboardData();
  const rows = data.rows.sort((a, b) => (b.recommendation?.score ?? 0) - (a.recommendation?.score ?? 0));
  const categories = Array.from(new Set(rows.map((item) => item.category)));

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">전체 수집 결과</p>
          <h1>전체 공고</h1>
          <p className="muted">추천, 검토, 제외까지 한 번에 보고 원문으로 이동할 수 있어요.</p>
        </div>
      </section>

      <section className="panel">
        {rows.length ? categories.map((category) => (
          <div className="category-group" key={category}>
            <h2>{category}</h2>
            <div className="list">{rows.filter((item) => item.category === category).map((item) => <OpportunityItem key={item.id} item={item} />)}</div>
          </div>
        )) : <div className="empty">수집된 공고가 없습니다.</div>}
      </section>
    </>
  );
}
