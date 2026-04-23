const defaultApiUrl = "http://127.0.0.1:5056";
const apiBaseUrl = (process.env.BUILDER_API_URL || defaultApiUrl).replace(/\/$/, "");

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: RouteContext<"/media/[assetId]">,
) {
  const { assetId } = await context.params;
  const headers = new Headers();
  const range = request.headers.get("range");

  if (range) {
    headers.set("Range", range);
  }

  const upstream = await fetch(`${apiBaseUrl}/media/${encodeURIComponent(assetId)}`, {
    cache: "no-store",
    headers,
  });

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(upstream.body, { status: upstream.status });
  }

  const passthrough = new Headers();
  for (const key of [
    "content-type",
    "content-length",
    "cache-control",
    "etag",
    "last-modified",
    "accept-ranges",
    "content-range",
  ]) {
    const value = upstream.headers.get(key);
    if (value) {
      passthrough.set(key, value);
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: passthrough,
  });
}
