import { NextResponse } from "next/server";
import {
  builderApiBaseUrl,
  sanitizeNextPath,
  STUDIO_SESSION_COOKIE,
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

function cookieOptions(request: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookieForRequest(request),
    path: "/",
  };
}

function parseErrorText(raw: string, fallback: string) {
  const text = raw.trim();
  if (!text) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error.trim();
    }
  } catch {
    // Keep original text.
  }

  return text;
}

function loginFailedResponse(request: Request, nextPath: string, status: number, message: string) {
  if (isJsonRequest(request)) {
    return NextResponse.json({ error: message }, { status });
  }

  const url = new URL("/login", request.url);
  const errorCode = status === 401 ? "invalid" : status === 503 ? "service" : "failed";
  url.searchParams.set("error", errorCode);
  if (nextPath !== "/") {
    url.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  let username = "";
  let password = "";
  let nextPath = "/";

  if (isJsonRequest(request)) {
    const body = (await request.json()) as {
      username?: unknown;
      password?: unknown;
      next?: unknown;
    };
    username = typeof body.username === "string" ? body.username : "";
    password = typeof body.password === "string" ? body.password : "";
    nextPath = sanitizeNextPath(typeof body.next === "string" ? body.next : "/");
  } else {
    const form = await request.formData();
    username = String(form.get("username") || "");
    password = String(form.get("password") || "");
    nextPath = sanitizeNextPath(String(form.get("next") || "/"));
  }

  const upstream = await fetch(`${builderApiBaseUrl()}/api/admin/auth/login`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const upstreamBody = await upstream.text();
  if (!upstream.ok) {
    const message = parseErrorText(upstreamBody, "Login failed.");
    return loginFailedResponse(request, nextPath, upstream.status, message);
  }

  let payload: { sessionToken?: unknown; user?: { role?: unknown; username?: unknown } } = {};
  try {
    payload = JSON.parse(upstreamBody) as typeof payload;
  } catch {
    payload = {};
  }

  const sessionToken =
    typeof payload.sessionToken === "string" ? payload.sessionToken.trim() : "";
  if (!sessionToken) {
    return loginFailedResponse(request, nextPath, 502, "Login response did not include a session token.");
  }

  if (isJsonRequest(request)) {
    const response = NextResponse.json({
      ok: true,
      next: nextPath,
      user: payload.user ?? null,
    });
    response.cookies.set(STUDIO_SESSION_COOKIE, sessionToken, cookieOptions(request));
    return response;
  }

  const redirectUrl = new URL(nextPath, request.url);
  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.set(STUDIO_SESSION_COOKIE, sessionToken, cookieOptions(request));
  return response;
}
