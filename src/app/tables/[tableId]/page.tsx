import { notFound } from "next/navigation";
import Link from "next/link";
import { getTable, listTables } from "@/lib/tables-api";
import { TableDesigner } from "@/components/TableDesigner";

export default async function TableSchemaPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = await params;
  const [table, allTables] = await Promise.all([getTable(tableId), listTables()]);

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
            <span className="text-sm font-medium text-[#5f6368]">{table.displayName}</span>
          </div>
          <h1 className="text-4xl font-black">{table.displayName}</h1>
          <code className="w-fit rounded bg-[#eef3f8] px-2 py-1 text-sm font-mono text-[#4f5661]">
            {table.name}
          </code>
        </header>

        <TableDesigner
          allTables={(allTables ?? []).filter((t) => t.id !== table.id)}
          table={table}
        />
      </section>
    </main>
  );
}
