import type { DataSourceDefinition } from "@/lib/datasource-template";

type RootProps = Record<string, unknown>;

function toSources(value: unknown): DataSourceDefinition[] {
  return Array.isArray(value) ? (value as DataSourceDefinition[]) : [];
}

function hasOwn(rootProps: RootProps, key: string) {
  return Object.prototype.hasOwnProperty.call(rootProps, key);
}

export function getDisplaySourcesFromRootProps(rootProps: RootProps): DataSourceDefinition[] {
  if (hasOwn(rootProps, "displaySources")) {
    return toSources(rootProps.displaySources);
  }

  return toSources(rootProps.dataSources);
}
