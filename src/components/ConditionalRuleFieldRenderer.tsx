"use client";

import { usePuck } from "@puckeditor/core";
import { useEffect, useMemo, useState } from "react";
import type { ConditionalRule, ConditionOperator, DataSourceDefinition } from "@/lib/datasource-template";

type TableMeta = {
  id: string;
  name: string;
  displayName: string;
  columns: Array<{ name: string; displayName: string }>;
};

const operatorTokens: Record<ConditionOperator, string> = {
  eq: "==",
  neq: "!=",
  contains: "contains",
  startsWith: "startsWith",
  endsWith: "endsWith",
  gt: ">",
  lt: "<",
};

const tokenToOperator: Record<string, ConditionOperator> = {
  "==": "eq",
  "!=": "neq",
  contains: "contains",
  startswith: "startsWith",
  endswith: "endsWith",
  ">": "gt",
  "<": "lt",
};

const predicatePattern =
  /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=>\s*\1\.([a-zA-Z_][a-zA-Z0-9_]*)\s*(==|!=|>|<|contains|startsWith|endsWith)\s*(.+?)\s*$/i;

const emptyRule: ConditionalRule = {
  source: "",
  field: "",
  operator: "eq",
  value: "",
  predicate: "",
};

function normalizeQuotedValue(raw: string) {
  const value = String(raw || "").trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
  }
  return value;
}

function parsePredicate(predicate: string): Partial<ConditionalRule> {
  const match = String(predicate || "").match(predicatePattern);
  if (!match) {
    return {};
  }

  const token = match[3];
  const mapped = tokenToOperator[token.toLowerCase()];
  if (!mapped) {
    return {};
  }

  return {
    field: match[2],
    operator: mapped,
    value: normalizeQuotedValue(match[4]),
  };
}

function quotePredicateValue(value: string) {
  const escaped = String(value || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  return `"${escaped}"`;
}

function buildPredicate(rule: ConditionalRule) {
  if (!rule.field) {
    return "";
  }
  return `x => x.${rule.field} ${operatorTokens[rule.operator]} ${quotePredicateValue(rule.value)}`;
}

function normalizeRule(value?: ConditionalRule): ConditionalRule {
  const base = { ...emptyRule, ...(value ?? {}) };
  if (!base.field && base.predicate) {
    const parsed = parsePredicate(base.predicate);
    return { ...base, ...parsed };
  }
  return base;
}

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

type ConditionalRuleFieldRendererProps = {
  value?: ConditionalRule;
  onChange: (value: ConditionalRule) => void;
  readOnly?: boolean;
};

export function ConditionalRuleFieldRenderer({
  value,
  onChange,
  readOnly,
}: ConditionalRuleFieldRendererProps) {
  const { appState } = usePuck();
  const rootProps = (appState.data.root as { props?: Record<string, unknown> }).props ?? {};
  const dataSources = (rootProps.dataSources as DataSourceDefinition[]) ?? [];
  const [tables, setTables] = useState<TableMeta[]>([]);
  const rule = useMemo(() => normalizeRule(value), [value]);

  useEffect(() => {
    fetchTables().then(setTables);
  }, []);

  const selectedSource = dataSources.find((source) => source.name === rule.source);
  const selectedTable = tables.find((table) => table.id === selectedSource?.tableId);
  const columns = selectedTable?.columns ?? [];

  function emit(next: ConditionalRule) {
    onChange({
      ...next,
      predicate: buildPredicate(next),
    });
  }

  function handleSourceChange(sourceName: string) {
    const source = dataSources.find((item) => item.name === sourceName);
    const table = tables.find((item) => item.id === source?.tableId);
    const nextField = table?.columns.some((column) => column.name === rule.field)
      ? rule.field
      : (table?.columns[0]?.name ?? "");

    emit({
      ...rule,
      source: sourceName,
      field: nextField,
    });
  }

  function handleFieldChange(field: string) {
    emit({
      ...rule,
      field,
    });
  }

  function handleOperatorChange(operator: ConditionOperator) {
    emit({
      ...rule,
      operator,
    });
  }

  function handleValueChange(nextValue: string) {
    emit({
      ...rule,
      value: nextValue,
    });
  }

  if (dataSources.length === 0) {
    return (
      <p className="text-xs text-gray-400 p-2">
        Add at least one datasource in page settings to activate conditional logic.
      </p>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      <label className="grid gap-1">
        <span className="font-bold text-gray-600">Datasource</span>
        <select
          className="border border-gray-200 rounded px-2 py-1 bg-white"
          disabled={readOnly}
          onChange={(event) => handleSourceChange(event.target.value)}
          value={rule.source}
        >
          <option value="">— choose datasource —</option>
          {dataSources.map((source) => (
            <option key={source.id} value={source.name}>
              {source.name} ({source.queryType})
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-1">
        <span className="font-bold text-gray-600">Predicate builder</span>
        <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-1">
          <select
            className="border border-gray-200 rounded px-2 py-1 bg-white"
            disabled={readOnly || !rule.source}
            onChange={(event) => handleFieldChange(event.target.value)}
            value={rule.field}
          >
            <option value="">— field —</option>
            {columns.map((column) => (
              <option key={column.name} value={column.name}>
                {column.displayName || column.name}
              </option>
            ))}
          </select>

          <select
            className="border border-gray-200 rounded px-2 py-1 bg-white"
            disabled={readOnly || !rule.source}
            onChange={(event) => handleOperatorChange(event.target.value as ConditionOperator)}
            value={rule.operator}
          >
            <option value="eq">equals</option>
            <option value="neq">not equals</option>
            <option value="contains">contains</option>
            <option value="startsWith">starts with</option>
            <option value="endsWith">ends with</option>
            <option value="gt">greater than</option>
            <option value="lt">less than</option>
          </select>
        </div>
      </div>

      <label className="grid gap-1">
        <span className="font-bold text-gray-600">Compare value</span>
        <input
          className="border border-gray-200 rounded px-2 py-1"
          disabled={readOnly || !rule.source}
          onChange={(event) => handleValueChange(event.target.value)}
          placeholder="value"
          value={rule.value}
        />
      </label>

      <label className="grid gap-1">
        <span className="font-bold text-gray-600">Generated lambda</span>
        <input
          className="border border-gray-200 rounded px-2 py-1 font-mono bg-gray-50"
          readOnly
          value={buildPredicate(rule) || "x => x.field == \"value\""}
        />
      </label>
    </div>
  );
}
