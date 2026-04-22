import "server-only";

import type { Data } from "@puckeditor/core";
import type { ReusableBlock, ReusableBlockInput, ReusableBlockKind } from "./reusable-blocks";
import type { TemplateBundle } from "./datasource-template";

type ApiPage = {
  id: string;
  title: string;
  slug: string;
  draft: Data;
  published?: Data | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
};

const defaultApiUrl = "http://127.0.0.1:5056";
const apiBaseUrl = (process.env.BUILDER_API_URL || defaultApiUrl).replace(/\/$/, "");

async function builderFetch<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 5000,
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      signal: controller.signal,
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Builder API ${response.status}`);
    }

    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getApiPage(pageId: string) {
  return builderFetch<ApiPage>(`/api/pages/${encodeURIComponent(pageId)}`);
}

export async function listApiPages() {
  return builderFetch<ApiPage[]>("/api/pages");
}

export async function createApiPage(pageId: string, title: string, data: Data) {
  return builderFetch<ApiPage>("/api/pages", {
    method: "POST",
    body: JSON.stringify({ id: pageId, title, slug: pageId, data }),
  });
}

export async function saveApiDraftPage(pageId: string, title: string, data: Data) {
  return builderFetch<ApiPage>(`/api/pages/${encodeURIComponent(pageId)}/draft`, {
    method: "PUT",
    body: JSON.stringify({ title, slug: pageId, data }),
  });
}

export async function publishApiPage(pageId: string, title: string, data: Data, bundle?: TemplateBundle) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${apiBaseUrl}/api/pages/${encodeURIComponent(pageId)}/publish`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        slug: pageId,
        data,
        dataSourceMapJson: bundle?.dataSourceMapJson ?? null,
        razorTemplate: bundle?.razorTemplate ?? null,
        csharpSource: bundle?.csharpSource ?? null,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(errorBody || `Builder API ${response.status}`);
    }

    return (await response.json()) as ApiPage;
  } finally {
    clearTimeout(timeout);
  }
}

export async function listApiReusableBlocks(kind?: ReusableBlockKind) {
  const query = kind ? `?kind=${encodeURIComponent(kind)}` : "";
  return builderFetch<ReusableBlock[]>(`/api/custom-blocks${query}`);
}

export async function saveApiReusableBlock(input: ReusableBlockInput) {
  return builderFetch<ReusableBlock>("/api/custom-blocks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteApiReusableBlock(blockId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 900);

  try {
    const response = await fetch(
      `${apiBaseUrl}/api/custom-blocks/${encodeURIComponent(blockId)}`,
      {
        cache: "no-store",
        method: "DELETE",
        signal: controller.signal,
      },
    );

    return response.ok || response.status === 204;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function submitApiForm(formTitle: string, payload: Record<string, unknown>) {
  return builderFetch<{ id: string; formTitle: string; createdAt: string }>(
    "/api/form-submissions",
    {
      method: "POST",
      body: JSON.stringify({ formTitle, payload }),
    },
  );
}
