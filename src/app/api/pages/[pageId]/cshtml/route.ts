import { getApiPageCshtml } from "@/lib/builder-api";
import { buildTemplateBundle } from "@/lib/datasource-template";
import { getPage } from "@/lib/page-store";

export const dynamic = "force-dynamic";

function cshtmlResponse(input: {
  id: string;
  slug: string;
  razorTemplate: string;
  source: "published" | "draft";
}) {
  return new Response(input.razorTemplate, {
    headers: {
      "Content-Disposition": `inline; filename="${input.slug || input.id}.cshtml"`,
      "Content-Type": "text/plain; charset=utf-8",
      "X-Puck-Cshtml-Source": input.source,
      "X-Puck-Page-Id": input.id,
      "X-Puck-Page-Slug": input.slug,
    },
  });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/pages/[pageId]/cshtml">,
) {
  const { pageId } = await context.params;
  const artifact = await getApiPageCshtml(pageId);

  if (artifact?.razorTemplate?.trim()) {
    return cshtmlResponse({
      id: artifact.id,
      slug: artifact.slug,
      source: "published",
      razorTemplate: artifact.razorTemplate,
    });
  }

  const page = await getPage(pageId);
  if (!page) {
    return Response.json({ error: "Page not found." }, { status: 404 });
  }

  const bundle = buildTemplateBundle(page.draft, {
    pageId: page.id,
    pageSlug: page.slug,
  });

  return cshtmlResponse({
    id: page.id,
    slug: page.slug,
    source: "draft",
    razorTemplate: bundle.razorTemplate,
  });
}
