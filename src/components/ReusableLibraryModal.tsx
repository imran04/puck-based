"use client";

import type { ComponentData, Data } from "@puckeditor/core";
import { BookmarkPlus, Library, RefreshCcw, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReusableBlock, ReusableBlockKind } from "@/lib/reusable-blocks";

type Candidate = {
  key: string;
  kind: ReusableBlockKind;
  label: string;
  componentType: string;
  data: ComponentData;
};

type ReusableLibraryModalProps = {
  data: Data;
};

const sectionTypes = new Set([
  "Hero",
  "Section",
  "SplitSection",
  "Container",
  "Stack",
  "Columns",
  "Grid",
  "Box",
  "TwoColumn",
]);

function isPuckItem(value: unknown): value is ComponentData {
  return Boolean(value && typeof value === "object" && "type" in value);
}

function cloneItem(item: ComponentData): ComponentData {
  const cloned = JSON.parse(JSON.stringify(item)) as ComponentData;

  function stripIds(value: unknown) {
    if (!value || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(stripIds);
      return;
    }

    const record = value as Record<string, unknown>;
    delete record.id;
    Object.values(record).forEach(stripIds);
  }

  stripIds(cloned);
  return cloned;
}

function labelForItem(item: ComponentData, fallback: string) {
  const props = (item.props || {}) as Record<string, unknown>;

  for (const key of ["_instanceName", "title", "text", "label", "eyebrow"]) {
    const value = props[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 80);
    }
  }

  return fallback;
}

function collectCandidates(items: ComponentData[], prefix = "content"): Candidate[] {
  return items.flatMap((item, index) => {
    const key = `${prefix}.${index}`;
    const kind: ReusableBlockKind | null =
      item.type === "FormBlock" ? "form" : sectionTypes.has(item.type) ? "section" : null;
    const own = kind && item.type !== "SavedSection" && item.type !== "SavedForm"
      ? [
          {
            key,
            kind,
            componentType: item.type,
            label: labelForItem(item, `${item.type} ${index + 1}`),
            data: cloneItem(item),
          },
        ]
      : [];
    const props = (item.props || {}) as Record<string, unknown>;
    const nested = Object.entries(props).flatMap(([propKey, value]) => {
      if (Array.isArray(value) && value.every(isPuckItem)) {
        return collectCandidates(value, `${key}.${propKey}`);
      }

      return [];
    });

    return [...own, ...nested];
  });
}

export function ReusableLibraryModal({ data }: ReusableLibraryModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [kind, setKind] = useState<ReusableBlockKind>("section");
  const [selectedKey, setSelectedKey] = useState("");
  const [name, setName] = useState("");
  const [savedBlocks, setSavedBlocks] = useState<ReusableBlock[]>([]);
  const [status, setStatus] = useState("Save reusable sections and forms into the library.");

  const candidates = useMemo(
    () => collectCandidates((data.content || []) as ComponentData[]),
    [data],
  );
  const visibleCandidates = candidates.filter((candidate) => candidate.kind === kind);
  const selected = visibleCandidates.find((candidate) => candidate.key === selectedKey);

  async function loadSavedBlocks() {
    const response = await fetch("/api/custom-blocks");

    if (!response.ok) {
      setStatus("Could not load saved library.");
      return;
    }

    setSavedBlocks((await response.json()) as ReusableBlock[]);
  }

  async function openModal() {
    setIsOpen(true);
    await loadSavedBlocks();
  }

  function chooseCandidate(key: string) {
    const candidate = visibleCandidates.find((item) => item.key === key);
    setSelectedKey(key);
    setName(candidate?.label || "");
  }

  async function saveBlock() {
    if (!selected || !name.trim()) {
      setStatus("Pick a section/form and give it a name.");
      return;
    }

    setStatus("Saving reusable item...");
    const response = await fetch("/api/custom-blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        kind,
        componentType: selected.componentType,
        data: selected.data,
      }),
    });

    if (!response.ok) {
      setStatus("Save failed.");
      return;
    }

    const block = (await response.json()) as ReusableBlock;
    setSavedBlocks((items) => [block, ...items]);
    setStatus(`Saved "${block.name}".`);
  }

  async function deleteBlock(blockId: string) {
    const response = await fetch(`/api/custom-blocks/${blockId}`, { method: "DELETE" });

    if (response.ok) {
      setSavedBlocks((items) => items.filter((item) => item.id !== blockId));
      setStatus("Removed saved item.");
    }
  }

  return (
    <>
      <button className="studio-icon-link" onClick={() => void openModal()} type="button">
        <Library size={16} />
        Library
      </button>
      {isOpen ? (
        <div className="library-modal" role="dialog" aria-modal="true">
          <div className="library-modal__panel">
            <header className="library-modal__header">
              <div>
                <p className="studio-kicker">Reusable library</p>
                <h2>Save section or form</h2>
              </div>
              <button aria-label="Close library" onClick={() => setIsOpen(false)} type="button">
                <X size={18} />
              </button>
            </header>

            <div className="library-modal__grid">
              <section className="library-modal__save">
                <div className="library-modal__tabs" role="tablist" aria-label="Reusable kind">
                  <button
                    aria-selected={kind === "section"}
                    onClick={() => {
                      setKind("section");
                      setSelectedKey("");
                    }}
                    role="tab"
                    type="button"
                  >
                    Sections
                  </button>
                  <button
                    aria-selected={kind === "form"}
                    onClick={() => {
                      setKind("form");
                      setSelectedKey("");
                    }}
                    role="tab"
                    type="button"
                  >
                    Forms
                  </button>
                </div>

                <label>
                  Pick from this page
                  <select value={selectedKey} onChange={(event) => chooseCandidate(event.currentTarget.value)}>
                    <option value="">Choose {kind}</option>
                    {visibleCandidates.map((candidate) => (
                      <option key={candidate.key} value={candidate.key}>
                        {candidate.label} ({candidate.componentType})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Library name
                  <input
                    onChange={(event) => setName(event.currentTarget.value)}
                    placeholder="Reusable hero, lead form..."
                    value={name}
                  />
                </label>

                <button className="library-modal__primary" onClick={() => void saveBlock()} type="button">
                  <BookmarkPlus size={16} />
                  Save to library
                </button>
                <p>{status}</p>
              </section>

              <section className="library-modal__saved">
                <div className="library-modal__saved-header">
                  <h3>Saved items</h3>
                  <button aria-label="Refresh library" onClick={() => void loadSavedBlocks()} type="button">
                    <RefreshCcw size={15} />
                  </button>
                </div>
                <div className="library-modal__list">
                  {savedBlocks.length ? (
                    savedBlocks.map((block) => (
                      <article key={block.id}>
                        <div>
                          <strong>{block.name}</strong>
                          <span>
                            {block.kind} · {block.componentType}
                          </span>
                        </div>
                        <button
                          aria-label={`Delete ${block.name}`}
                          onClick={() => void deleteBlock(block.id)}
                          type="button"
                        >
                          <Trash2 size={15} />
                        </button>
                      </article>
                    ))
                  ) : (
                    <p>No saved sections or forms yet.</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
