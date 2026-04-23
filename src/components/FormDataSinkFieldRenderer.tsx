"use client";

import { usePuck } from "@puckeditor/core";
import { useEffect, useMemo, useState } from "react";
import {
  isLayoutOnlyField,
  normalizeName,
  type FormDataSink,
  type FormField,
} from "@/puck/form-schema";

type TableMeta = {
  id: string;
  name: string;
  displayName: string;
  columns: Array<{ name: string; displayName: string }>;
};

const emptySink: FormDataSink = {
  source: "",
  tableId: "",
};

async function fetchTables(): Promise<TableMeta[]> {
  try {
    const res = await fetch("/api/tables", { cache: "no-store" });
    if (!res.ok) return [];
    const payload = (await res.json()) as { tables?: TableMeta[] };
    return payload.tables ?? [];
  } catch {
    return [];
  }
}

export function FormDataSinkFieldRenderer({
  value,
  onChange,
  readOnly,
}: {
  value?: FormDataSink;
  onChange: (value: FormDataSink) => void;
  readOnly?: boolean;
}) {
  const { selectedItem } = usePuck();
  const [tables, setTables] = useState<TableMeta[]>([]);
  const sink = useMemo(() => ({ ...emptySink, ...(value ?? {}) }), [value]);
  const selectedTable = tables.find((table) => table.id === sink.tableId);
  const formFields = useMemo(() => {
    if (selectedItem?.type !== "FormBlock") {
      return [] as FormField[];
    }

    const props = selectedItem.props as { fields?: unknown };
    return Array.isArray(props.fields) ? (props.fields as FormField[]) : [];
  }, [selectedItem]);
  const fieldMappings = useMemo(
    () =>
      formFields
        .map((field, index) => {
          if (isLayoutOnlyField(field.type)) {
            return null;
          }

          const formField = normalizeName(
            field.name || field.label,
            `field_${index + 1}`,
          );
          const explicitSinkColumn = String(field.sinkColumn || "").trim();
          const tableColumn = explicitSinkColumn || formField;

          return {
            explicit: Boolean(explicitSinkColumn),
            formField,
            label: field.label || formField,
            tableColumn,
          };
        })
        .filter((mapping): mapping is {
          explicit: boolean;
          formField: string;
          label: string;
          tableColumn: string;
        } => Boolean(mapping)),
    [formFields],
  );

  useEffect(() => {
    fetchTables().then(setTables);
  }, []);

  function emit(next: FormDataSink) {
    onChange(next);
  }

  function handleTableChange(tableId: string) {
    const table = tables.find((item) => item.id === tableId);
    emit({
      ...sink,
      tableId,
      source:
        sink.source ||
        table?.name ||
        table?.displayName ||
        (tableId ? "form_sink" : ""),
      fieldMappings: [],
    });
  }

  function handleSinkKeyChange(source: string) {
    emit({
      ...sink,
      source,
    });
  }

  if (tables.length === 0) {
    return (
      <div className="space-y-2 p-2 text-xs">
        <p className="text-gray-400">No tables found. Create a table to enable form writeback.</p>
        <a
          className="inline-flex rounded border border-gray-300 bg-white px-2 py-1 font-bold text-gray-700 hover:border-blue-400 hover:text-blue-700"
          href="/tables"
          rel="noreferrer"
          target="_blank"
        >
          Open tables
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      <label className="grid gap-1">
        <span className="font-bold text-gray-600">Sink table</span>
        <select
          className="border border-gray-200 rounded px-2 py-1 bg-white"
          disabled={readOnly}
          onChange={(event) => handleTableChange(event.target.value)}
          value={sink.tableId}
        >
          <option value="">No sink writeback</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.displayName || table.name}
            </option>
          ))}
        </select>
      </label>
      {sink.tableId ? (
        <label className="grid gap-1">
          <span className="font-bold text-gray-600">Sink key</span>
          <input
            className="border border-gray-200 rounded px-2 py-1 bg-white"
            disabled={readOnly}
            onChange={(event) => handleSinkKeyChange(event.target.value)}
            placeholder="form_sink"
            value={sink.source}
          />
          <span className="text-gray-400">
            Optional identifier stored with sink rows.
          </span>
        </label>
      ) : null}

      {sink.tableId ? (
        <>
          <p className="text-gray-500">
            Rows will insert into {selectedTable?.displayName || selectedTable?.name || "the selected table"}.
          </p>
          <div className="space-y-1">
            <span className="font-bold text-gray-600">Field-level mapping</span>
            {fieldMappings.length > 0 ? (
              <div className="max-h-48 overflow-auto rounded border border-gray-200 bg-gray-50 p-2 font-mono text-[11px]">
                {fieldMappings.map((mapping) => (
                  <p key={`${mapping.formField}_${mapping.tableColumn}`}>
                    {mapping.formField} → {mapping.tableColumn}
                    {mapping.explicit ? " (explicit)" : " (auto)"}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">
                Configure fields in the form designer to define sink mappings.
              </p>
            )}
          </div>
          {selectedTable?.columns?.length ? (
            <p className="text-gray-400">
              Columns: {selectedTable.columns.map((column) => column.name).join(", ")}
            </p>
          ) : null}
          <p className="text-gray-400">
            Mapping is defined per field in form designer. Fields without explicit sink column
            use their machine name for auto-mapping.
          </p>
        </>
      ) : null}
    </div>
  );
}
