"use client";

import type { DataSourceDefinition, DataSourceFilter, DsBinding, DsBindings } from "@/lib/datasource-template";
import { Database, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";

// ── Types for table metadata fetched from the API ──────────────────────────

type TableMeta = { id: string; name: string; displayName: string; columns: Array<{ name: string; displayName: string }> };

async function fetchTables(): Promise<TableMeta[]> {
  try {
    const res = await fetch("/api/tables", { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { tables?: TableMeta[] };
    return data.tables ?? [];
  } catch {
    return [];
  }
}

// ── DataSourceManager – edits a datasource array field ─────────────────────

export function DataSourceManager({
  kind = "display",
  value,
  onChange,
}: {
  kind?: "display" | "sink";
  value?: DataSourceDefinition[];
  onChange: (v: DataSourceDefinition[]) => void;
}) {
  const [tables, setTables]   = useState<TableMeta[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const sources = value ?? [];

  useEffect(() => { fetchTables().then(setTables); }, []);

  function addSource() {
    const id = `ds_${Date.now()}`;
    const first = tables[0];
    const newDs: DataSourceDefinition = {
      id,
      name: `${kind}_source_${sources.length + 1}`,
      tableId: first?.id ?? "",
      tableName: first?.displayName ?? "",
      queryType: "single",
      filters: [],
    };
    onChange([...sources, newDs]);
    setExpanded(id);
  }

  function updateSource(index: number, patch: Partial<DataSourceDefinition>) {
    onChange(sources.map((s, i) => {
      if (i !== index) return s;
      const updated = { ...s, ...patch };
      if (patch.tableId) {
        const t = tables.find((t) => t.id === patch.tableId);
        if (t) updated.tableName = t.displayName;
      }
      return updated;
    }));
  }

  function removeSource(index: number) {
    onChange(sources.filter((_, i) => i !== index));
  }

  function addFilter(index: number) {
    const src = sources[index];
    updateSource(index, {
      filters: [...(src.filters ?? []), { field: "", op: "eq", value: "" }],
    });
  }

  function updateFilter(srcIndex: number, filterIndex: number, patch: Partial<DataSourceFilter>) {
    const src = sources[srcIndex];
    updateSource(srcIndex, {
      filters: (src.filters ?? []).map((f, i) => (i === filterIndex ? { ...f, ...patch } : f)),
    });
  }

  function removeFilter(srcIndex: number, filterIndex: number) {
    const src = sources[srcIndex];
    updateSource(srcIndex, {
      filters: (src.filters ?? []).filter((_, i) => i !== filterIndex),
    });
  }

  if (tables.length === 0) {
    return (
      <div className="p-3 text-xs text-gray-500 space-y-2">
        <p>No tables found.</p>
        <a className="text-blue-600 underline" href="/tables" rel="noopener noreferrer" target="_blank">
          Create a table →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 px-1">
        {kind === "display"
          ? "Used by merge tags, conditional rules, and form-prefill option sources."
          : "Used by forms as writeback targets."}
      </p>
      {sources.map((ds, idx) => {
        const tableMeta = tables.find((t) => t.id === ds.tableId);
        const isOpen = expanded === ds.id;
        const queryType = ds.queryType || "single";
        return (
          <div className="border border-gray-200 rounded-md overflow-hidden" key={ds.id}>
            <button
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 text-xs font-bold text-left hover:bg-gray-100"
              onClick={() => setExpanded(isOpen ? null : ds.id)}
              type="button"
            >
              <span className="flex items-center gap-2">
                <Database size={12} />
                <span className="font-mono">{ds.name}</span>
                <span className="font-normal text-gray-500">({queryType})</span>
              </span>
              {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {isOpen && (
              <div className="p-3 space-y-3 text-xs">
                <label className="grid gap-1">
                  <span className="font-bold text-gray-600">Variable name</span>
                  <input
                    className="border border-gray-200 rounded px-2 py-1 font-mono"
                    onChange={(e) => updateSource(idx, { name: e.target.value.replace(/\s+/g, "_") })}
                    value={ds.name}
                  />
                  <span className="text-gray-400">
                    {kind === "display"
                      ? "Used in merge tags, list bindings, and conditional rules."
                      : "Used as the form sink identifier."}
                  </span>
                </label>

                <label className="grid gap-1">
                  <span className="font-bold text-gray-600">Table</span>
                  <select
                    className="border border-gray-200 rounded px-2 py-1 bg-white"
                    onChange={(e) => updateSource(idx, { tableId: e.target.value })}
                    value={ds.tableId}
                  >
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>{t.displayName}</option>
                    ))}
                  </select>
                </label>

                {kind === "display" ? (
                  <>
                    <label className="grid gap-1">
                      <span className="font-bold text-gray-600">Query type</span>
                      <select
                        className="border border-gray-200 rounded px-2 py-1 bg-white"
                        onChange={(e) => updateSource(idx, { queryType: e.target.value as "single" | "list" })}
                        value={queryType}
                      >
                        <option value="single">Single record</option>
                        <option value="list">List of records</option>
                      </select>
                    </label>

                    {queryType === "list" && (
                      <label className="grid gap-1">
                        <span className="font-bold text-gray-600">Limit</span>
                        <input
                          className="border border-gray-200 rounded px-2 py-1 w-24"
                          max={500}
                          min={1}
                          onChange={(e) => updateSource(idx, { limit: Number(e.target.value) })}
                          type="number"
                          value={ds.limit ?? 10}
                        />
                      </label>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-600">Filters</span>
                        <button
                          className="text-blue-600 hover:underline flex items-center gap-1"
                          onClick={() => addFilter(idx)}
                          type="button"
                        >
                          <Plus size={10} /> Add
                        </button>
                      </div>
                      {(ds.filters ?? []).map((f, fi) => (
                        <div className="flex gap-1 items-center" key={fi}>
                          <select
                            className="border border-gray-200 rounded px-1 py-1 bg-white flex-1"
                            onChange={(e) => updateFilter(idx, fi, { field: e.target.value })}
                            value={f.field}
                          >
                            <option value="">— field —</option>
                            {(tableMeta?.columns ?? []).map((c) => (
                              <option key={c.name} value={c.name}>{c.displayName || c.name}</option>
                            ))}
                          </select>
                          <select
                            className="border border-gray-200 rounded px-1 py-1 bg-white w-20"
                            onChange={(e) => updateFilter(idx, fi, { op: e.target.value as DataSourceFilter["op"] })}
                            value={f.op}
                          >
                            <option value="eq">equals</option>
                            <option value="neq">not equals</option>
                            <option value="contains">contains</option>
                            <option value="gt">greater than</option>
                            <option value="lt">less than</option>
                          </select>
                          <input
                            className="border border-gray-200 rounded px-1 py-1 flex-1"
                            onChange={(e) => updateFilter(idx, fi, { value: e.target.value })}
                            placeholder="value"
                            value={f.value}
                          />
                          <button
                            className="text-red-400 hover:text-red-600"
                            onClick={() => removeFilter(idx, fi)}
                            type="button"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}

                <div className="flex justify-end pt-1">
                  <button
                    className="text-red-500 hover:underline text-xs flex items-center gap-1"
                    onClick={() => removeSource(idx)}
                    type="button"
                  >
                    <Trash2 size={10} /> Remove datasource
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button
        className="w-full border border-dashed border-gray-300 rounded-md py-2 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2"
        onClick={addSource}
        type="button"
      >
        <Plus size={12} /> Add datasource
      </button>
    </div>
  );
}

// ── DsBindingsEditor – edits component._dsBindings ────────────────────────

export function DsBindingsEditor({
  bindableFields,
  dataSources,
  value,
  onChange,
}: {
  bindableFields: string[];
  dataSources: DataSourceDefinition[];
  value: DsBindings;
  onChange: (v: DsBindings) => void;
}) {
  const [tables, setTables] = useState<TableMeta[]>([]);

  useEffect(() => { fetchTables().then(setTables); }, []);

  function setBinding(field: string, source: string, dsField: string) {
    if (!source || !dsField) {
      const next = { ...value };
      delete next[field];
      onChange(next);
    } else {
      onChange({ ...value, [field]: { source, field: dsField } });
    }
  }

  if (dataSources.length === 0) {
    return (
      <p className="text-xs text-gray-400 p-2">
        Add datasources in the page root settings first.
      </p>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      {bindableFields.map((field) => {
        const current: DsBinding | undefined = value[field];
        const currentDs = dataSources.find((ds) => ds.name === current?.source);
        const tableMeta = tables.find((t) => t.id === currentDs?.tableId);
        const currentField = current?.field ?? "";
        return (
          <div className="grid gap-1" key={field}>
            <span className="font-bold text-gray-600 capitalize">{field}</span>
            <div className="flex gap-1">
              <select
                className="border border-gray-200 rounded px-2 py-1 bg-white flex-1"
                onChange={(e) => setBinding(field, e.target.value, "")}
                value={current?.source ?? ""}
              >
                <option value="">— no binding —</option>
                {dataSources.map((ds) => (
                  <option key={ds.id} value={ds.name}>{ds.name}</option>
                ))}
              </select>
              {current?.source && (
                <select
                  className="border border-gray-200 rounded px-2 py-1 bg-white flex-1"
                  onChange={(e) => setBinding(field, current.source, e.target.value)}
                  value={currentField}
                >
                  <option value="">— field —</option>
                  {(tableMeta?.columns ?? []).map((c) => (
                    <option key={c.name} value={c.name}>{c.displayName || c.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
