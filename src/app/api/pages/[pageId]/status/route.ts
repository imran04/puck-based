import { updatePageStatus, type PageStatus } from "@/lib/page-store";

export const dynamic = "force-dynamic";

const allowedStatuses: ReadonlySet<PageStatus> = new Set([
  "draft",
  "published",
  "archived",
  "deleted",
]);

function parseErrorPayload(raw: string) {
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
    return { error: raw || "Status update failed" };
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/pages/[pageId]/status">,
) {
  const { pageId } = await context.params;
  const body = (await request.json()) as { status?: unknown };
  const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";

  if (!allowedStatuses.has(status as PageStatus)) {
    return Response.json(
      { error: "Invalid status. Use draft, published, archived, or deleted." },
      { status: 400 },
    );
  }

  try {
    const page = await updatePageStatus(pageId, status as PageStatus);
    return Response.json({ page });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Status update failed";
    const parsed = parseErrorPayload(rawMessage);
    const responseStatus =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof (error as { status?: number }).status === "number"
        ? (error as { status: number }).status
        : 502;

    return Response.json(
      {
        error: parsed.error || "Status update failed",
        details: parsed.details,
      },
      { status: responseStatus },
    );
  }
}
