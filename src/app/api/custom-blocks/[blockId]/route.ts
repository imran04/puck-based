import { removeReusableBlock } from "@/lib/reusable-block-store";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/custom-blocks/[blockId]">,
) {
  const { blockId } = await context.params;
  const removed = await removeReusableBlock(blockId);

  return removed
    ? new Response(null, { status: 204 })
    : Response.json({ error: "Custom block not found" }, { status: 404 });
}
