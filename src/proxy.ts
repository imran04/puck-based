import { NextRequest, NextResponse } from "next/server";

function isProtectedWrite(pathname: string) {
  return /^\/api\/pages\/[^/]+\/publish$/.test(pathname);
}

export function proxy(request: NextRequest) {
  const builderToken = process.env.BUILDER_TOKEN?.trim();

  if (!builderToken) {
    return NextResponse.next();
  }

  const { pathname, searchParams } = request.nextUrl;
  const needsAuth =
    pathname.startsWith("/builder") ||
    pathname === "/api/pages" ||
    pathname.startsWith("/api/custom-blocks") ||
    pathname.startsWith("/api/media") ||
    isProtectedWrite(pathname);

  if (!needsAuth) {
    return NextResponse.next();
  }

  const token =
    request.cookies.get("builder_token")?.value ||
    request.headers.get("x-builder-token") ||
    searchParams.get("token");

  if (token?.trim() !== builderToken) {
    return new NextResponse("Unauthorized builder access.", { status: 401 });
  }

  const response = NextResponse.next();

  if (searchParams.get("token") === builderToken) {
    response.cookies.set("builder_token", builderToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/builder/:path*",
    "/api/pages",
    "/api/pages/:path*",
    "/api/custom-blocks",
    "/api/custom-blocks/:path*",
    "/api/media",
    "/api/media/:path*",
  ],
};
