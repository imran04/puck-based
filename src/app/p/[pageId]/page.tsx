import { Render } from "@puckeditor/core";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/page-store";
import { puckConfig } from "@/puck/config";

export const dynamic = "force-dynamic";

export default async function PublishedPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const page = await getPage(pageId);

  if (!page) {
    notFound();
  }

  const data = page.published || page.draft;

  if (!data) {
    notFound();
  }

  return <Render config={puckConfig} data={data} />;
}
