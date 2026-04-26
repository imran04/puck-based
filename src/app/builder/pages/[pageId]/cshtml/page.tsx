import { ArrowLeft, FileCode2 } from "lucide-react";
import Link from "next/link";
import { CshtmlMonacoViewer } from "@/components/CshtmlMonacoViewer";
import { resolveCshtmlArtifact } from "@/lib/cshtml-artifact";

export const dynamic = "force-dynamic";

export default async function CshtmlPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const artifact = await resolveCshtmlArtifact(pageId);

  if (!artifact) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f1115] p-6 text-[#f4f7fb]">
        <div className="grid gap-4 rounded-lg border border-[#2a313a] bg-[#171c23] p-6">
          <p className="text-sm font-black uppercase text-[#7ea8ff]">CSHTML viewer</p>
          <h1 className="text-2xl font-black">Page not found</h1>
          <Link
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#3a4656] px-4 text-sm font-black"
            href="/"
          >
            <ArrowLeft size={16} />
            Back to pages
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f1115] text-[#f4f7fb]">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-[#2a313a] bg-[#171c23] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <FileCode2 size={18} />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black">
              {artifact.title} <span className="text-[#8fa0b8]">/{artifact.slug}</span>
            </h1>
            <p className="text-xs font-bold uppercase text-[#7ea8ff]">
              Source: {artifact.source === "published" ? "Published artifact" : "Draft preview"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#3a4656] px-3 text-sm font-black"
            href={`/api/pages/${artifact.id}/cshtml`}
            target="_blank"
          >
            Raw text
          </a>
          <Link
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#3a4656] px-3 text-sm font-black"
            href={`/builder/pages/${artifact.id}`}
          >
            <ArrowLeft size={15} />
            Back to editor
          </Link>
        </div>
      </header>
      <CshtmlMonacoViewer value={artifact.razorTemplate} />
    </main>
  );
}
