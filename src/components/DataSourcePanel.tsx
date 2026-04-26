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

function sanitizeDatasourceName(value: string, fallback = "source") {
  const safe = String(value || "")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = safe || fallback;
  return /^\d/.test(base) ? `_${base}` : base;
}

// ── DataSourceManager – edits a datasource array field ─────────────────────

export function DataSourceManager({
  kind = "display",
  scope = "page",
  value,
  onChange,
}: {
  kind?: "display" | "sink";
  scope?: "page" | "section";
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
      name: sanitizeDatasourceName(`${kind}_source_${sources.length + 1}`),
      tableId: first?.id ?? "",
      tableName: first?.displayName ?? "",
      queryType: "single",
      filters: [],
      aliasWithPageSource: false,
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
      filters: [
        ...(src.filters ?? []),
        {
          field: "",
          op: "eq",
          value: "",
          valueSource: "static",
          valueKey: "",
          required: false,
          nullMode: "skip-filter",
        },
      ],
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
                    onChange={(e) => updateSource(idx, { name: sanitizeDatasourceName(e.target.value) })}
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

                    {scope === "section" && (
                      <label className="grid gap-1">
                        <span className="font-bold text-gray-600">Alias optimization</span>
                        <label className="inline-flex items-center gap-2 text-gray-700">
                          <input
                            checked={Boolean(ds.aliasWithPageSource)}
                            onChange={(e) =>
                              updateSource(idx, { aliasWithPageSource: e.currentTarget.checked })
                            }
                            type="checkbox"
                          />
                          Alias with equivalent page datasource (opt-in)
                        </label>
                        <span className="text-gray-400">
                          Reuses page-query result only when table/query/filter shape matches.
                        </span>
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
                        <div className="border border-gray-100 rounded p-2 space-y-2" key={fi}>
                          <div className="flex gap-1 items-center">
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
                              className="border border-gray-200 rounded px-1 py-1 bg-white w-24"
                              onChange={(e) => updateFilter(idx, fi, { op: e.target.value as DataSourceFilter["op"] })}
                              value={f.op}
                            >
                              <option value="eq">equals</option>
                              <option value="neq">not equals</option>
                              <option value="contains">contains</option>
                              <option value="gt">greater than</option>
                              <option value="lt">less than</option>
                            </select>
                            <button
                              className="text-red-400 hover:text-red-600"
                              onClick={() => removeFilter(idx, fi)}
                              type="button"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          <div className="flex gap-1 items-center">
                            <select
                              className="border border-gray-200 rounded px-1 py-1 bg-white w-28"
                              onChange={(e) =>
                                updateFilter(idx, fi, {
                                  valueSource: e.target.value as DataSourceFilter["valueSource"],
                                })
                              }
                              value={f.valueSource || "static"}
                            >
                              <option value="static">Static</option>
                              <option value="query">Querystring</option>
                              <option value="body">Search payload</option>
                            </select>
                            {(f.valueSource || "static") === "static" ? (
                              <input
                                className="border border-gray-200 rounded px-1 py-1 flex-1"
                                onChange={(e) => updateFilter(idx, fi, { value: e.target.value })}
                                placeholder="value"
                                value={f.value}
                              />
                            ) : (
                              <input
                                className="border border-gray-200 rounded px-1 py-1 flex-1"
                                onChange={(e) => updateFilter(idx, fi, { valueKey: e.target.value })}
                                placeholder="parameter key"
                                value={f.valueKey || ""}
                              />
                            )}
                            <label className="inline-flex items-center gap-1 text-[11px] text-gray-600">
                              <input
                                checked={Boolean(f.required)}
                                onChange={(e) => updateFilter(idx, fi, { required: e.currentTarget.checked })}
                                type="checkbox"
                              />
                              Required
                            </label>
                          </div>

                          <div className="flex gap-1 items-center">
                            <span className="text-[11px] text-gray-500 whitespace-nowrap">When missing:</span>
                            <select
                              className="border border-gray-200 rounded px-1 py-1 bg-white flex-1"
                              disabled={Boolean(f.required)}
                              onChange={(e) =>
                                updateFilter(idx, fi, {
                                  nullMode: e.target.value as DataSourceFilter["nullMode"],
                                })
                              }
                              value={f.nullMode || "skip-filter"}
                            >
                              <option value="skip-filter">Ignore this filter</option>
                              <option value="empty-string">Use empty string</option>
                              <option value="match-null">Match null/empty values</option>
                            </select>
                          </div>
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
