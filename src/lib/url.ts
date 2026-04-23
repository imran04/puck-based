const SAFE_LINK_PROTOCOLS = ["http:", "https:", "mailto:", "tel:"];
const SAFE_ACTION_PROTOCOLS = ["http:", "https:"];
const SAFE_MEDIA_PROTOCOLS = ["http:", "https:"];

function isRelativeUrl(value: string) {
  return value.startsWith("/") || value.startsWith("#");
}

function hasUnsafeProtocol(value: string) {
  return /^(javascript|data|vbscript):/i.test(value.trim());
}

export function safeLinkUrl(value: string | undefined, fallback = "#") {
  const trimmed = (value || "").trim();

  if (!trimmed || hasUnsafeProtocol(trimmed)) {
    return fallback;
  }

  if (isRelativeUrl(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    return SAFE_LINK_PROTOCOLS.includes(url.protocol) ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

export function safeFormAction(value: string | undefined, fallback = "/api/forms/submit") {
  const trimmed = (value || "").trim();

  if (!trimmed || hasUnsafeProtocol(trimmed)) {
    return fallback;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    return SAFE_ACTION_PROTOCOLS.includes(url.protocol) ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

export function safeMediaUrl(value: string | undefined, fallback = "") {
  const trimmed = (value || "").trim();

  if (!trimmed || hasUnsafeProtocol(trimmed)) {
    return fallback;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    return SAFE_MEDIA_PROTOCOLS.includes(url.protocol) ? trimmed : fallback;
  } catch {
    return fallback;
  }
}

export function mediaAssetPath(assetId: string | undefined, fallback = "") {
  const trimmed = (assetId || "").trim();

  if (!trimmed) {
    return fallback;
  }

  return `/media/${encodeURIComponent(trimmed)}`;
}

export function resolveMediaSource(
  value: { assetId?: string; src?: string },
  fallback = "",
) {
  const assetPath = mediaAssetPath(value.assetId);
  return assetPath || safeMediaUrl(value.src, fallback);
}
