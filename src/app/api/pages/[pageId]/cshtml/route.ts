import { resolveCshtmlArtifact } from "@/lib/cshtml-artifact";

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
  const artifact = await resolveCshtmlArtifact(pageId);
  if (!artifact) {
    return Response.json({ error: "Page not found." }, { status: 404 });
  }

  return cshtmlResponse({
    id: artifact.id,
    slug: artifact.slug,
    source: artifact.source,
    razorTemplate: artifact.razorTemplate,
  });
}
