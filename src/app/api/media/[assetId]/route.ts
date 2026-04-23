import { deleteMediaAsset, getMediaAsset, updateMediaAsset } from "@/lib/media-api";
import type { UpdateMediaAssetPayload } from "@/lib/media-types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/media/[assetId]">,
) {
  const { assetId } = await context.params;
  const asset = await getMediaAsset(assetId);

  return asset
    ? Response.json(asset)
    : Response.json({ error: "Media asset not found" }, { status: 404 });
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/media/[assetId]">,
) {
  const { assetId } = await context.params;
  const patch = (await request.json()) as UpdateMediaAssetPayload;
  const asset = await updateMediaAsset(assetId, patch);

  return asset
    ? Response.json(asset)
    : Response.json({ error: "Failed to update media asset" }, { status: 500 });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/media/[assetId]">,
) {
  const { assetId } = await context.params;
  const deleted = await deleteMediaAsset(assetId);

  return deleted
    ? new Response(null, { status: 204 })
    : Response.json({ error: "Media asset not found" }, { status: 404 });
}
