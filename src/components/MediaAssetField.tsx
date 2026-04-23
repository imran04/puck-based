"use client";

import { ImagePlus, Search, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ListMediaResponse, MediaAsset, UploadMediaResponse } from "@/lib/media-types";
import { mediaAssetPath } from "@/lib/url";

type MediaAssetFieldProps = {
  value?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
};

const PAGE_SIZE = 60;

async function fetchMedia(search: string): Promise<ListMediaResponse | null> {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: "0",
  });

  if (search.trim()) {
    params.set("search", search.trim());
  }

  try {
    const response = await fetch(`/api/media?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as ListMediaResponse;
  } catch {
    return null;
  }
}

async function fetchMediaAsset(assetId: string): Promise<MediaAsset | null> {
  try {
    const response = await fetch(`/api/media/${encodeURIComponent(assetId)}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as MediaAsset;
  } catch {
    return null;
  }
}

export function MediaAssetField({ value, onChange, readOnly }: MediaAssetFieldProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);

  const selectedId = (value || "").trim();

  useEffect(() => {
    if (!selectedId) {
      queueMicrotask(() => setSelectedAsset(null));
      return;
    }

    const fromList = assets.find((asset) => asset.id === selectedId);
    if (fromList) {
      queueMicrotask(() => setSelectedAsset(fromList));
      return;
    }

    let cancelled = false;
    void fetchMediaAsset(selectedId).then((asset) => {
      if (!cancelled) {
        setSelectedAsset(asset);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [assets, selectedId]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const payload = await fetchMedia(search);
      if (cancelled) {
        return;
      }

      if (!payload) {
        setStatus("Could not load media library.");
      } else {
        setAssets(payload.assets);
        setTotal(payload.total);
      }
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, search]);

  const summaryLabel = useMemo(() => {
    if (!selectedId) return "No media selected";
    if (selectedAsset?.originalFileName) return selectedAsset.originalFileName;
    return selectedId;
  }, [selectedAsset, selectedId]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || readOnly) {
      return;
    }

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file, file.name);
    });

    setUploading(true);
    setStatus("Uploading...");

    try {
      const response = await fetch("/api/media", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        setStatus("Upload failed.");
        return;
      }

      const payload = (await response.json()) as UploadMediaResponse;
      const nextAssets = [...payload.assets, ...assets];
      setAssets(nextAssets);
      setTotal((current) => current + payload.assets.length);
      setStatus(`Uploaded ${payload.assets.length} file${payload.assets.length > 1 ? "s" : ""}.`);
    } catch {
      setStatus("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function chooseAsset(asset: MediaAsset) {
    onChange(asset.id);
    setSelectedAsset(asset);
    setOpen(false);
  }

  function clearSelection() {
    onChange("");
    setSelectedAsset(null);
  }

  return (
    <div className="media-field">
      <div className="media-field__summary">
        <div className="media-field__thumb" aria-hidden="true">
          {selectedId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" src={mediaAssetPath(selectedId)} />
          ) : (
            <ImagePlus size={18} />
          )}
        </div>
        <div className="media-field__meta">
          <strong>{summaryLabel}</strong>
          <small>
            {selectedId
              ? `${selectedAsset?.mimeType || "media"}${selectedAsset ? ` • ${Math.ceil(selectedAsset.sizeBytes / 1024)} KB` : ""}`
              : "Upload or pick from library"}
          </small>
        </div>
      </div>
      <div className="media-field__actions">
        <button
          disabled={Boolean(readOnly)}
          onClick={() => setOpen(true)}
          type="button"
        >
          Library
        </button>
        <button
          disabled={Boolean(readOnly) || !selectedId}
          onClick={clearSelection}
          type="button"
        >
          Clear
        </button>
      </div>

      {open ? (
        <div className="media-modal" role="dialog" aria-modal="true" aria-label="Media library">
          <div className="media-modal__panel">
            <header className="media-modal__header">
              <div>
                <p>Media library</p>
                <h2>Upload and select images</h2>
              </div>
              <button onClick={() => setOpen(false)} type="button">
                <X size={16} />
              </button>
            </header>

            <div className="media-modal__toolbar">
              <label>
                <Search size={14} />
                <input
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  placeholder="Search files, alt text, tags"
                  value={search}
                />
              </label>
              <label className="media-modal__upload">
                <Upload size={14} />
                {uploading ? "Uploading..." : "Upload"}
                <input
                  accept="image/*"
                  disabled={Boolean(readOnly) || uploading}
                  multiple
                  onChange={(event) => void handleUpload(event.currentTarget.files)}
                  type="file"
                />
              </label>
            </div>

            <div className="media-modal__status">
              <span>{loading ? "Loading..." : `${total} assets`}</span>
              {status ? <span>{status}</span> : null}
            </div>

            <div className="media-modal__grid">
              {assets.map((asset) => (
                <button
                  className={
                    asset.id === selectedId
                      ? "media-modal__item media-modal__item--active"
                      : "media-modal__item"
                  }
                  key={asset.id}
                  onClick={() => chooseAsset(asset)}
                  type="button"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" loading="lazy" src={mediaAssetPath(asset.id)} />
                  <span>{asset.originalFileName}</span>
                </button>
              ))}
              {!loading && assets.length === 0 ? (
                <p className="media-modal__empty">No assets yet. Upload your first image.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
