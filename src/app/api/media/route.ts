import { listMediaAssets } from "@/lib/media-api";
import { withAdminSessionHeader } from "@/lib/admin-session-header";

const defaultApiUrl = "http://127.0.0.1:5056";
const apiBaseUrl = (process.env.BUILDER_API_URL || defaultApiUrl).replace(/\/$/, "");

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;
  const limit = Number(searchParams.get("limit") || 48);
  const offset = Number(searchParams.get("offset") || 0);

  const payload = await listMediaAssets({
    search,
    limit: Number.isFinite(limit) ? limit : 48,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  return Response.json(
    payload ?? {
      assets: [],
      total: 0,
      limit: Number.isFinite(limit) ? limit : 48,
      offset: Number.isFinite(offset) ? offset : 0,
    },
  );
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const headers = await withAdminSessionHeader({ request });
  const response = await fetch(`${apiBaseUrl}/api/media/upload`, {
    method: "POST",
    cache: "no-store",
    headers,
    body: formData,
  });
  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
    },
  });
}
