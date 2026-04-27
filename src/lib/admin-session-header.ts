import "server-only";

import { cookies } from "next/headers";
import { STUDIO_SESSION_COOKIE, STUDIO_SESSION_HEADER } from "./studio-auth";

export async function withAdminSessionHeader(
  options?: {
    request?: Request;
    headers?: HeadersInit;
  },
) {
  const headers = new Headers(options?.headers ?? undefined);

  const requestToken =
    options?.request?.headers.get(STUDIO_SESSION_HEADER)?.trim() ||
    options?.request?.headers.get("x-builder-token")?.trim() ||
    "";

  if (requestToken) {
    headers.set(STUDIO_SESSION_HEADER, requestToken);
    return headers;
  }

  try {
    const cookieStore = await cookies();
    const cookieToken =
      cookieStore.get(STUDIO_SESSION_COOKIE)?.value?.trim() ||
      cookieStore.get("builder_token")?.value?.trim() ||
      "";

    if (cookieToken) {
      headers.set(STUDIO_SESSION_HEADER, cookieToken);
    }
  } catch {
    // No request cookie context available.
  }

  return headers;
}
