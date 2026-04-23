import "server-only";

import type {
  ListMediaResponse,
  MediaAsset,
  UpdateMediaAssetPayload,
} from "./media-types";

const defaultApiUrl = "http://127.0.0.1:5056";
const apiBaseUrl = (process.env.BUILDER_API_URL || defaultApiUrl).replace(/\/$/, "");

async function mediaApiFetch<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 8000,
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers(init?.headers ?? undefined);
    if (init?.body && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers,
      signal: controller.signal,
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Media API ${response.status}`);
    }

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function listMediaAssets(params?: {
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  const suffix = query.toString() ? `?${query}` : "";

  return mediaApiFetch<ListMediaResponse>(`/api/media${suffix}`);
}

export function getMediaAsset(assetId: string) {
  return mediaApiFetch<MediaAsset>(`/api/media/${encodeURIComponent(assetId)}`);
}

export function updateMediaAsset(assetId: string, patch: UpdateMediaAssetPayload) {
  return mediaApiFetch<MediaAsset>(`/api/media/${encodeURIComponent(assetId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteMediaAsset(assetId: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${apiBaseUrl}/api/media/${encodeURIComponent(assetId)}`, {
      method: "DELETE",
      cache: "no-store",
      signal: controller.signal,
    });

    return response.ok || response.status === 204;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
