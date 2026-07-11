import { SettingsControlPanel } from "@/components/SettingsControlPanel";
import { getAdminData } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const data = await getAdminData();
  return (
    <>
      <section className="page-head settings-page-head">
        <div><p className="eyebrow">관리자 제어판</p><h1>맞춤 수집 및 추천 설정</h1><p className="muted">변경한 값은 DB에 저장되고 다음 수집·분류·추천·카카오 알림부터 실제 적용됩니다.</p></div>
      </section>
      <SettingsControlPanel initialSettings={data.settings} initialSources={data.sources} runs={data.runs} lastSavedAt={data.lastSavedAt} />
    </>
  );
}
