import { buildStaticHtml } from "@/lib/export-html";
import { getPage } from "@/lib/page-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/pages/[pageId]/export">,
) {
  const { pageId } = await context.params;
  const page = await getPage(pageId);

  if (!page) {
    return Response.json({ error: "Page not found" }, { status: 404 });
  }

  const data = page.published || page.draft;
  const html = buildStaticHtml(data, page.title);

  return new Response(html, {
    headers: {
      "Content-Disposition": `attachment; filename="${page.slug || page.id}.html"`,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
