import { listTables, createTable, type ColumnDefinition } from "@/lib/tables-api";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function GET() {
  const tables = await listTables();
  return Response.json({ tables: tables ?? [] });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const wantsJson = contentType.includes("application/json");

  const body = wantsJson
    ? (await request.json() as { name?: string; displayName?: string; columns?: ColumnDefinition[] })
    : Object.fromEntries(await request.formData());

  const result = await createTable(
    String(body.name ?? ""),
    String((body as Record<string, unknown>).displayName ?? body.name ?? ""),
    (body as { columns?: ColumnDefinition[] }).columns ?? [],
  );

  if (!result) {
    if (wantsJson) return Response.json({ error: "Failed to create table" }, { status: 500 });
    redirect("/tables");
  }

  if (wantsJson) return Response.json({ table: result }, { status: 201 });
  redirect(`/tables/${result.id}`);
}
