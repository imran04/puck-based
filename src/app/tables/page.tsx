import { Database, FilePlus2, ArrowRight, Table2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { listTables } from "@/lib/tables-api";

function formatDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

export default async function TablesPage() {
  const tables = (await listTables()) ?? [];

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#171717]">
      <section className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-8 py-10">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-[#1b6dff]">Puck Studio</p>
            <h1 className="mt-2 max-w-4xl text-5xl font-black leading-[0.98] md:text-7xl">
              Dynamic tables
            </h1>
            <p className="mt-3 text-[#5f6368] font-medium">
              Define schemas, add data, and use tables as datasources in your pages.
            </p>
          </div>
          <Link
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#d9dee5] bg-white px-5 font-bold transition hover:bg-[#f0f4f8]"
            href="/"
          >
            ← Pages
          </Link>
        </header>

        {/* Create form */}
        <form
          action="/api/tables"
          className="grid gap-3 rounded-lg border border-[#d9dee5] bg-white p-4 md:grid-cols-[1fr_1fr_auto]"
          method="post"
        >
          <label className="grid gap-2 text-sm font-black text-[#4f5661]">
            Table name (machine)
            <input
              className="min-h-11 rounded-lg border border-[#d9dee5] px-3 text-base font-medium text-[#171717] outline-none transition focus:border-[#1b6dff]"
              name="name"
              pattern="[a-z0-9_]+"
              placeholder="products, blog_posts, customers…"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-black text-[#4f5661]">
            Display name
            <input
              className="min-h-11 rounded-lg border border-[#d9dee5] px-3 text-base font-medium text-[#171717] outline-none transition focus:border-[#1b6dff]"
              name="displayName"
              placeholder="Products, Blog Posts, Customers…"
              required
            />
          </label>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-lg bg-[#1b6dff] px-5 font-black text-white transition hover:bg-[#0d4fd1]"
            type="submit"
          >
            <FilePlus2 size={18} />
            Create table
          </button>
        </form>

        {/* Table list */}
        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-black">Tables</h2>
            <span className="rounded-full border border-[#d9dee5] bg-white px-3 py-1 text-sm font-black text-[#5f6368]">
              {tables.length} total
            </span>
          </div>

          {tables.length === 0 ? (
            <div className="rounded-lg border border-[#d9dee5] bg-white p-10 text-center text-[#5f6368]">
              <Database className="mx-auto mb-3 opacity-30" size={40} />
              <p className="font-medium">No tables yet. Create one above.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[#d9dee5] bg-white">
              {tables.map((table) => {
                const colCount = Array.isArray(table.columns) ? table.columns.length : 0;
                return (
                  <article
                    className="grid gap-4 border-b border-[#d9dee5] p-4 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center"
                    key={table.id}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Table2 className="shrink-0 text-[#1b6dff]" size={18} />
                        <h3 className="truncate text-xl font-black">{table.displayName}</h3>
                        <code className="rounded bg-[#eef3f8] px-2 py-0.5 text-xs font-mono text-[#4f5661]">
                          {table.name}
                        </code>
                      </div>
                      <p className="mt-1 text-sm font-medium text-[#5f6368]">
                        {colCount} column{colCount !== 1 ? "s" : ""} · Created {formatDate(table.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#171717] px-3 text-sm font-black text-white"
                        href={`/tables/${table.id}`}
                        style={{ color: "#fff" }}
                      >
                        Schema
                        <ArrowRight size={14} />
                      </Link>
                      <Link
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d9dee5] px-3 text-sm font-black"
                        href={`/tables/${table.id}/data`}
                      >
                        <ExternalLink size={14} />
                        Data
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
