import "server-only";

import type { Data } from "@puckeditor/core";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createApiPage, getApiPage, listApiPages, publishApiPage, saveApiDraftPage } from "./builder-api";
import { initialPageData } from "@/puck/initial-data";
import type { TemplateBundle } from "./datasource-template";

export type StoredPage = {
  id: string;
  title: string;
  slug: string;
  draft: Data;
  published?: Data;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

const pagesDir = path.join(process.cwd(), "data", "pages");

function pagePath(pageId: string) {
  const safeId = pageId.replace(/[^a-zA-Z0-9-_]/g, "-");
  return path.join(pagesDir, `${safeId}.json`);
}

function cloneInitialData(): Data {
  return JSON.parse(JSON.stringify(initialPageData)) as Data;
}

function pageTitle(data: Data, fallback: string) {
  const root = data.root as { props?: { title?: string }; title?: string };
  return root.props?.title || root.title || fallback;
}

function normalizeData(data: Data): Data {
  const normalized = JSON.parse(JSON.stringify(data || {})) as Data & {
    zones?: Record<string, unknown>;
  };
  const root = (normalized.root ?? {}) as { props?: Record<string, unknown> };

  normalized.root = {
    ...root,
    props: {
      ...(root.props ?? {}),
    },
  };

  if (!Array.isArray(normalized.content)) {
    normalized.content = [];
  }

  if (
    normalized.zones &&
    typeof normalized.zones === "object" &&
    Object.keys(normalized.zones).length === 0
  ) {
    delete normalized.zones;
  }

  return normalized;
}

function normalizeStoredPage(page: StoredPage): StoredPage {
  return {
    ...page,
    draft: normalizeData(page.draft),
    published: page.published ? normalizeData(page.published) : undefined,
  };
}

function apiPageToStoredPage(apiPage: {
  id: string;
  title: string;
  slug: string;
  draft: Data;
  published?: Data | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}): StoredPage {
  return normalizeStoredPage({
    id: apiPage.id,
    title: apiPage.title,
    slug: apiPage.slug,
    draft: apiPage.draft,
    published: apiPage.published || undefined,
    createdAt: apiPage.createdAt,
    updatedAt: apiPage.updatedAt,
    publishedAt: apiPage.publishedAt || undefined,
  });
}

function normalizePageId(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `page-${Date.now()}`;
}

function createInitialPage(pageId: string): StoredPage {
  const now = new Date().toISOString();
  const draft = cloneInitialData();

  return {
    id: pageId,
    title: pageTitle(draft, "Puck Studio Page"),
    slug: pageId,
    draft,
    createdAt: now,
    updatedAt: now,
  };
}

export async function ensurePagesDir() {
  await mkdir(pagesDir, { recursive: true });
}

async function readJsonPage(pageId: string): Promise<StoredPage | null> {
  await ensurePagesDir();

  try {
    const raw = await readFile(pagePath(pageId), "utf8");
    return normalizeStoredPage(JSON.parse(raw) as StoredPage);
  } catch {
    return null;
  }
}

function isNewerPage(candidate: StoredPage, current?: StoredPage | null) {
  if (!current) {
    return true;
  }

  return new Date(candidate.updatedAt).getTime() > new Date(current.updatedAt).getTime();
}

async function readJsonPages(): Promise<StoredPage[]> {
  await ensurePagesDir();
  const pages: StoredPage[] = [];

  try {
    const files = await readdir(pagesDir);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));
    const loaded = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const raw = await readFile(path.join(pagesDir, file), "utf8");
          return JSON.parse(raw) as StoredPage;
        } catch {
          return null;
        }
      }),
    );
    pages.push(...loaded.filter((page): page is StoredPage => Boolean(page)));
  } catch {
    // Keep the dashboard usable even before local storage exists.
  }

  return pages;
}

export async function getPage(pageId: string): Promise<StoredPage | null> {
  const localPage = await readJsonPage(pageId);
  const apiPage = await getApiPage(pageId);

  if (apiPage) {
    const apiStoredPage = apiPageToStoredPage(apiPage);

    if (isNewerPage(apiStoredPage, localPage)) {
      await writePage(apiStoredPage);
      return apiStoredPage;
    }
  }

  if (localPage) {
    await writePage(localPage);
    return localPage;
  }

  if (pageId === "home") {
    const page = createInitialPage(pageId);
    await writePage(page);
    await saveApiDraftPage(page.id, page.title, page.draft);
    return page;
  }

  return null;
}

export async function listPages(): Promise<StoredPage[]> {
  const pagesById = new Map((await readJsonPages()).map((page) => [page.id, page]));
  const apiPages = await listApiPages();

  if (apiPages) {
    await Promise.all(
      apiPages.map(async (apiPage) => {
        const apiStoredPage = apiPageToStoredPage(apiPage);
        const localPage = pagesById.get(apiStoredPage.id);

        if (isNewerPage(apiStoredPage, localPage)) {
          pagesById.set(apiStoredPage.id, apiStoredPage);
          await writePage(apiStoredPage);
        }
      }),
    );
  }

  if (!pagesById.has("home")) {
    const homePage = createInitialPage("home");
    pagesById.set(homePage.id, homePage);
    await writePage(homePage);
  }

  return Array.from(pagesById.values()).sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export async function createPage(title: string) {
  const basePageId = normalizePageId(title);
  const existingIds = new Set((await listPages()).map((page) => page.id));
  let pageId = basePageId;
  let suffix = 2;

  while (existingIds.has(pageId)) {
    pageId = `${basePageId}-${suffix}`;
    suffix += 1;
  }

  const page = createInitialPage(pageId);
  page.title = title.trim() || "Untitled page";
  page.slug = pageId;
  page.draft = {
    ...page.draft,
    root: {
      props: {
        title: page.title,
      },
    },
  };

  await writePage(page);
  await createApiPage(page.id, page.title, page.draft);
  return page;
}

export async function readOrCreatePage(pageId: string): Promise<StoredPage> {
  const existing = await getPage(pageId);

  if (existing) {
    return existing;
  }

  const page = createInitialPage(pageId);
  await writePage(page);
  await saveApiDraftPage(page.id, page.title, page.draft);
  return page;
}

export async function writePage(page: StoredPage) {
  await ensurePagesDir();
  await writeFile(
    pagePath(page.id),
    `${JSON.stringify(normalizeStoredPage(page), null, 2)}\n`,
    "utf8",
  );
}

export async function publishPage(pageId: string, data: Data, bundle?: TemplateBundle) {
  const existing = await readOrCreatePage(pageId);
  const now = new Date().toISOString();
  const normalizedData = normalizeData(data);
  const title = pageTitle(normalizedData, existing.title);
  const nextPage: StoredPage = {
    ...existing,
    title,
    draft: normalizedData,
    published: normalizedData,
    updatedAt: now,
    publishedAt: now,
  };

  await writePage(nextPage);
  const apiPage = await publishApiPage(pageId, title, normalizedData, bundle);
  if (!apiPage) {
    throw new Error("Publish did not complete on Builder API.");
  }
  return nextPage;
}
