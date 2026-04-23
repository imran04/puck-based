import type { Data } from "@puckeditor/core";
import { publishPage } from "@/lib/page-store";
import { buildTemplateBundle } from "@/lib/datasource-template";

export async function POST(
  request: Request,
  context: RouteContext<"/api/pages/[pageId]/publish">,
) {
  const { pageId } = await context.params;
  const body = (await request.json()) as { data?: Data };

  if (!body.data || !Array.isArray(body.data.content)) {
    return Response.json({ error: "Invalid Puck payload" }, { status: 400 });
  }

  // Generate Razor CSHTML + C# renderer + datasource map from the Puck JSON
  const bundle = buildTemplateBundle(body.data, {
    pageId,
    pageSlug: pageId,
  });

  try {
    const page = await publishPage(pageId, body.data, bundle);
    return Response.json({ page });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
