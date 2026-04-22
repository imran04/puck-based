import { PuckStudio } from "@/components/PuckStudio";
import { listPages, readOrCreatePage } from "@/lib/page-store";

export const dynamic = "force-dynamic";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const page = await readOrCreatePage(pageId);
  const pages = await listPages();

  return (
    <PuckStudio
      initialData={page.draft}
      pageId={page.id}
      pages={pages.map((item) => ({
        id: item.id,
        title: item.title,
        slug: item.slug,
        publishedAt: item.publishedAt,
      }))}
      publishedAt={page.publishedAt}
    />
  );
}
