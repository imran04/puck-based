import { isReusableBlockKind } from "@/lib/reusable-blocks";
import { listReusableBlocks, saveReusableBlock } from "@/lib/reusable-block-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const blocks = await listReusableBlocks(isReusableBlockKind(kind) ? kind : undefined);

  return Response.json(blocks);
}

export async function POST(request: Request) {
  const body = await request.json();

  if (!body?.name || !isReusableBlockKind(body.kind) || !body.data?.type) {
    return Response.json({ error: "Invalid reusable block payload" }, { status: 400 });
  }

  const block = await saveReusableBlock({
    name: String(body.name),
    kind: body.kind,
    componentType: String(body.componentType || body.data.type),
    data: body.data,
  });

  return Response.json(block, { status: 201 });
}

