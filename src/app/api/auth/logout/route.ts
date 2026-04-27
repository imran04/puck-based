import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  builderApiBaseUrl,
  sanitizeNextPath,
  STUDIO_SESSION_COOKIE,
  STUDIO_SESSION_HEADER,
} from "@/lib/studio-auth";

export const dynamic = "force-dynamic";

function isJsonRequest(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  return contentType.includes("application/json");
}

function secureCookieForRequest(_request: Request) {
  const forced = (process.env.BUILDER_COOKIE_SECURE || "").trim().toLowerCase();
  if (forced === "true") {
    return true;
  }
  if (forced === "false") {
    return false;
  }
  return false;
}

function clearAuthCookies(response: NextResponse, request: Request) {
  const options = {
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookieForRequest(request),
    path: "/",
  };

  response.cookies.set(STUDIO_SESSION_COOKIE, "", options);
  response.cookies.set("builder_token", "", options);
}

async function relayLogout(sessionToken: string) {
  if (!sessionToken) {
    return;
  }

  try {
    await fetch(`${builderApiBaseUrl()}/api/admin/auth/logout`, {
      method: "POST",
      cache: "no-store",
      headers: {
        [STUDIO_SESSION_HEADER]: sessionToken,
      },
    });
  } catch {
    // Ignore upstream logout failures and still clear local cookies.
  }
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  let nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));
  const cookieStore = await cookies();
  const sessionToken =
    request.headers.get(STUDIO_SESSION_HEADER)?.trim() ||
    cookieStore.get(STUDIO_SESSION_COOKIE)?.value?.trim() ||
    cookieStore.get("builder_token")?.value?.trim() ||
    "";

  if (!isJsonRequest(request)) {
    const form = await request.formData();
    nextPath = sanitizeNextPath(String(form.get("next") || nextPath));
  }

  await relayLogout(sessionToken);

  if (isJsonRequest(request)) {
    const response = NextResponse.json({ ok: true, next: nextPath });
    clearAuthCookies(response, request);
    return response;
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), 303);
  clearAuthCookies(response, request);
  return response;
}
