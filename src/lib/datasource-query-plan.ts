import type { Data } from "@puckeditor/core";
import { getDisplaySourcesFromRootProps } from "@/lib/datasource-roots";

export type QueryFilter = {
  field: string;
  op: "eq" | "neq" | "contains" | "gt" | "lt";
  value: string;
  valueSource?: "static" | "query" | "body";
  valueKey?: string;
  required?: boolean;
  nullMode?: "skip-filter" | "empty-string" | "match-null";
};

export type QueryableDataSource = {
  id: string;
  name: string;
  tableId: string;
  tableName: string;
  queryType: "single" | "list";
  filters: QueryFilter[];
  orderBy?: string;
  orderDir?: "asc" | "desc";
  limit?: number;
  aliasWithPageSource?: boolean;
};

type PuckItem = { type: string; props?: Record<string, unknown> };

export type SectionScopedSource = QueryableDataSource & {
  sectionName: string;
  sourceName: string;
};

export type SourceAlias = {
  alias: string;
  target: string;
  reason: "section-page-equivalent";
};

export type QueryLoadLevel = "green" | "amber" | "red";

export type QueryPlan = {
  allSources: QueryableDataSource[];
  querySources: QueryableDataSource[];
  aliases: SourceAlias[];
  estimatedQueries: number;
  level: QueryLoadLevel;
};

function isPuckItem(value: unknown): value is PuckItem {
  return Boolean(value && typeof value === "object" && "type" in (value as Record<string, unknown>));
}

function isPuckItemArray(value: unknown): value is PuckItem[] {
  return Array.isArray(value) && value.every(isPuckItem);
}

function normalizeSource(value: Partial<QueryableDataSource>): QueryableDataSource | null {
  const name = String(value.name || "").trim();
  const tableId = String(value.tableId || "").trim();
  if (!name || !tableId) {
    return null;
  }

  return {
    id: String(value.id || `${name}_${tableId}`),
    name,
    tableId,
    tableName: String(value.tableName || ""),
    queryType: value.queryType === "list" ? "list" : "single",
    filters: Array.isArray(value.filters) ? (value.filters as QueryFilter[]) : [],
    orderBy: value.orderBy ? String(value.orderBy) : undefined,
    orderDir: value.orderDir === "desc" ? "desc" : "asc",
    limit: typeof value.limit === "number" ? value.limit : undefined,
    aliasWithPageSource: Boolean(value.aliasWithPageSource),
  };
}

export function sanitizeViewBagSegment(value: string, fallback: string): string {
  const safe = String(value || "")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = safe || fallback;
  return /^\d/.test(base) ? `_${base}` : base;
}

export function makeScopedSourceName(sectionName: string, sourceName: string): string {
  const safeSection = sanitizeViewBagSegment(sectionName, "section");
  const safeSource = sanitizeViewBagSegment(sourceName, "source");
  return `${safeSection}_${safeSource}`;
}

export function buildSectionSourceAliasMap(
  sectionName: string,
  sectionSources: QueryableDataSource[],
): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const source of sectionSources) {
    if (!source?.name) {
      continue;
    }
    aliases[source.name] = makeScopedSourceName(sectionName, source.name);
  }
  return aliases;
}

export function remapMergeTagSourcesInHtml(
  html: string,
  aliases: Record<string, string>,
): string {
  if (!html.includes("{{") || Object.keys(aliases).length === 0) {
    return html;
  }

  const entries = Object.entries(aliases).map(([source, target]) => [source.toLowerCase(), target] as const);

  return html.replace(/\{\{\s*([A-Za-z0-9_][A-Za-z0-9_-]*)/g, (match, sourceName) => {
    const hit = entries.find(([source]) => source === String(sourceName).toLowerCase());
    if (!hit) {
      return match;
    }
    return match.replace(sourceName, hit[1]);
  });
}

function datasourceFingerprint(source: QueryableDataSource): string {
  const filters = (source.filters || [])
    .map((filter) =>
      [
        filter.field,
        filter.op,
        filter.value,
        filter.valueSource || "static",
        filter.valueKey || "",
        filter.required ? "required" : "optional",
        filter.nullMode || "skip-filter",
      ].join("::"),
    )
    .sort()
    .join("|");

  return [
    source.tableId,
    source.queryType,
    source.orderBy || "",
    source.orderDir || "asc",
    source.limit ?? "",
    filters,
  ].join("::");
}

function queryLoadLevel(count: number): QueryLoadLevel {
  if (count > 15) {
    return "red";
  }
  if (count > 8) {
    return "amber";
  }
  return "green";
}

export function collectSectionScopedSourcesFromItems(items: PuckItem[]): SectionScopedSource[] {
  const collected: SectionScopedSource[] = [];
  let anonymousIndex = 0;

  function visit(nodes: PuckItem[]) {
    for (const node of nodes) {
      const props = node.props ?? {};

      if (node.type === "SavedSection" || node.type === "SavedForm") {
        const block = props.block as { data?: unknown } | undefined;
        if (block?.data && isPuckItem(block.data)) {
          visit([block.data]);
        }
        continue;
      }

      if (node.type === "Section") {
        const sectionNameRaw = String(
          props._instanceName || props.id || `section_${++anonymousIndex}`,
        );
        const sectionSourcesRaw = Array.isArray(props.sectionSources)
          ? (props.sectionSources as Partial<QueryableDataSource>[])
          : [];
        for (const candidate of sectionSourcesRaw) {
          const normalized = normalizeSource(candidate);
          if (!normalized) {
            continue;
          }
          collected.push({
            ...normalized,
            sourceName: normalized.name,
            sectionName: sectionNameRaw,
            name: makeScopedSourceName(sectionNameRaw, normalized.name),
          });
        }
      }

      for (const value of Object.values(props)) {
        if (isPuckItemArray(value)) {
          visit(value);
        }
      }
    }
  }

  visit(items);
  return collected;
}

export function buildQueryPlan(
  pageSourcesRaw: QueryableDataSource[],
  sectionSources: SectionScopedSource[],
): QueryPlan {
  const pageSources = pageSourcesRaw
    .map((source) => normalizeSource(source))
    .filter((source): source is QueryableDataSource => Boolean(source));

  const querySources: QueryableDataSource[] = [...pageSources];
  const allSources: QueryableDataSource[] = [...pageSources];
  const aliases: SourceAlias[] = [];

  const pageByFingerprint = new Map<string, QueryableDataSource>();
  for (const source of pageSources) {
    const key = datasourceFingerprint(source);
    if (!pageByFingerprint.has(key)) {
      pageByFingerprint.set(key, source);
    }
  }

  for (const sectionSource of sectionSources) {
    allSources.push(sectionSource);
    const equivalentPageSource = pageByFingerprint.get(datasourceFingerprint(sectionSource));

    if (sectionSource.aliasWithPageSource && equivalentPageSource) {
      aliases.push({
        alias: sectionSource.name,
        target: equivalentPageSource.name,
        reason: "section-page-equivalent",
      });
      continue;
    }

    querySources.push(sectionSource);
  }

  return {
    allSources,
    querySources,
    aliases,
    estimatedQueries: querySources.length,
    level: queryLoadLevel(querySources.length),
  };
}

export function estimateQueryPlanForData(data: Data): QueryPlan {
  const rootProps = (data.root as { props?: Record<string, unknown> }).props ?? {};
  const pageSources = getDisplaySourcesFromRootProps(rootProps as Record<string, unknown>) as QueryableDataSource[];
  const sectionSources = collectSectionScopedSourcesFromItems((data.content ?? []) as PuckItem[]);
  return buildQueryPlan(pageSources, sectionSources);
}
