import "server-only";

import { getApiPageCshtml } from "@/lib/builder-api";
import { buildTemplateBundle } from "@/lib/datasource-template";
import { getPage } from "@/lib/page-store";

export type CshtmlArtifact = {
  id: string;
  title: string;
  slug: string;
  source: "published" | "draft";
  publishedAt?: string;
  updatedAt?: string;
  razorTemplate: string;
};

export async function resolveCshtmlArtifact(pageId: string): Promise<CshtmlArtifact | null> {
  const publishedArtifact = await getApiPageCshtml(pageId);
  if (publishedArtifact?.razorTemplate?.trim()) {
    return {
      id: publishedArtifact.id,
      title: publishedArtifact.title,
      slug: publishedArtifact.slug,
      source: "published",
      publishedAt: publishedArtifact.publishedAt || undefined,
      updatedAt: publishedArtifact.updatedAt,
      razorTemplate: publishedArtifact.razorTemplate,
    };
  }

  const page = await getPage(pageId);
  if (!page) {
    return null;
  }

  const bundle = buildTemplateBundle(page.draft, {
    pageId: page.id,
    pageSlug: page.slug,
  });

  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    source: "draft",
    publishedAt: page.publishedAt,
    updatedAt: page.updatedAt,
    razorTemplate: bundle.razorTemplate,
  };
}
