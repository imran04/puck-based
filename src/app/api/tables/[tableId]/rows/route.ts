import { listRows, createRow } from "@/lib/tables-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params;
  const { searchParams } = new URL(request.url);
  const rows = await listRows(tableId, {
    limit: Number(searchParams.get("limit") ?? 100),
    filterField: searchParams.get("filterField") ?? undefined,
    filterOp: searchParams.get("filterOp") ?? undefined,
    filterValue: searchParams.get("filterValue") ?? undefined,
  });
  return Response.json({ rows: rows ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params;
  const body = (await request.json()) as { data?: Record<string, unknown> };
  const row = await createRow(tableId, body.data ?? {});
  if (!row) return Response.json({ error: "Failed to create row" }, { status: 500 });
  return Response.json({ row }, { status: 201 });
}
