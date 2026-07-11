import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-session";
import { appUrl } from "@/lib/env";
import { sendKakaoMessage } from "@/lib/kakao";

export async function POST() {
  const cookieStore = await cookies();
  if (!(await verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const origin = (await headers()).get("origin");
  if (origin && origin !== new URL(appUrl()).origin) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });

  try {
    await sendKakaoMessage("[CNU Activity Radar]\n테스트 알림입니다. 카카오톡 연결이 정상적으로 동작합니다.");
    return NextResponse.json({ ok: true, message: "테스트 알림을 보냈습니다." });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "테스트 알림 실패" }, { status: 500 });
  }
}
