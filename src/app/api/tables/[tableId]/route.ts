import { getTable, updateTable, deleteTable, type ColumnDefinition } from "@/lib/tables-api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params;
  const table = await getTable(tableId);
  if (!table) return Response.json({ error: "Table not found" }, { status: 404 });
  return Response.json({ table });
}

export async function PUT(request: Request, { params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params;
  const body = (await request.json()) as { displayName?: string; columns?: ColumnDefinition[] };
  const result = await updateTable(tableId, String(body.displayName ?? ""), body.columns ?? []);
  if (!result) return Response.json({ error: "Failed to update table" }, { status: 500 });
  return Response.json({ table: result });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params;
  const ok = await deleteTable(tableId);
  if (!ok) return Response.json({ error: "Failed to delete table" }, { status: 500 });
  return new Response(null, { status: 204 });
}
