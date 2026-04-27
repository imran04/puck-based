import "server-only";

import { withAdminSessionHeader } from "./admin-session-header";

export type ColumnType = "text" | "longtext" | "number" | "boolean" | "date" | "datetime" | "url";

export type ColumnDefinition = {
  name: string;
  displayName: string;
  type: ColumnType;
  required?: boolean;
};

export type RelationType = "one_to_one" | "one_to_many" | "many_to_many";

export type TableRelationDto = {
  id: string;
  fromTableId: string;
  fromTableName: string;
  toTableId: string;
  toTableName: string;
  relationType: RelationType;
  displayName: string;
  createdAt: string;
};

export type TableDto = {
  id: string;
  name: string;
  displayName: string;
  columns: ColumnDefinition[];
  createdAt: string;
  updatedAt: string;
};

export type TableWithRelationsDto = TableDto & {
  relations: TableRelationDto[];
};

export type DynamicRowDto = {
  id: string;
  tableId: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

const defaultApiUrl = "http://127.0.0.1:5056";
const apiBaseUrl = (process.env.BUILDER_API_URL || defaultApiUrl).replace(/\/$/, "");

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const headers = await withAdminSessionHeader({
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });

    const res = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers,
      signal: controller.signal,
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Tables API ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function listTables() {
  return apiFetch<TableDto[]>("/api/tables");
}

export function getTable(id: string) {
  return apiFetch<TableWithRelationsDto>(`/api/tables/${encodeURIComponent(id)}`);
}

export function createTable(name: string, displayName: string, columns: ColumnDefinition[]) {
  return apiFetch<TableDto>("/api/tables", {
    method: "POST",
    body: JSON.stringify({ name, displayName, columns }),
  });
}

export function updateTable(id: string, displayName: string, columns: ColumnDefinition[]) {
  return apiFetch<TableDto>(`/api/tables/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ displayName, columns }),
  });
}

export async function deleteTable(id: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const headers = await withAdminSessionHeader();
    const res = await fetch(`${apiBaseUrl}/api/tables/${encodeURIComponent(id)}`, {
      method: "DELETE",
      cache: "no-store",
      headers,
      signal: controller.signal,
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function listRows(tableId: string, params?: { limit?: number; filterField?: string; filterOp?: string; filterValue?: string }) {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.filterField) qs.set("filterField", params.filterField);
  if (params?.filterOp) qs.set("filterOp", params.filterOp);
  if (params?.filterValue) qs.set("filterValue", params.filterValue);
  const query = qs.toString() ? `?${qs}` : "";
  return apiFetch<DynamicRowDto[]>(`/api/tables/${encodeURIComponent(tableId)}/rows${query}`);
}

export function createRow(tableId: string, data: Record<string, unknown>) {
  return apiFetch<DynamicRowDto>(`/api/tables/${encodeURIComponent(tableId)}/rows`, {
    method: "POST",
    body: JSON.stringify({ data }),
  });
}

export function updateRow(tableId: string, rowId: string, data: Record<string, unknown>) {
  return apiFetch<DynamicRowDto>(`/api/tables/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(rowId)}`, {
    method: "PUT",
    body: JSON.stringify({ data }),
  });
}

export async function deleteRow(tableId: string, rowId: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const headers = await withAdminSessionHeader();
    const res = await fetch(
      `${apiBaseUrl}/api/tables/${encodeURIComponent(tableId)}/rows/${encodeURIComponent(rowId)}`,
      { method: "DELETE", cache: "no-store", headers, signal: controller.signal },
    );
    return res.ok || res.status === 204;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function createRelation(
  tableId: string,
  toTableId: string,
  relationType: RelationType,
  displayName: string,
) {
  return apiFetch<TableRelationDto>(`/api/tables/${encodeURIComponent(tableId)}/relations`, {
    method: "POST",
    body: JSON.stringify({ toTableId, relationType, displayName }),
  });
}

export async function deleteRelation(relationId: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const headers = await withAdminSessionHeader();
    const res = await fetch(`${apiBaseUrl}/api/relations/${encodeURIComponent(relationId)}`, {
      method: "DELETE",
      cache: "no-store",
      headers,
      signal: controller.signal,
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
