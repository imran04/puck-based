import { NextRequest, NextResponse } from "next/server";
import {
  fetchStudioSession,
  sanitizeNextPath,
  sessionTokenFromRequest,
  STUDIO_SESSION_COOKIE,
} from "@/lib/studio-auth";

function isApiRoute(pathname: string) {
  return pathname.startsWith("/api/");
}

function isEditorOnlyPath(pathname: string) {
  return (
    /^\/api\/pages\/[^/]+\/publish$/.test(pathname) ||
    /^\/api\/pages\/[^/]+\/status$/.test(pathname)
  );
}

function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function secureCookieForRequest(_request: NextRequest) {
  const forced = (process.env.BUILDER_COOKIE_SECURE || "").trim().toLowerCase();
  if (forced === "true") {
    return true;
  }
  if (forced === "false") {
    return false;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = sessionTokenFromRequest(request);
  const session = await fetchStudioSession(sessionToken);

  if (!session.reachable) {
    if (isApiRoute(pathname)) {
      return jsonError(503, session.error || "Authentication service is unavailable.");
    }

    return new NextResponse("Authentication service is unavailable.", { status: 503 });
  }

  if (!session.authEnabled) {
    return NextResponse.next();
  }

  if (!session.authenticated || !session.user) {
    if (isApiRoute(pathname)) {
      return jsonError(401, session.error || "Authentication required.");
    }

    const nextPath = sanitizeNextPath(`${pathname}${request.nextUrl.search}`);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl);
  }

  if (session.user.role !== "editor" && isEditorOnlyPath(pathname)) {
    if (isApiRoute(pathname)) {
      return jsonError(403, "Editor role required.");
    }

    return new NextResponse("Editor role required.", { status: 403 });
  }

  const response = NextResponse.next();
  if (
    sessionToken &&
    request.nextUrl.searchParams.has("token") &&
    !request.cookies.get(STUDIO_SESSION_COOKIE)?.value
  ) {
    response.cookies.set(STUDIO_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookieForRequest(request),
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/tables/:path*",
    "/builder/:path*",
    "/api/pages/:path*",
    "/api/custom-blocks/:path*",
    "/api/media/:path*",
    "/api/tables/:path*",
  ],
};
