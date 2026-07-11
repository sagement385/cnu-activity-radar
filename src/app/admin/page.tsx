import { loginAdmin } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";

  return (
    <main className="auth-shell">
      <section className="panel auth-panel">
        <p className="eyebrow">CNU Activity Radar</p>
        <h1>관리자 접속</h1>
        <p className="muted">맞춤 공고와 설정을 확인하려면 비밀번호를 입력하세요.</p>
        <form action={loginAdmin} className="auth-form">
          <input type="hidden" name="next" value={nextPath} />
          <label>
            관리자 비밀번호
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {params.error === "locked" ? <p className="error-text">로그인 시도가 많아 15분 뒤 다시 시도할 수 있습니다.</p> : params.error ? <p className="error-text">비밀번호가 맞지 않습니다.</p> : null}
          <button className="button" type="submit">설정 열기</button>
        </form>
      </section>
    </main>
  );
}
