import { createRelation, type RelationType } from "@/lib/tables-api";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> },
) {
  const { tableId } = await params;
  const body = (await request.json()) as {
    toTableId?: string;
    relationType?: RelationType;
    displayName?: string;
  };
  const relation = await createRelation(
    tableId,
    String(body.toTableId ?? ""),
    (body.relationType as RelationType) ?? "one_to_many",
    String(body.displayName ?? ""),
  );
  if (!relation) return Response.json({ error: "Failed to create relation" }, { status: 500 });
  return Response.json({ relation }, { status: 201 });
}
