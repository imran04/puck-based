"use client";

import type { ColumnDefinition, DynamicRowDto, TableWithRelationsDto } from "@/lib/tables-api";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { useState } from "react";

type RowData = Record<string, string>;

function emptyRow(columns: ColumnDefinition[]): RowData {
  return Object.fromEntries(columns.map((c) => [c.name, ""]));
}

function FieldInput({
  column,
  value,
  onChange,
}: {
  column: ColumnDefinition;
  value: string;
  onChange: (v: string) => void;
}) {
  if (column.type === "longtext") {
    return (
      <textarea
        className="w-full min-h-20 rounded-lg border border-[#d9dee5] px-3 py-2 text-sm outline-none focus:border-[#1b6dff]"
        onChange={(e) => onChange(e.target.value)}
        value={value}
      />
    );
  }
  if (column.type === "boolean") {
    return (
      <select
        className="rounded-lg border border-[#d9dee5] px-3 py-2 text-sm bg-white outline-none focus:border-[#1b6dff]"
        onChange={(e) => onChange(e.target.value)}
        value={value}
      >
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  const typeMap: Record<string, string> = { number: "number", date: "date", datetime: "datetime-local", url: "url" };
  const inputType = typeMap[column.type] ?? "text";
  return (
    <input
      className="w-full rounded-lg border border-[#d9dee5] px-3 py-2 text-sm outline-none focus:border-[#1b6dff]"
      onChange={(e) => onChange(e.target.value)}
      type={inputType}
      value={value}
    />
  );
}

export function TableDataEditor({
  table,
  rows: initialRows,
}: {
  table: TableWithRelationsDto;
  rows: DynamicRowDto[];
}) {
  const columns = Array.isArray(table.columns) ? table.columns : [];
  const [rows, setRows] = useState<DynamicRowDto[]>(initialRows);
  const [newRowData, setNewRowData] = useState<RowData>(() => emptyRow(columns));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData]   = useState<RowData>({});
  const [saving, setSaving]       = useState(false);

  async function addRow() {
    setSaving(true);
    try {
      const res = await fetch(`/api/tables/${table.id}/rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: newRowData }),
      });
      if (res.ok) {
        const payload = (await res.json()) as { row: DynamicRowDto };
        setRows((r) => [payload.row, ...r]);
        setNewRowData(emptyRow(columns));
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(rowId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/tables/${table.id}/rows/${rowId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: editData }),
      });
      if (res.ok) {
        const payload = (await res.json()) as { row: DynamicRowDto };
        setRows((r) => r.map((row) => (row.id === rowId ? payload.row : row)));
        setEditingId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(rowId: string) {
    const res = await fetch(`/api/tables/${table.id}/rows/${rowId}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setRows((r) => r.filter((row) => row.id !== rowId));
    }
  }

  function startEdit(row: DynamicRowDto) {
    setEditingId(row.id);
    const data: RowData = {};
    columns.forEach((c) => { data[c.name] = String((row.data as Record<string, unknown>)[c.name] ?? ""); });
    setEditData(data);
  }

  if (columns.length === 0) {
    return (
      <div className="rounded-lg border border-[#d9dee5] bg-white p-10 text-center text-[#5f6368]">
        <p className="font-medium">This table has no columns yet.</p>
        <a className="mt-2 inline-block text-[#1b6dff] font-bold hover:underline" href={`/tables/${table.id}`}>
          Add columns →
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* New row form */}
      <section className="rounded-lg border border-[#d9dee5] bg-white p-5 grid gap-4">
        <h2 className="text-lg font-black">Add row</h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 3)}, 1fr)` }}>
          {columns.map((col) => (
            <label className="grid gap-1 text-sm font-black text-[#4f5661]" key={col.name}>
              {col.displayName || col.name}
              {col.required && <span className="text-red-500">*</span>}
              <FieldInput
                column={col}
                onChange={(v) => setNewRowData((d) => ({ ...d, [col.name]: v }))}
                value={newRowData[col.name] ?? ""}
              />
            </label>
          ))}
        </div>
        <button
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#1b6dff] px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          disabled={saving}
          onClick={addRow}
          type="button"
        >
          <Plus size={14} />
          {saving ? "Saving…" : "Add row"}
        </button>
      </section>

      {/* Row table */}
      <section className="rounded-lg border border-[#d9dee5] bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[#d9dee5]">
          <h2 className="text-lg font-black">Rows</h2>
          <span className="rounded-full bg-[#eef3f8] px-3 py-1 text-xs font-black text-[#4f5661]">
            {rows.length}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#5f6368]">No rows yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#d9dee5] bg-[#f5f7fa]">
                  {columns.map((col) => (
                    <th className="px-4 py-3 text-left text-xs font-black text-[#5f6368] uppercase tracking-wider" key={col.name}>
                      {col.displayName || col.name}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-black text-[#5f6368] uppercase tracking-wider w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="border-b border-[#d9dee5] last:border-b-0 hover:bg-[#f9fafb]" key={row.id}>
                    {editingId === row.id ? (
                      <>
                        {columns.map((col) => (
                          <td className="px-4 py-2" key={col.name}>
                            <FieldInput
                              column={col}
                              onChange={(v) => setEditData((d) => ({ ...d, [col.name]: v }))}
                              value={editData[col.name] ?? ""}
                            />
                          </td>
                        ))}
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1b6dff] text-white disabled:opacity-50"
                              disabled={saving}
                              onClick={() => saveEdit(row.id)}
                              type="button"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d9dee5]"
                              onClick={() => setEditingId(null)}
                              type="button"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        {columns.map((col) => (
                          <td className="px-4 py-3 text-[#171717]" key={col.name}>
                            <span className="line-clamp-2">
                              {String((row.data as Record<string, unknown>)[col.name] ?? "—")}
                            </span>
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d9dee5] hover:bg-[#f5f7fa]"
                              onClick={() => startEdit(row)}
                              type="button"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d9dee5] text-red-500 hover:bg-red-50"
                              onClick={() => deleteRow(row.id)}
                              type="button"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
