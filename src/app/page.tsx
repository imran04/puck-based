import { ArrowRight, Download, Eye, FilePlus2, LayoutTemplate, Database, Cpu } from "lucide-react";
import Link from "next/link";
import { listPages } from "@/lib/page-store";

function formatDate(value?: string) {
  if (!value) {
    return "Not published";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function Home() {
  const pages = await listPages();

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#171717]">
      <section className="mx-auto grid w-[min(1180px,calc(100%-32px))] gap-8 py-10">
        <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-[#1b6dff]">Puck Studio</p>
            <h1 className="mt-2 max-w-4xl text-5xl font-black leading-[0.98] tracking-normal md:text-7xl">
              Pages and forms you can reopen, edit, publish, and export.
            </h1>
          </div>
          <div className="flex gap-3">
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#d9dee5] bg-white px-5 font-bold transition hover:bg-[#f0f4f8]"
              href="/tables"
            >
              <Database size={18} />
              Tables
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#171717] px-5 font-bold text-white transition hover:bg-[#2b2f35]"
              href="/builder/pages/home"
              style={{ color: "#ffffff" }}
            >
              Open home
              <ArrowRight size={18} />
            </Link>
          </div>
        </header>

        <form
          action="/api/pages"
          className="grid gap-3 rounded-lg border border-[#d9dee5] bg-white p-4 md:grid-cols-[1fr_auto]"
          method="post"
        >
          <label className="grid gap-2 text-sm font-black text-[#4f5661]">
            New page title
            <input
              className="min-h-11 rounded-lg border border-[#d9dee5] px-3 text-base font-medium text-[#171717] outline-none transition focus:border-[#1b6dff]"
              name="title"
              placeholder="Landing page, contact form, pricing..."
              required
            />
          </label>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-lg bg-[#1b6dff] px-5 font-black text-white transition hover:bg-[#0d4fd1]"
            type="submit"
          >
            <FilePlus2 size={18} />
            Create page
          </button>
        </form>

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-black">Created pages</h2>
            <span className="rounded-full border border-[#d9dee5] bg-white px-3 py-1 text-sm font-black text-[#5f6368]">
              {pages.length} total
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#d9dee5] bg-white">
            {pages.map((page) => (
              <article
                className="grid gap-4 border-b border-[#d9dee5] p-4 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center"
                key={page.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-xl font-black">{page.title}</h3>
                    <span className="rounded-full bg-[#eef3f8] px-2 py-1 text-xs font-black text-[#4f5661]">
                      /{page.slug}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-[#5f6368]">
                    Updated {formatDate(page.updatedAt)} · Published {formatDate(page.publishedAt)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#171717] px-3 text-sm font-black text-white"
                    href={`/builder/pages/${page.id}`}
                    style={{ color: "#ffffff" }}
                  >
                    <LayoutTemplate size={16} />
                    Edit
                  </Link>
                  <Link
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#d9dee5] px-3 text-sm font-black"
                    href={`/p/${page.id}`}
                    target="_blank"
                  >
                    <Eye size={16} />
                    Preview
                  </Link>
                  <a
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#d9dee5] px-3 text-sm font-black"
                    href={`/api/pages/${page.id}/export`}
                  >
                    <Download size={16} />
                    Export
                  </a>
                  {page.publishedAt && (
                    <a
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#1b6dff] px-3 text-sm font-black text-[#1b6dff]"
                      href={`http://127.0.0.1:5056/api/pages/${page.id}/render`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <Cpu size={16} />
                      Render
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
