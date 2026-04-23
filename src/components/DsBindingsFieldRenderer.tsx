"use client";

import { usePuck } from "@puckeditor/core";
import { DsBindingsEditor } from "@/components/DataSourcePanel";
import { getDisplaySourcesFromRootProps } from "@/lib/datasource-roots";
import type { DsBindings } from "@/lib/datasource-template";

type DsBindingsFieldRendererProps = {
  bindableFields: string[];
  value?: DsBindings;
  onChange: (value: DsBindings) => void;
};

export function DsBindingsFieldRenderer({
  bindableFields,
  value,
  onChange,
}: DsBindingsFieldRendererProps) {
  const { appState } = usePuck();
  const rootProps = (appState.data.root as { props?: Record<string, unknown> }).props ?? {};
  const dataSources = getDisplaySourcesFromRootProps(rootProps as Record<string, unknown>);

  return (
    <DsBindingsEditor
      bindableFields={bindableFields}
      dataSources={dataSources}
      onChange={onChange}
      value={value ?? {}}
    />
  );
}
