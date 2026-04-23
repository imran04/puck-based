import type { Data } from "@puckeditor/core";
import { publishPage } from "@/lib/page-store";
import { buildTemplateBundle } from "@/lib/datasource-template";

function parsePublishError(raw: string) {
  try {
    const parsed = JSON.parse(raw) as { error?: unknown; details?: unknown };
    const error =
      typeof parsed.error === "string" && parsed.error.trim()
        ? parsed.error.trim()
        : raw;
    const details =
      typeof parsed.details === "string" && parsed.details.trim()
        ? parsed.details.trim()
        : undefined;

    return { error, details };
  } catch {
    return { error: raw };
  }
}

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
    const rawMessage = error instanceof Error ? error.message : "Publish failed";
    const parsed = parsePublishError(rawMessage);
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof (error as { status?: number }).status === "number"
        ? (error as { status: number }).status
        : 502;

    return Response.json(
      {
        error: parsed.error || "Publish failed",
        details: parsed.details,
        razorTemplate: bundle.razorTemplate,
      },
      { status },
    );
  }
}
