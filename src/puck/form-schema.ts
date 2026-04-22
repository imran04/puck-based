export type FormFieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "file"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "checkboxGroup"
  | "hidden"
  | "heading"
  | "paragraph"
  | "divider";

export type FormLayout = "stacked" | "two" | "three";
export type FormWidth = "narrow" | "standard" | "wide" | "full";
export type FormSurface = "plain" | "card" | "soft" | "dark";
export type FormControlStyle = "outline" | "filled" | "underline";
export type FormDensity = "compact" | "comfortable" | "spacious";
export type FormSubmitAlign = "left" | "center" | "right";
export type FormSubmitWidth = "auto" | "full";
export type FormFieldWidth = "auto" | "full" | "half" | "third" | "twoThirds";

export type FormField = {
  label: string;
  name: string;
  type: FormFieldType;
  placeholder?: string;
  required?: boolean;
  options?: string;
  helpText?: string;
  defaultValue?: string;
  width?: FormFieldWidth;
  rows?: number;
};

export type FormBlockProps = {
  title: string;
  description?: string;
  actionUrl?: string;
  submitLabel: string;
  successMessage?: string;
  layout?: FormLayout;
  width?: FormWidth;
  surface?: FormSurface;
  controlStyle?: FormControlStyle;
  density?: FormDensity;
  submitAlign?: FormSubmitAlign;
  submitWidth?: FormSubmitWidth;
  fields: FormField[];
};

export const defaultFormProps: Omit<FormBlockProps, "fields"> = {
  title: "Lead capture",
  description: "A Puck-native form block with first-party JSON and exportable markup.",
  actionUrl: "/api/forms/submit",
  submitLabel: "Send request",
  successMessage: "Thanks. We received your request.",
  layout: "two",
  width: "wide",
  surface: "card",
  controlStyle: "outline",
  density: "comfortable",
  submitAlign: "left",
  submitWidth: "auto",
};

export function normalizeName(label: string, fallback: string) {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || fallback
  );
}

export function parseOptions(options?: string) {
  return (options || "")
    .split(/\r?\n|,/)
    .map((option) => option.trim())
    .filter(Boolean);
}

export function isLayoutOnlyField(type: FormFieldType) {
  return type === "heading" || type === "paragraph" || type === "divider";
}

export function isNamedField(type: FormFieldType) {
  return !isLayoutOnlyField(type);
}

export function formClassName(props: Partial<FormBlockProps>) {
  const surface = props.surface || defaultFormProps.surface;
  const width = props.width || defaultFormProps.width;
  const density = props.density || defaultFormProps.density;
  const controlStyle = props.controlStyle || defaultFormProps.controlStyle;

  return [
    "pb-form",
    `pb-form--${surface}`,
    `pb-form--width-${width}`,
    `pb-form--density-${density}`,
    `pb-form--controls-${controlStyle}`,
  ].join(" ");
}

export function fieldsClassName(props: Partial<FormBlockProps>) {
  return `pb-form__fields pb-form__fields--${props.layout || defaultFormProps.layout}`;
}

export function footerClassName(props: Partial<FormBlockProps>) {
  return [
    "pb-form__footer",
    `pb-form__footer--${props.submitAlign || defaultFormProps.submitAlign}`,
    props.submitWidth === "full" ? "pb-form__footer--full" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function fieldWidthClassName(field: FormField, layout?: FormLayout) {
  if (field.type === "hidden") {
    return "";
  }

  const explicit = field.width || "auto";
  const width =
    explicit !== "auto"
      ? explicit
      : isLayoutOnlyField(field.type)
        ? "full"
        : layout === "three"
          ? "third"
          : layout === "two"
            ? "half"
            : "full";

  return `pb-field--${width}`;
}

export function fieldClassName(field: FormField, layout?: FormLayout) {
  return ["pb-field", fieldWidthClassName(field, layout)].filter(Boolean).join(" ");
}
