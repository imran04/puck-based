"use client";

import type { ColumnDefinition, ColumnType, TableDto, TableRelationDto, TableWithRelationsDto, RelationType } from "@/lib/tables-api";
import { Plus, Trash2, Save, Link2, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const COLUMN_TYPES: { value: ColumnType; label: string }[] = [
  { value: "text",     label: "Text" },
  { value: "longtext", label: "Long text" },
  { value: "number",   label: "Number" },
  { value: "boolean",  label: "Boolean" },
  { value: "date",     label: "Date" },
  { value: "datetime", label: "Date & time" },
  { value: "url",      label: "URL" },
];

const RELATION_TYPES: { value: RelationType; label: string; description: string }[] = [
  { value: "one_to_one",   label: "One to One",   description: "Each row links to exactly one row in the other table" },
  { value: "one_to_many",  label: "One to Many",  description: "Each row can link to multiple rows in the other table" },
  { value: "many_to_many", label: "Many to Many", description: "Rows in both tables can link to multiple rows on each side" },
];

function newColumn(): ColumnDefinition {
  return { name: "", displayName: "", type: "text", required: false };
}

export function TableDesigner({
  table,
  allTables,
}: {
  table: TableWithRelationsDto;
  allTables: TableDto[];
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(table.displayName);
  const [columns, setColumns] = useState<ColumnDefinition[]>(
    Array.isArray(table.columns) ? table.columns : [],
  );
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  // Relation state
  const [relations, setRelations] = useState<TableRelationDto[]>(table.relations ?? []);
  const [showRelForm, setShowRelForm] = useState(false);
  const [relTarget, setRelTarget]   = useState(allTables[0]?.id ?? "");
  const [relType, setRelType]       = useState<RelationType>("one_to_many");
  const [relName, setRelName]       = useState("");
  const [relSaving, setRelSaving]   = useState(false);

  function updateColumn(index: number, patch: Partial<ColumnDefinition>) {
    setColumns((cols) => cols.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeColumn(index: number) {
    setColumns((cols) => cols.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    setSaveStatus("Saving…");
    try {
      const res = await fetch(`/api/tables/${table.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, columns }),
      });
      if (res.ok) {
        setSaveStatus("Saved");
        router.refresh();
      } else {
        setSaveStatus("Save failed");
      }
    } catch {
      setSaveStatus("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function addRelation() {
    if (!relTarget || !relName.trim()) return;
    setRelSaving(true);
    try {
      const res = await fetch(`/api/tables/${table.id}/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toTableId: relTarget, relationType: relType, displayName: relName }),
      });
      if (res.ok) {
        const data = (await res.json()) as { relation: TableRelationDto };
        setRelations((r) => [...r, data.relation]);
        setShowRelForm(false);
        setRelName("");
      }
    } finally {
      setRelSaving(false);
    }
  }

  async function removeRelation(id: string) {
    const res = await fetch(`/api/relations/${id}`, { method: "DELETE" });
    if (res.ok) setRelations((r) => r.filter((rel) => rel.id !== id));
  }

  return (
    <div className="grid gap-6">
      {/* Display name */}
      <section className="rounded-lg border border-[#d9dee5] bg-white p-5 grid gap-4">
        <h2 className="text-lg font-black">Table settings</h2>
        <label className="grid gap-2 text-sm font-black text-[#4f5661] max-w-sm">
          Display name
          <input
            className="min-h-10 rounded-lg border border-[#d9dee5] px-3 text-base font-medium text-[#171717] outline-none transition focus:border-[#1b6dff]"
            onChange={(e) => setDisplayName(e.target.value)}
            value={displayName}
          />
        </label>
      </section>

      {/* Columns */}
      <section className="rounded-lg border border-[#d9dee5] bg-white p-5 grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-black">Columns</h2>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-[#d9dee5] px-3 py-2 text-sm font-bold transition hover:bg-[#f5f7fa]"
            onClick={() => setColumns((c) => [...c, newColumn()])}
            type="button"
          >
            <Plus size={14} />
            Add column
          </button>
        </div>

        {columns.length === 0 ? (
          <p className="text-sm text-[#5f6368]">No columns yet. Add one above.</p>
        ) : (
          <div className="grid gap-3">
            {/* Header row */}
            <div className="hidden md:grid md:grid-cols-[1fr_1fr_140px_100px_40px] gap-3 text-xs font-black text-[#5f6368] uppercase tracking-wider px-1">
              <span>Name (machine)</span>
              <span>Display name</span>
              <span>Type</span>
              <span>Required</span>
              <span />
            </div>
            {columns.map((col, i) => (
              <div
                className="grid gap-3 rounded-lg border border-[#d9dee5] p-3 md:grid-cols-[1fr_1fr_140px_100px_40px] md:items-center md:border-0 md:p-0"
                key={i}
              >
                <input
                  className="min-h-9 rounded-lg border border-[#d9dee5] px-3 text-sm font-mono text-[#171717] outline-none focus:border-[#1b6dff]"
                  onChange={(e) => updateColumn(i, { name: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                  placeholder="column_name"
                  value={col.name}
                />
                <input
                  className="min-h-9 rounded-lg border border-[#d9dee5] px-3 text-sm font-medium text-[#171717] outline-none focus:border-[#1b6dff]"
                  onChange={(e) => updateColumn(i, { displayName: e.target.value })}
                  placeholder="Display name"
                  value={col.displayName}
                />
                <select
                  className="min-h-9 rounded-lg border border-[#d9dee5] px-3 text-sm font-medium text-[#171717] outline-none focus:border-[#1b6dff]"
                  onChange={(e) => updateColumn(i, { type: e.target.value as ColumnType })}
                  value={col.type}
                >
                  {COLUMN_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    checked={col.required ?? false}
                    onChange={(e) => updateColumn(i, { required: e.target.checked })}
                    type="checkbox"
                  />
                  Required
                </label>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d9dee5] text-red-500 transition hover:bg-red-50"
                  onClick={() => removeColumn(i)}
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[#171717] px-4 py-2 text-sm font-black text-white transition hover:bg-[#2b2f35] disabled:opacity-50"
            disabled={saving}
            onClick={save}
            type="button"
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save schema"}
          </button>
          {saveStatus && <span className="text-sm text-[#5f6368]">{saveStatus}</span>}
        </div>
      </section>

      {/* Relations */}
      <section className="rounded-lg border border-[#d9dee5] bg-white p-5 grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-black">Relations</h2>
          {allTables.length > 0 && (
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-[#d9dee5] px-3 py-2 text-sm font-bold transition hover:bg-[#f5f7fa]"
              onClick={() => setShowRelForm((v) => !v)}
              type="button"
            >
              <Link2 size={14} />
              Add relation
            </button>
          )}
        </div>

        {showRelForm && (
          <div className="rounded-lg border border-[#d9dee5] p-4 grid gap-3 bg-[#f5f7fa]">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-1 text-sm font-black text-[#4f5661]">
                Target table
                <select
                  className="min-h-9 rounded-lg border border-[#d9dee5] px-3 text-sm bg-white outline-none focus:border-[#1b6dff]"
                  onChange={(e) => setRelTarget(e.target.value)}
                  value={relTarget}
                >
                  {allTables.map((t) => (
                    <option key={t.id} value={t.id}>{t.displayName}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-black text-[#4f5661]">
                Relation type
                <select
                  className="min-h-9 rounded-lg border border-[#d9dee5] px-3 text-sm bg-white outline-none focus:border-[#1b6dff]"
                  onChange={(e) => setRelType(e.target.value as RelationType)}
                  value={relType}
                >
                  {RELATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-black text-[#4f5661]">
                Display name
                <input
                  className="min-h-9 rounded-lg border border-[#d9dee5] px-3 text-sm bg-white outline-none focus:border-[#1b6dff]"
                  onChange={(e) => setRelName(e.target.value)}
                  placeholder="e.g. Product orders"
                  value={relName}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-[#1b6dff] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
                disabled={relSaving || !relTarget || !relName.trim()}
                onClick={addRelation}
                type="button"
              >
                {relSaving ? "Adding…" : "Add relation"}
              </button>
              <button
                className="rounded-lg border border-[#d9dee5] px-4 py-2 text-sm font-bold"
                onClick={() => setShowRelForm(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {relations.length === 0 ? (
          <p className="text-sm text-[#5f6368]">No relations yet.</p>
        ) : (
          <div className="grid gap-2">
            {relations.map((rel) => (
              <div
                className="flex items-center justify-between gap-4 rounded-lg border border-[#d9dee5] px-4 py-3"
                key={rel.id}
              >
                <div className="min-w-0">
                  <p className="font-black text-sm">{rel.displayName}</p>
                  <p className="text-xs text-[#5f6368] mt-0.5">
                    {rel.fromTableName} → {rel.toTableName} ·{" "}
                    <span className="font-mono">{rel.relationType}</span>
                  </p>
                </div>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d9dee5] text-red-500 hover:bg-red-50"
                  onClick={() => removeRelation(rel.id)}
                  type="button"
                >
                  <Unlink size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
