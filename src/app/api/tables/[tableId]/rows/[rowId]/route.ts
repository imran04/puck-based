import { updateRow, deleteRow } from "@/lib/tables-api";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tableId: string; rowId: string }> },
) {
  const { tableId, rowId } = await params;
  const body = (await request.json()) as { data?: Record<string, unknown> };
  const row = await updateRow(tableId, rowId, body.data ?? {});
  if (!row) return Response.json({ error: "Failed to update row" }, { status: 500 });
  return Response.json({ row });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ tableId: string; rowId: string }> },
) {
  const { tableId, rowId } = await params;
  const ok = await deleteRow(tableId, rowId);
  if (!ok) return Response.json({ error: "Failed to delete row" }, { status: 500 });
  return new Response(null, { status: 204 });
}
