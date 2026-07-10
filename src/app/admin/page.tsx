import { loginAdmin } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;

  return (
    <main className="auth-shell">
      <section className="panel auth-panel">
        <p className="eyebrow">CNU Activity Radar</p>
        <h1>관리자 접속</h1>
        <p className="muted">맞춤 공고와 설정을 확인하려면 비밀번호를 입력하세요.</p>
        <form action={loginAdmin} className="auth-form">
          <label>
            관리자 비밀번호
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {params.error ? <p className="error-text">비밀번호가 맞지 않습니다.</p> : null}
          <button className="button" type="submit">접속</button>
        </form>
      </section>
    </main>
  );
}
