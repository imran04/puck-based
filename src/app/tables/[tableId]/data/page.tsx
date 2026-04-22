import { notFound } from "next/navigation";
import Link from "next/link";
import { getTable, listRows } from "@/lib/tables-api";
import { TableDataEditor } from "@/components/TableDataEditor";

export default async function TableDataPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = await params;
  const [table, rows] = await Promise.all([getTable(tableId), listRows(tableId, { limit: 200 })]);

  if (!table) notFound();

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#171717]">
      <section className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-8 py-10">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Link className="text-sm font-bold text-[#1b6dff] hover:underline" href="/tables">
              ← Tables
            </Link>
            <span className="text-[#d9dee5]">/</span>
            <Link
              className="text-sm font-bold text-[#1b6dff] hover:underline"
              href={`/tables/${tableId}`}
            >
              {table.displayName}
            </Link>
            <span className="text-[#d9dee5]">/</span>
            <span className="text-sm font-medium text-[#5f6368]">Data</span>
          </div>
          <h1 className="text-4xl font-black">{table.displayName} — Data</h1>
        </header>

        <TableDataEditor rows={rows ?? []} table={table} />
      </section>
    </main>
  );
}
