import type { NextRequest } from "next/server";

export type StudioRole = "author" | "editor";

export type StudioSessionUser = {
  username: string;
  role: StudioRole;
};

export type StudioSessionCheck = {
  reachable: boolean;
  status: number;
  authEnabled: boolean;
  authenticated: boolean;
  user?: StudioSessionUser;
  expiresAt?: string | null;
  viaLegacyToken?: boolean;
  error?: string;
};

export const STUDIO_SESSION_COOKIE = "studio_session";
export const STUDIO_SESSION_HEADER = "x-admin-session";

const defaultApiUrl = "http://127.0.0.1:5056";

export function builderApiBaseUrl() {
  return (process.env.BUILDER_API_URL || defaultApiUrl).replace(/\/$/, "");
}

export function sanitizeNextPath(rawValue: string | undefined | null) {
  const value = (rawValue || "").trim();
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  if (value.startsWith("/api/auth/")) {
    return "/";
  }

  return value;
}

function parseRole(value: unknown): StudioRole {
  return String(value || "").trim().toLowerCase() === "editor" ? "editor" : "author";
}

function parseSessionPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const record = payload as Record<string, unknown>;
  return {
    authEnabled:
      typeof record.authEnabled === "boolean" ? record.authEnabled : undefined,
    authenticated:
      typeof record.authenticated === "boolean" ? record.authenticated : undefined,
    user:
      record.user && typeof record.user === "object"
        ? {
            username: String((record.user as Record<string, unknown>).username || "").trim(),
            role: parseRole((record.user as Record<string, unknown>).role),
          }
        : undefined,
    expiresAt:
      typeof record.expiresAt === "string" && record.expiresAt.trim()
        ? record.expiresAt
        : undefined,
    viaLegacyToken:
      typeof record.viaLegacyToken === "boolean" ? record.viaLegacyToken : undefined,
    error:
      typeof record.error === "string" && record.error.trim()
        ? record.error.trim()
        : undefined,
  };
}

export function sessionTokenFromRequest(request: NextRequest) {
  const candidates = [
    request.cookies.get(STUDIO_SESSION_COOKIE)?.value,
    request.headers.get(STUDIO_SESSION_HEADER),
    request.headers.get("x-builder-token"),
    request.cookies.get("builder_token")?.value,
    request.nextUrl.searchParams.get("token"),
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

export async function fetchStudioSession(
  token: string | undefined | null,
): Promise<StudioSessionCheck> {
  try {
    const headers = new Headers();
    if (token?.trim()) {
      headers.set(STUDIO_SESSION_HEADER, token.trim());
    }

    const response = await fetch(`${builderApiBaseUrl()}/api/admin/auth/session`, {
      method: "GET",
      cache: "no-store",
      headers,
    });

    let parsed: ReturnType<typeof parseSessionPayload> = {};
    try {
      parsed = parseSessionPayload(await response.json());
    } catch {
      parsed = {};
    }

    const authEnabled =
      typeof parsed.authEnabled === "boolean" ? parsed.authEnabled : true;
    const authenticated =
      typeof parsed.authenticated === "boolean"
        ? parsed.authenticated
        : response.ok && Boolean(parsed.user?.username);

    const user =
      parsed.user?.username && parsed.user.role
        ? { username: parsed.user.username, role: parsed.user.role }
        : undefined;

    return {
      reachable: true,
      status: response.status,
      authEnabled,
      authenticated,
      user,
      expiresAt: parsed.expiresAt,
      viaLegacyToken: parsed.viaLegacyToken,
      error: parsed.error,
    };
  } catch {
    return {
      reachable: false,
      status: 503,
      authEnabled: true,
      authenticated: false,
      error: "Auth service is unavailable.",
    };
  }
}
