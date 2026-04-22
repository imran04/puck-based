import type { ComponentData } from "@puckeditor/core";

export type ReusableBlockKind = "section" | "form";

export type ReusableBlock = {
  id: string;
  name: string;
  kind: ReusableBlockKind;
  componentType: string;
  data: ComponentData;
  createdAt: string;
  updatedAt: string;
};

export type ReusableBlockInput = {
  name: string;
  kind: ReusableBlockKind;
  componentType: string;
  data: ComponentData;
};

export function isReusableBlockKind(value: string | null): value is ReusableBlockKind {
  return value === "section" || value === "form";
}

