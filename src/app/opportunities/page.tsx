import { OpportunityExplorer } from "@/components/OpportunityExplorer";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const data = await getDashboardData();
  return <>
    <section className="page-head"><div><p className="eyebrow">수집 결과</p><h1>전체 공고</h1><p className="muted">추천·검토·제외 상태와 전남대학교 공식 출처를 함께 확인할 수 있습니다.</p></div></section>
    <OpportunityExplorer rows={data.rows} lastScrapeAt={data.lastScrapeAt} />
  </>;
}
