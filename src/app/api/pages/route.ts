import { createPage, listPages } from "@/lib/page-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const pages = await listPages();
  return Response.json({ pages });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const wantsJson = contentType.includes("application/json");
  const body = wantsJson ? await request.json() : Object.fromEntries(await request.formData());
  const title = String(body.title || "Untitled page");
  const page = await createPage(title);

  if (wantsJson) {
    return Response.json({ page }, { status: 201 });
  }

  return Response.redirect(new URL(`/builder/pages/${page.id}`, request.url), 303);
}
