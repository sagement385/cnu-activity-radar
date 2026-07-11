import { RadarDashboard } from "@/components/RadarDashboard";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getDashboardData();

  return <RadarDashboard rows={data.rows} stats={data.stats} lastScrapeAt={data.lastScrapeAt} error={!data.ok ? data.error : undefined} />;
}
