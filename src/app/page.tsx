import { getDashboardData } from "@/lib/dashboard";
import { OpportunityItem } from "@/components/OpportunityItem";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getDashboardData();
  const recommended = data.rows
    .filter((item) => item.recommendation?.status === "recommend")
    .sort((a, b) => (b.recommendation?.score ?? 0) - (a.recommendation?.score ?? 0))
    .slice(0, 8);
  const maybe = data.rows
    .filter((item) => item.recommendation?.status === "maybe")
    .sort((a, b) => (b.recommendation?.score ?? 0) - (a.recommendation?.score ?? 0))
    .slice(0, 5);

  return (
    <>
      <section className="page-head">
        <div>
          <p className="eyebrow">맞춤 공고 큐레이터</p>
          <h1>오늘 볼 만한 활동</h1>
          <p className="muted">전남대, 기계공학부, 링커리어 공고를 훑고 네 조건에 맞는 것만 추려요.</p>
        </div>
        <a className="button" href="/api/cron/digest?period=manual" target="_blank" rel="noreferrer">
          수동 실행
        </a>
      </section>

      {!data.ok ? (
        <section className="empty">
          Supabase 환경변수 또는 스키마 설정이 아직 필요합니다. `.env.local`과 `supabase/schema.sql`을 확인하세요.
          <br />
          오류: {data.error}
        </section>
      ) : null}

      <section className="grid stats">
        <div className="stat">
          추천
          <strong>{data.stats.recommend}</strong>
        </div>
        <div className="stat">
          검토
          <strong>{data.stats.maybe}</strong>
        </div>
        <div className="stat">
          제외
          <strong>{data.stats.exclude}</strong>
        </div>
        <div className="stat">
          최근 공고
          <strong>{data.stats.total}</strong>
        </div>
      </section>

      <section className="panel">
        <h2>추천 공고</h2>
        <div className="list">
          {recommended.length ? recommended.map((item) => <OpportunityItem key={item.id} item={item} />) : <div className="empty">아직 추천 공고가 없습니다.</div>}
        </div>
      </section>

      <section className="panel">
        <h2>검토 필요</h2>
        <div className="list">
          {maybe.length ? maybe.map((item) => <OpportunityItem key={item.id} item={item} />) : <div className="empty">검토할 공고가 없습니다.</div>}
        </div>
      </section>
    </>
  );
}
