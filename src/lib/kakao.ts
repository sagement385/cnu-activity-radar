import { appUrl, optionalEnv } from "./env";

type KakaoTextTemplate = {
  object_type: "text";
  text: string;
  link: {
    web_url: string;
    mobile_web_url: string;
  };
  button_title: string;
};

export async function sendKakaoMessage(text: string) {
  if (process.env.NOTIFICATION_DRY_RUN === "true") {
    return { ok: true, dryRun: true };
  }

  const token = await getKakaoAccessToken();

  if (!token) {
    throw new Error("Kakao token is not configured. Set KAKAO_REFRESH_TOKEN or KAKAO_ACCESS_TOKEN.");
  }

  const template: KakaoTextTemplate = {
    object_type: "text",
    text: text.slice(0, 950),
    link: {
      web_url: appUrl(),
      mobile_web_url: appUrl()
    },
    button_title: "대시보드 보기"
  };

  const body = new URLSearchParams();
  body.set("template_object", JSON.stringify(template));

  const response = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kakao send failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

async function getKakaoAccessToken() {
  const refreshToken = optionalEnv("KAKAO_REFRESH_TOKEN");
  const restApiKey = optionalEnv("KAKAO_REST_API_KEY");

  if (refreshToken && restApiKey) {
    const body = new URLSearchParams();
    body.set("grant_type", "refresh_token");
    body.set("client_id", restApiKey);
    body.set("refresh_token", refreshToken);

    const response = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
      },
      body
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kakao token refresh failed: ${response.status} ${errorText}`);
    }

    const json = (await response.json()) as { access_token?: string };
    return json.access_token ?? "";
  }

  return optionalEnv("KAKAO_ACCESS_TOKEN");
}
