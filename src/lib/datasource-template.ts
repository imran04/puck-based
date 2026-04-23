/**
 * Generates:
 *  1. A Razor CSHTML template (stored as a human-readable artifact)
 *  2. A C# PageRenderer class source (compiled to assembly bytes by the API)
 *
 * The approach uses a template string with {DS:source.field},
 * {DS_PIPE:source|field|pipes},
 * {DS_AT:source|index|field},
 * {DS_AT_PIPE:source|index|field|pipes} and
 * {DS_LIST_START:source}...{DS_ITEM:field}...{DS_LIST_END} markers.
 * The C# renderer resolves these at runtime using regexes.
 */

import type { Data } from "@puckeditor/core";
import {
  defaultFormProps,
  fieldClassName,
  fieldsClassName,
  footerClassName,
  formClassName,
  normalizeName,
  parseOptions,
  type FormBlockProps,
  type FormField,
  type FormLayout,
  type SelectOptionSource,
} from "@/puck/form-schema";
import { resolveMediaSource, safeMediaUrl } from "@/lib/url";

export type DataSourceFilter = {
  field: string;
  op: "eq" | "neq" | "contains" | "gt" | "lt";
  value: string;
};

export type DataSourceDefinition = {
  id: string;
  name: string;
  tableId: string;
  tableName: string;
  queryType: "single" | "list";
  filters: DataSourceFilter[];
  orderBy?: string;
  orderDir?: "asc" | "desc";
  limit?: number;
};

export type DsBinding = {
  source: string;
  field: string;
};

export type DsBindings = Record<string, DsBinding>;

export type ConditionOperator =
  | "eq"
  | "neq"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "gt"
  | "lt";

export type ConditionalRule = {
  source: string;
  field: string;
  operator: ConditionOperator;
  value: string;
  predicate: string;
};

// ── HTML marker helpers ────────────────────────────────────────────────────

/** Returns a datasource marker for a single-record field binding */
function dsMarker(source: string, field: string): string {
  return `{DS:${source}.${field}}`;
}

type MergePipeOperation = {
  name: string;
  args: string[];
};

/** Returns a datasource marker for a single-record field binding with pipes */
function dsPipedMarker(source: string, field: string, encodedPipes: string): string {
  return `{DS_PIPE:${sanitizeMarkerPart(source)}|${sanitizeMarkerPart(field)}|${sanitizeMarkerPart(encodedPipes)}}`;
}

/** Returns a datasource marker for a list-record field binding */
function dsIndexedMarker(source: string, index: string, field: string): string {
  return `{DS_AT:${sanitizeMarkerPart(source)}|${sanitizeMarkerPart(index)}|${sanitizeMarkerPart(field)}}`;
}

/** Returns a datasource marker for a list-record field binding with pipes */
function dsIndexedPipedMarker(
  source: string,
  index: string,
  field: string,
  encodedPipes: string,
): string {
  return `{DS_AT_PIPE:${sanitizeMarkerPart(source)}|${sanitizeMarkerPart(index)}|${sanitizeMarkerPart(field)}|${sanitizeMarkerPart(encodedPipes)}}`;
}

/** Returns the fallback or the marker if a binding exists */
function bindOrFallback(bindings: DsBindings | undefined, propName: string, fallback: string): string {
  const b = bindings?.[propName];
  return b ? dsMarker(b.source, b.field) : fallback;
}

// ── Component HTML with marker substitution ────────────────────────────────

type PuckItem = { type: string; props?: Record<string, unknown> };

type RenderContext = {
  pageId: string;
  pageSlug: string;
};

const defaultRenderContext: RenderContext = {
  pageId: "",
  pageSlug: "",
};

function escHtml(v: string): string {
  return String(v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textLines(value: unknown): string[] {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function sanitizePredicateMarker(value: string) {
  return String(value || "")
    .replace(/[{}]/g, "")
    .replace(/\r?\n/g, " ")
    .trim();
}

function sanitizeMarkerPart(value: string) {
  return String(value || "")
    .replace(/[{}|]/g, "")
    .replace(/\r?\n/g, " ")
    .trim();
}

const mergeTokenPattern = /\{\{\s*([^{}]+?)\s*\}\}/g;
const sourceOnlyPattern = /^([A-Za-z_][A-Za-z0-9_-]*)$/;
const indexedSourceOnlyPattern = /^([A-Za-z_][A-Za-z0-9_-]*)\[(\d+|[A-Za-z_][A-Za-z0-9_]*)\]$/;
const singleSourcePathPattern = /^([A-Za-z_][A-Za-z0-9_-]*)\.([A-Za-z_][A-Za-z0-9_.-]*)$/;
const indexedSourcePathPattern =
  /^([A-Za-z_][A-Za-z0-9_-]*)\[(\d+|[A-Za-z_][A-Za-z0-9_]*)\]\.([A-Za-z_][A-Za-z0-9_.-]*)$/;

function splitUnquoted(value: string, delimiter: string) {
  const parts: string[] = [];
  let current = "";
  let quote: "'" | '"' | "" = "";

  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    const prev = i > 0 ? value[i - 1] : "";

    if (quote) {
      current += ch;
      if (ch === quote && prev !== "\\") {
        quote = "";
      }
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === delimiter) {
      parts.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  parts.push(current);
  return parts;
}

function unquote(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parsePipeOperations(pipeSegments: string[]): MergePipeOperation[] {
  const operations: MergePipeOperation[] = [];

  for (const segment of pipeSegments) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }

    const parts = splitUnquoted(trimmed, ":").map((part) => part.trim());
    const name = (parts[0] || "").toLowerCase();
    if (!name) {
      continue;
    }

    const args = parts.slice(1).map(unquote);
    operations.push({ name, args });
  }

  return operations;
}

function parseMergeExpression(expression: string) {
  const parts = splitUnquoted(expression, "|");
  const pathExpression = (parts[0] || "").trim();
  const pipeOps = parsePipeOperations(parts.slice(1));
  return { pathExpression, pipeOps };
}

function encodePipeOperations(ops: MergePipeOperation[]) {
  const base64 = Buffer.from(JSON.stringify(ops), "utf-8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function findSourceByName(
  dataSources: DataSourceDefinition[],
  name: string,
): DataSourceDefinition | undefined {
  const exact = dataSources.find((source) => source.name === name);
  if (exact) {
    return exact;
  }

  return dataSources.find((source) => source.name.toLowerCase() === name.toLowerCase());
}

function convertMergeTagsToDataSourceMarkers(
  html: string,
  dataSources: DataSourceDefinition[],
): string {
  if (!html.includes("{{") || dataSources.length === 0) {
    return html;
  }

  return html.replace(mergeTokenPattern, (token, rawExpression) => {
    const expression = String(rawExpression || "").trim();
    const { pathExpression, pipeOps } = parseMergeExpression(expression);
    const encodedPipes = pipeOps.length > 0 ? encodePipeOperations(pipeOps) : "";

    const indexedMatch = pathExpression.match(indexedSourcePathPattern);
    if (indexedMatch) {
      const [, sourceName, indexToken, fieldName] = indexedMatch;
      const source = findSourceByName(dataSources, sourceName);
      if (!source || source.queryType !== "list") {
        return token;
      }

      return encodedPipes
        ? dsIndexedPipedMarker(source.name, indexToken, fieldName, encodedPipes)
        : dsIndexedMarker(source.name, indexToken, fieldName);
    }

    const indexedSourceOnlyMatch = pathExpression.match(indexedSourceOnlyPattern);
    if (indexedSourceOnlyMatch) {
      const [, sourceName, indexToken] = indexedSourceOnlyMatch;
      const source = findSourceByName(dataSources, sourceName);
      if (!source || source.queryType !== "list" || !encodedPipes) {
        return token;
      }

      return dsIndexedPipedMarker(source.name, indexToken, "*", encodedPipes);
    }

    const singleMatch = pathExpression.match(singleSourcePathPattern);
    if (singleMatch) {
      const [, sourceName, fieldName] = singleMatch;
      const source = findSourceByName(dataSources, sourceName);
      if (!source || source.queryType !== "single") {
        return token;
      }

      return encodedPipes
        ? dsPipedMarker(source.name, fieldName, encodedPipes)
        : dsMarker(source.name, fieldName);
    }

    const sourceOnlyMatch = pathExpression.match(sourceOnlyPattern);
    if (sourceOnlyMatch) {
      const [, sourceName] = sourceOnlyMatch;
      const source = findSourceByName(dataSources, sourceName);
      if (!source || !encodedPipes) {
        return token;
      }

      return dsPipedMarker(source.name, "*", encodedPipes);
    }

    return token;
  });
}

function sanitizeCsharpIdentifier(value: string) {
  const normalized = String(value || "").replace(/[^A-Za-z0-9_]/g, "_");
  if (!normalized) {
    return "pb";
  }

  return /^[0-9]/.test(normalized) ? `_${normalized}` : normalized;
}

function toCsharpIndexExpression(value: string) {
  const token = String(value || "").trim();

  if (/^\d+$/.test(token)) {
    return token;
  }

  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
    return token;
  }

  return "index";
}

function dsOptionsMarker(
  source: string,
  valueField: string,
  labelField: string,
  selected: string,
) {
  return `{DS_OPTIONS:${sanitizeMarkerPart(source)}|${sanitizeMarkerPart(valueField)}|${sanitizeMarkerPart(labelField)}|${sanitizeMarkerPart(selected)}}`;
}

function renderFormHelp(field: FormField, id: string) {
  return field.helpText
    ? `<span class="pb-help" id="${id}">${escHtml(field.helpText)}</span>`
    : "";
}

function renderLayoutFormField(field: FormField, index: number, layout?: FormLayout) {
  const className = fieldClassName(field, layout);

  if (field.type === "heading") {
    return `<div class="${className} pb-form-copy">
  <h3>${escHtml(field.label || "Section heading")}</h3>
  ${field.helpText ? `<p>${escHtml(field.helpText)}</p>` : ""}
</div>`;
  }

  if (field.type === "paragraph") {
    return `<div class="${className} pb-form-copy">
  <p>${escHtml(field.label || field.helpText || "")}</p>
</div>`;
  }

  if (field.type === "divider") {
    return `<hr class="${className} pb-divider" />`;
  }

  return "";
}

function renderChoiceOptions(
  field: FormField,
  name: string,
  id: string,
  inputType: "radio" | "checkbox",
  required: boolean,
) {
  const selected = parseOptions(field.defaultValue);

  return `<div class="pb-choice-list">
    ${parseOptions(field.options)
      .map((option, optionIndex) => {
        const optionId = `${id}_${optionIndex}`;
        const checked = selected.includes(option) ? " checked" : "";
        const requiredAttr = inputType === "radio" && required ? " required" : "";
        const inputName = inputType === "checkbox" ? `${name}[]` : name;

        return `<label class="pb-choice" for="${optionId}">
  <input id="${optionId}" name="${escHtml(inputName)}" type="${inputType}" value="${escHtml(option)}"${checked}${requiredAttr} />
  <span>${escHtml(option)}</span>
</label>`;
      })
      .join("")}
  </div>`;
}

function isCompleteOptionSource(source?: SelectOptionSource): source is SelectOptionSource {
  return Boolean(source?.source && source.tableId && source.valueField && source.labelField);
}

function renderStaticSelectOptions(field: FormField) {
  return parseOptions(field.options)
    .map((option) => {
      const selected = option === field.defaultValue ? " selected" : "";
      return `<option value="${escHtml(option)}"${selected}>${escHtml(option)}</option>`;
    })
    .join("");
}

function renderSelectDataAttributes(
  field: FormField,
  name: string,
  formId: string,
  context: RenderContext,
) {
  const source = field.optionSource;

  if (!isCompleteOptionSource(source)) {
    return "";
  }

  const attrs = [
    ` data-pb-option-source="${escHtml(source.source)}"`,
    ` data-pb-field-name="${escHtml(name)}"`,
    ` data-pb-form-id="${escHtml(formId)}"`,
    ` data-pb-page-id="${escHtml(context.pageId)}"`,
  ];

  if (source.cascade?.parentField && source.cascade.parentValueColumn) {
    attrs.push(` data-pb-cascade-parent="${escHtml(source.cascade.parentField)}"`);
    attrs.push(` data-pb-cascade-column="${escHtml(source.cascade.parentValueColumn)}"`);
  }

  return attrs.join("");
}

function renderRuntimeSelectOptions(field: FormField) {
  const source = field.optionSource;

  if (!isCompleteOptionSource(source)) {
    return renderStaticSelectOptions(field);
  }

  if (source.cascade?.parentField && source.cascade.parentValueColumn) {
    return "";
  }

  return dsOptionsMarker(
    source.source,
    source.valueField,
    source.labelField,
    field.defaultValue || "",
  );
}

function renderRuntimeFormField(
  field: FormField,
  index: number,
  layout: FormLayout | undefined,
  formId: string,
  context: RenderContext,
) {
  const layoutField = renderLayoutFormField(field, index, layout);

  if (layoutField) {
    return layoutField;
  }

  const label = escHtml(String(field.label || `Field ${index + 1}`));
  const name = normalizeName(field.name || field.label, `field_${index + 1}`);
  const id = `${formId}_${name}_${index}`;
  const required = field.required ? " required" : "";
  const descriptionId = field.helpText ? `${id}_help` : "";
  const placeholder = field.placeholder
    ? ` placeholder="${escHtml(String(field.placeholder))}"`
    : "";
  const describedBy = descriptionId ? ` aria-describedby="${descriptionId}"` : "";
  const defaultValue = field.defaultValue
    ? ` value="${escHtml(String(field.defaultValue))}"`
    : "";
  const className = fieldClassName(field, layout);

  if (field.type === "hidden") {
    return `<input name="${escHtml(name)}" type="hidden"${defaultValue} />`;
  }

  if (field.type === "textarea") {
    return `<label class="${className}" for="${id}">
  <span class="pb-label">${label}${required ? " *" : ""}</span>
  <textarea class="pb-textarea" id="${id}" name="${escHtml(name)}" rows="${field.rows || 4}"${placeholder}${required}${describedBy}>${escHtml(field.defaultValue || "")}</textarea>
  ${renderFormHelp(field, descriptionId)}
</label>`;
  }

  if (field.type === "select") {
    const source = field.optionSource;
    const hasCascade = Boolean(source?.cascade?.parentField && source.cascade.parentValueColumn);
    const disabled = hasCascade ? " disabled" : "";
    const dataAttrs = renderSelectDataAttributes(field, name, formId, context);
    const options = renderRuntimeSelectOptions(field);

    return `<label class="${className}" for="${id}">
  <span class="pb-label">${label}${required ? " *" : ""}</span>
  <select class="pb-select" id="${id}" name="${escHtml(name)}"${required}${describedBy}${dataAttrs}${disabled}>
    <option value="">${escHtml(String(field.placeholder || "Select an option"))}</option>
    ${options}
  </select>
  ${renderFormHelp(field, descriptionId)}
</label>`;
  }

  if (field.type === "radio" || field.type === "checkboxGroup") {
    const inputType = field.type === "radio" ? "radio" : "checkbox";

    return `<fieldset class="${className} pb-choice-field"${describedBy}>
  <legend class="pb-label">${label}${required ? " *" : ""}</legend>
  ${renderChoiceOptions(field, name, id, inputType, Boolean(field.required))}
  ${renderFormHelp(field, descriptionId)}
</fieldset>`;
  }

  if (field.type === "checkbox") {
    const checked = field.defaultValue === "true" ? " checked" : "";

    return `<label class="${className} pb-checkbox-row">
  <input id="${id}" name="${escHtml(name)}" type="checkbox" value="true"${required}${checked} />
  <span>${label}${required ? " *" : ""}${field.helpText ? `<small>${escHtml(field.helpText)}</small>` : ""}</span>
</label>`;
  }

  const inputType = ["email", "tel", "number", "date", "file"].includes(String(field.type))
    ? String(field.type)
    : "text";
  const value = inputType === "file" ? "" : defaultValue;

  return `<label class="${className}" for="${id}">
  <span class="pb-label">${label}${required ? " *" : ""}</span>
  <input class="pb-input" id="${id}" name="${escHtml(name)}" type="${inputType}"${placeholder}${required}${describedBy}${value} />
  ${renderFormHelp(field, descriptionId)}
</label>`;
}

function runtimeFormScript() {
  return `<script>
(function(){
  function loadOptions(select, parentValue){
    var pageId = select.getAttribute("data-pb-page-id") || "";
    var formId = select.getAttribute("data-pb-form-id") || "";
    var fieldName = select.getAttribute("data-pb-field-name") || select.name || "";
    var placeholder = select.querySelector("option") ? select.querySelector("option").textContent : "Select an option";
    if (!pageId || !formId || !fieldName || !parentValue) {
      select.innerHTML = '<option value="">' + placeholder + '</option>';
      select.disabled = true;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    var url = "/api/forms/options?pageId=" + encodeURIComponent(pageId) +
      "&formId=" + encodeURIComponent(formId) +
      "&fieldName=" + encodeURIComponent(fieldName) +
      "&parentValue=" + encodeURIComponent(parentValue);
    fetch(url, { headers: { "Accept": "application/json" } })
      .then(function(response){ return response.ok ? response.json() : { options: [] }; })
      .then(function(payload){
        var options = Array.isArray(payload.options) ? payload.options : [];
        select.innerHTML = '<option value="">' + placeholder + '</option>' + options.map(function(option){
          var value = option && option.value != null ? String(option.value) : "";
          var label = option && option.label != null ? String(option.label) : value;
          return '<option value="' + value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;") + '">' +
            label.replace(/&/g, "&amp;").replace(/</g, "&lt;") + '</option>';
        }).join("");
        select.disabled = options.length === 0;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      })
      .catch(function(){
        select.innerHTML = '<option value="">' + placeholder + '</option>';
        select.disabled = true;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
  }

  document.querySelectorAll("select[data-pb-cascade-parent]").forEach(function(select){
    var form = select.closest("form");
    var parentName = select.getAttribute("data-pb-cascade-parent");
    var parent = form && parentName ? form.querySelector('[name="' + CSS.escape(parentName) + '"]') : null;
    if (!parent) return;
    parent.addEventListener("change", function(){ loadOptions(select, parent.value); });
    if (parent.value) loadOptions(select, parent.value);
  });
})();
</script>`;
}

function renderItemWithMarkers(
  item: PuckItem,
  context: RenderContext = defaultRenderContext,
): string {
  const props = item.props ?? {};
  const bindings = props._dsBindings as DsBindings | undefined;

  switch (item.type) {
    case "Hero": {
      const title   = bindOrFallback(bindings, "title",   escHtml(String(props.title || "")));
      const body    = bindOrFallback(bindings, "body",    escHtml(String(props.body || "")));
      const eyebrow = bindOrFallback(bindings, "eyebrow", escHtml(String(props.eyebrow || "")));
      const tone = props.tone === "dark" ? "pb-hero pb-hero--dark" : "pb-hero";
      return `<section class="${tone}"><div class="pb-container pb-hero__grid"><div>${eyebrow ? `<p class="pb-eyebrow">${eyebrow}</p>` : ""}<h1 class="pb-title">${title}</h1>${body ? `<p class="pb-copy">${body}</p>` : ""}</div><div aria-hidden="true" class="pb-visual"></div></div></section>`;
    }

    case "Heading": {
      const text = bindOrFallback(bindings, "text", escHtml(String(props.text || "")));
      const tag = props.level === "h3" ? "h3" : "h2";
      return `<${tag} class="pb-heading">${text}</${tag}>`;
    }

    case "RichText": {
      const text = bindOrFallback(bindings, "text", String(props.text || ""));
      return `<div class="pb-rich-text">${text}</div>`;
    }

    case "FeatureCard": {
      const title = bindOrFallback(bindings, "title", escHtml(String(props.title || "")));
      const body  = bindOrFallback(bindings, "body",  escHtml(String(props.body || "")));
      return `<article class="pb-card"><h3 class="pb-card__title">${title}</h3><p class="pb-card__body">${body}</p></article>`;
    }

    case "QuoteBlock": {
      const quote  = bindOrFallback(bindings, "quote",  escHtml(String(props.quote || "")));
      const author = bindOrFallback(bindings, "author", escHtml(String(props.author || "")));
      const role   = bindOrFallback(bindings, "role",   escHtml(String(props.role || "")));
      return `<figure class="pb-quote"><blockquote>${quote}</blockquote><figcaption>${author ? `<strong>${author}</strong>` : ""}${role ? `<span>${role}</span>` : ""}</figcaption></figure>`;
    }

    case "Callout": {
      const title = bindOrFallback(bindings, "title", escHtml(String(props.title || "")));
      const body  = bindOrFallback(bindings, "body",  escHtml(String(props.body || "")));
      const tone  = String(props.tone || "info");
      return `<aside class="pb-callout pb-callout--${escHtml(tone)}"><strong>${title}</strong><p>${body}</p></aside>`;
    }

    case "DynamicList": {
      // List iteration component
      const source   = String(props.source || "");
      const layout   = String(props.layout || "cards");
      const titleFld = String(props.titleField || "title");
      const bodyFld  = String(props.bodyField || "body");
      const urlFld   = String(props.urlField || "");

      if (!source) return `<div class="pb-empty-state">Configure a datasource for this list.</div>`;

      const itemHtml = layout === "table"
        ? `<tr><td>{DS_ITEM:${titleFld}}</td><td>{DS_ITEM:${bodyFld}}</td></tr>`
        : `<article class="pb-card"><h3 class="pb-card__title">{DS_ITEM:${titleFld}}</h3><p class="pb-card__body">{DS_ITEM:${bodyFld}}</p>${urlFld ? `<a href="{DS_ITEM:${urlFld}}" class="pb-button pb-button--secondary">View</a>` : ""}</article>`;

      const wrapper = layout === "table"
        ? `<div class="pb-table-wrap"><table class="pb-table"><tbody>{DS_LIST_START:${source}}${itemHtml}{DS_LIST_END}</tbody></table></div>`
        : `<div class="pb-card-grid">{DS_LIST_START:${source}}${itemHtml}{DS_LIST_END}</div>`;

      return wrapper;
    }

    case "ConditionalSwitch": {
      const condition = (props.condition as Partial<ConditionalRule> | undefined) ?? {};
      const source = String(condition.source || "");
      const predicate = sanitizePredicateMarker(String(condition.predicate || ""));
      const whenTrue = renderItemsWithMarkers((props.whenTrue as PuckItem[]) ?? [], context);
      const whenFalse = renderItemsWithMarkers((props.whenFalse as PuckItem[]) ?? [], context);

      if (!source || !predicate) {
        return `<div class="pb-empty-state">Configure datasource and predicate for this conditional block.</div>`;
      }

      return `<section class="pb-conditional">{DS_IF:${source}|${predicate}}${whenTrue}{DS_ELSE}${whenFalse}{DS_ENDIF}</section>`;
    }

    case "Section": {
      const inner = renderItemsWithMarkers((props.content as PuckItem[]) ?? [], context);
      const tone = String(props.tone || "white");
      const padding = String(props.padding || "normal");
      const cls = ["pb-section", tone === "soft" ? "pb-section--soft" : "", tone === "dark" ? "pb-section--dark" : "", `pb-section--${padding}`].filter(Boolean).join(" ");
      return `<section class="${cls}"><div class="pb-container pb-stack">${inner}</div></section>`;
    }

    case "Container": {
      const inner = renderItemsWithMarkers((props.content as PuckItem[]) ?? [], context);
      return `<div class="pb-container">${inner}</div>`;
    }

    case "Stack": {
      const inner = renderItemsWithMarkers((props.content as PuckItem[]) ?? [], context);
      return `<div class="pb-stack-layout pb-stack-layout--${escHtml(String(props.gap || "medium"))}">${inner}</div>`;
    }

    case "Columns": {
      const cols = Number(props.columns || "2");
      const slots = ([props.first, props.second, props.third, props.fourth] as PuckItem[][]).slice(0, cols);
      const inner = slots.map(s => `<div class="pb-column">${renderItemsWithMarkers(s ?? [], context)}</div>`).join("");
      return `<div class="pb-columns-layout pb-columns-layout--${cols}">${inner}</div>`;
    }

    case "Grid": {
      const inner = renderItemsWithMarkers((props.content as PuckItem[]) ?? [], context);
      return `<div class="pb-grid-layout pb-grid-layout--${escHtml(String(props.columns || "3"))}">${inner}</div>`;
    }

    case "Box": {
      const inner = renderItemsWithMarkers((props.content as PuckItem[]) ?? [], context);
      return `<div class="pb-box pb-box--${escHtml(String(props.surface || "card"))}">${inner}</div>`;
    }

    case "TwoColumn": {
      const left  = renderItemsWithMarkers((props.left as PuckItem[]) ?? [], context);
      const right = renderItemsWithMarkers((props.right as PuckItem[]) ?? [], context);
      return `<div class="pb-columns"><div>${left}</div><div>${right}</div></div>`;
    }

    case "SplitSection": {
      const content = renderItemsWithMarkers((props.content as PuckItem[]) ?? [], context);
      const media   = renderItemsWithMarkers((props.media as PuckItem[]) ?? [], context);
      return `<section class="pb-section"><div class="pb-container pb-split"><div class="pb-split__content">${content}</div><div class="pb-split__media">${media}</div></div></section>`;
    }

    case "Spacer":
      return `<div aria-hidden="true" class="pb-spacer pb-spacer--${escHtml(String(props.size || "medium"))}"></div>`;

    case "Divider":
      return `<hr class="pb-section-divider pb-section-divider--${escHtml(String(props.tone || "light"))}" />`;

    case "ButtonLink": {
      const label = bindOrFallback(bindings, "label", escHtml(String(props.label || "Continue")));
      const href  = bindOrFallback(bindings, "href",  escHtml(String(props.href || "#")));
      const cls   = props.variant === "secondary" ? "pb-button pb-button--secondary" : "pb-button";
      return `<a class="${cls}" href="${href}">${label}</a>`;
    }

    case "ImageBlock": {
      const src = resolveMediaSource({
        assetId: String(props.assetId || ""),
        src: String(props.src || ""),
      });
      return `<figure class="pb-image pb-image--${escHtml(String(props.aspect || "wide"))}">
  ${
    src
      ? `<img alt="${escHtml(String(props.alt || "Image"))}" src="${escHtml(src)}" />`
      : `<div class="pb-media-placeholder">Image</div>`
  }
  ${props.caption ? `<figcaption>${escHtml(String(props.caption))}</figcaption>` : ""}
</figure>`;
    }

    case "VideoEmbed": {
      const url = safeMediaUrl(String(props.url || ""));
      return `<figure class="pb-video">
  <div class="pb-video__frame">
    ${
      url
        ? `<iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen src="${escHtml(url)}" title="${escHtml(String(props.title || "Video"))}"></iframe>`
        : `<div class="pb-media-placeholder">Video</div>`
    }
  </div>
  ${props.caption ? `<figcaption>${escHtml(String(props.caption))}</figcaption>` : ""}
</figure>`;
    }

    case "Gallery": {
      const images = [props.imageOne, props.imageTwo, props.imageThree, props.imageFour].map(
        (source) => safeMediaUrl(String(source || "")),
      );
      return `<figure class="pb-gallery">
  <div class="pb-gallery__grid">
    ${images
      .map((source, index) =>
        source
          ? `<img alt="Gallery image ${index + 1}" src="${escHtml(source)}" />`
          : `<div class="pb-media-placeholder">Image ${index + 1}</div>`,
      )
      .join("")}
  </div>
  ${props.caption ? `<figcaption>${escHtml(String(props.caption))}</figcaption>` : ""}
</figure>`;
    }

    case "Testimonial": {
      const quote = bindOrFallback(bindings, "quote", escHtml(String(props.quote || "")));
      const name  = bindOrFallback(bindings, "name",  escHtml(String(props.name || "")));
      const role  = bindOrFallback(bindings, "role",  escHtml(String(props.role || "")));
      const avatar = safeMediaUrl(String(props.avatarUrl || ""));
      return `<article class="pb-testimonial">
  <p>${quote}</p>
  <div class="pb-testimonial__person">
    ${
      avatar
        ? `<img alt="" src="${escHtml(avatar)}" />`
        : `<span aria-hidden="true">${escHtml(String(props.name || "T").slice(0, 1).toUpperCase())}</span>`
    }
    <div><strong>${name}</strong><small>${role}</small></div>
  </div>
</article>`;
    }

    case "Stats": {
      const stats = [
        [props.statOneValue, props.statOneLabel],
        [props.statTwoValue, props.statTwoLabel],
        [props.statThreeValue, props.statThreeLabel],
      ];
      return `<div class="pb-stats">
  ${stats
    .map(
      ([value, label]) => `<div class="pb-stat"><strong>${escHtml(String(value || ""))}</strong><span>${escHtml(String(label || ""))}</span></div>`,
    )
    .join("")}
</div>`;
    }

    case "Faq": {
      const faqs = [
        [props.questionOne, props.answerOne],
        [props.questionTwo, props.answerTwo],
        [props.questionThree, props.answerThree],
      ];
      return `<div class="pb-faq">
  ${faqs
    .map(
      ([question, answer], index) => `<details${index === 0 ? " open" : ""}><summary>${escHtml(String(question || ""))}</summary><p>${escHtml(String(answer || ""))}</p></details>`,
    )
    .join("")}
</div>`;
    }

    case "TextList": {
      const tag = props.style === "numbers" ? "ol" : "ul";
      return `<div class="pb-text-list pb-text-list--${escHtml(String(props.style || "bullets"))}">
  ${props.title ? `<h3>${escHtml(String(props.title))}</h3>` : ""}
  <${tag}>${textLines(props.items).map((line) => `<li>${escHtml(line)}</li>`).join("")}</${tag}>
</div>`;
    }

    case "LogoStrip": {
      return `<div class="pb-logo-strip">
  ${props.title ? `<p>${escHtml(String(props.title))}</p>` : ""}
  <div>${textLines(props.logos).map((line) => `<span>${escHtml(line)}</span>`).join("")}</div>
</div>`;
    }

    case "TableBlock": {
      const rows = textLines(props.rows).map((row) => row.split("|").map((cell) => cell.trim()));
      const [header, ...body] = rows;
      return `<div class="pb-table-wrap">
  <table class="pb-table">
    ${props.caption ? `<caption>${escHtml(String(props.caption))}</caption>` : ""}
    ${
      header
        ? `<thead><tr>${header.map((cell) => `<th>${escHtml(cell)}</th>`).join("")}</tr></thead>`
        : ""
    }
    <tbody>
      ${body
        .map((row) => `<tr>${row.map((cell) => `<td>${escHtml(cell)}</td>`).join("")}</tr>`)
        .join("")}
    </tbody>
  </table>
</div>`;
    }

    case "CodeBlock":
      return `<figure class="pb-code"><figcaption>${escHtml(String(props.language || ""))}</figcaption><pre><code>${escHtml(String(props.code || ""))}</code></pre></figure>`;

    case "EmbedBlock": {
      const url = safeMediaUrl(String(props.url || ""));
      const height = Number(props.height) || 420;
      return `<div class="pb-embed" style="--pb-embed-height:${escHtml(String(height))}px;">
  ${url ? `<iframe src="${escHtml(url)}" title="${escHtml(String(props.title || "Embed"))}"></iframe>` : `<div class="pb-media-placeholder">Embed</div>`}
</div>`;
    }

    case "SavedSection":
    case "SavedForm": {
      const block = props.block as { data?: unknown } | undefined;
      if (block?.data && typeof block.data === "object" && "type" in (block.data as Record<string, unknown>)) {
        return renderItemWithMarkers(block.data as PuckItem, context);
      }
      return `<div class="pb-empty-state">Choose a saved item from the library.</div>`;
    }

    case "FormBlock": {
      const fields = Array.isArray(props.fields)
        ? (props.fields as FormField[])
        : [];
      const formProps = {
        ...defaultFormProps,
        ...props,
        fields,
      } as FormBlockProps;
      const formId = normalizeName(
        String(props.formId || props.id || formProps.title || "form"),
        "form",
      );

      return `<form action="/api/forms/runtime-submit" class="${formClassName(formProps)}" method="post" enctype="multipart/form-data">
  <input name="_pbPageId" type="hidden" value="${escHtml(context.pageId)}" />
  <input name="_pbPageSlug" type="hidden" value="${escHtml(context.pageSlug)}" />
  <input name="_pbFormId" type="hidden" value="${escHtml(formId)}" />
  <input name="_pbFormTitle" type="hidden" value="${escHtml(String(formProps.title || "Form"))}" />
  <div>
    <h2 class="pb-form__title">${escHtml(String(formProps.title || "Form"))}</h2>
    ${
      formProps.description
        ? `<p class="pb-form__description">${escHtml(String(formProps.description))}</p>`
        : ""
    }
  </div>
  <div class="${fieldsClassName(formProps)}">
    ${fields.map((field, index) => renderRuntimeFormField(field, index, formProps.layout, formId, context)).join("")}
  </div>
  <div class="${footerClassName(formProps)}">
    <button class="pb-submit" type="submit">${escHtml(String(formProps.submitLabel || "Submit"))}</button>
  </div>
</form>`;
    }

    default:
      return "";
  }
}

function renderItemsWithMarkers(
  items: PuckItem[],
  context: RenderContext = defaultRenderContext,
): string {
  return items.map((item) => renderItemWithMarkers(item, context)).join("");
}

// ── CSHTML template generator ──────────────────────────────────────────────

function buildCshtml(
  title: string,
  bodyHtml: string,
  css: string,
  dataSources: DataSourceDefinition[],
): string {
  const varDeclarations = dataSources.map(ds =>
    ds.queryType === "single"
      ? `    var ${ds.name} = ViewBag.${ds.name} as IDictionary<string, object?>;`
      : `    var ${ds.name} = (ViewBag.${ds.name} as IEnumerable<IDictionary<string, object?>>) ?? Array.Empty<IDictionary<string, object?>>();`,
  ).join("\n");

  let singleCounter = 0;
  let singlePipeCounter = 0;
  let indexedCounter = 0;
  let indexedPipeCounter = 0;
  let listCounter = 0;
  let listItemCounter = 0;

  // Convert conditional/list/single/indexed datasource markers to CSHTML-friendly syntax.
  const cshtmlBody = bodyHtml
    .replace(/\{DS_IF:([^|}]+)\|([^}]*)\}([\s\S]*?)(?:\{DS_ELSE\}([\s\S]*?))?\{DS_ENDIF\}/g, (_, src, pred, ifHtml, elseHtml) =>
      `@* IF ${src} :: ${pred} *@${ifHtml}${elseHtml ? `@* ELSE *@${elseHtml}` : ""}@* ENDIF *@`)
    .replace(/\{DS_OPTIONS:([^|}]+)\|([^|}]*)\|([^|}]*)\|([^}]*)\}/g, (_, src, valueFld, labelFld) =>
      `@* OPTIONS ${src}.${valueFld}/${labelFld} *@`)
    .replace(/\{DS_PIPE:([^|}]+)\|([^|}]*)\|([^}]*)\}/g, (_, src, fld, encodedPipes) => {
      const markerId = `${sanitizeCsharpIdentifier(src)}_${sanitizeCsharpIdentifier(fld)}_${singlePipeCounter++}`;
      if (fld === "*") {
        return `@(ViewBag.${src} is IDictionary<string,object?> _${markerId} ? (__pbApplyPipes(_${markerId}, "${encodedPipes}")) : "")`;
      }
      return `@(ViewBag.${src} is IDictionary<string,object?> _${markerId} ? (__pbApplyPipes(_${markerId}.TryGetValue("${fld}", out var _v_${markerId}) ? _v_${markerId} : null, "${encodedPipes}")) : "")`;
    })
    .replace(/\{DS:([^.}]+)\.([^}]+)\}/g, (_, src, fld) => {
      const markerId = `${sanitizeCsharpIdentifier(src)}_${sanitizeCsharpIdentifier(fld)}_${singleCounter++}`;
      return `@(ViewBag.${src} is IDictionary<string,object?> _${markerId} ? (_${markerId}.TryGetValue("${fld}", out var _v_${markerId}) ? _v_${markerId}?.ToString() ?? "" : "") : "")`;
    })
    .replace(/\{DS_AT_PIPE:([^|}]+)\|([^|}]*)\|([^|}]*)\|([^}]*)\}/g, (_, src, idx, fld, encodedPipes) => {
      const markerId = `${sanitizeCsharpIdentifier(src)}_${sanitizeCsharpIdentifier(idx)}_${sanitizeCsharpIdentifier(fld)}_${indexedPipeCounter++}`;
      const indexExpression = toCsharpIndexExpression(idx);
      if (fld === "*") {
        return `@((ViewBag.${src} as IEnumerable<IDictionary<string,object?>>)?.ElementAtOrDefault(${indexExpression}) is IDictionary<string,object?> _row_${markerId} ? (__pbApplyPipes(_row_${markerId}, "${encodedPipes}")) : "")`;
      }
      return `@((ViewBag.${src} as IEnumerable<IDictionary<string,object?>>)?.ElementAtOrDefault(${indexExpression}) is IDictionary<string,object?> _row_${markerId} ? (__pbApplyPipes(_row_${markerId}.TryGetValue("${fld}", out var _v_${markerId}) ? _v_${markerId} : null, "${encodedPipes}")) : "")`;
    })
    .replace(/\{DS_AT:([^|}]+)\|([^|}]*)\|([^}]+)\}/g, (_, src, idx, fld) => {
      const markerId = `${sanitizeCsharpIdentifier(src)}_${sanitizeCsharpIdentifier(idx)}_${sanitizeCsharpIdentifier(fld)}_${indexedCounter++}`;
      const indexExpression = toCsharpIndexExpression(idx);
      return `@((ViewBag.${src} as IEnumerable<IDictionary<string,object?>>)?.ElementAtOrDefault(${indexExpression}) is IDictionary<string,object?> _row_${markerId} ? (_row_${markerId}.TryGetValue("${fld}", out var _v_${markerId}) ? _v_${markerId}?.ToString() ?? "" : "") : "")`;
    })
    .replace(/\{DS_LIST_START:([^}]+)\}/g, (_, src) => {
      const listId = listCounter++;
      const sourceId = sanitizeCsharpIdentifier(src);
      const rowsVar = `__rows_${sourceId}_${listId}`;
      return `@{ var ${rowsVar} = (ViewBag.${src} as IEnumerable<IDictionary<string,object?>> ?? Array.Empty<IDictionary<string,object?>>()).ToList(); for (index = 0; index < ${rowsVar}.Count; index++) { var __item = ${rowsVar}[index];`;
    })
    .replace(/\{DS_ITEM:([^}]+)\}/g, (_, fld) => {
      const markerId = `${sanitizeCsharpIdentifier(fld)}_${listItemCounter++}`;
      return `@(__item.TryGetValue("${fld}", out var __v_${markerId}) ? __v_${markerId}?.ToString() ?? "" : "")`;
    })
    .replace(/\{DS_LIST_END\}/g, "}}");

  return `@using System.Collections.Generic
@using System.Globalization
@using System.Linq
@using System.Text
@using System.Text.Json
@{
    Layout = null;
    var index = 0;
    string __pbDecodeBase64Url(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return "";

        var normalized = value.Replace('-', '+').Replace('_', '/');
        switch (normalized.Length % 4)
        {
            case 2:
                normalized += "==";
                break;
            case 3:
                normalized += "=";
                break;
        }

        try
        {
            return Encoding.UTF8.GetString(Convert.FromBase64String(normalized));
        }
        catch
        {
            return "";
        }
    }

    string __pbApplyPipes(object? input, string encodedPipes)
    {
        object? current = input;
        if (string.IsNullOrWhiteSpace(encodedPipes))
            return current?.ToString() ?? "";

        var json = __pbDecodeBase64Url(encodedPipes);
        if (string.IsNullOrWhiteSpace(json))
            return current?.ToString() ?? "";

        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
                return current?.ToString() ?? "";

            foreach (var op in doc.RootElement.EnumerateArray())
            {
                if (!op.TryGetProperty("name", out var nameElement))
                    continue;

                var name = (nameElement.GetString() ?? "").Trim().ToLowerInvariant();
                var args = new List<string>();
                if (op.TryGetProperty("args", out var argsElement) &&
                    argsElement.ValueKind == JsonValueKind.Array)
                {
                    foreach (var arg in argsElement.EnumerateArray())
                    {
                        args.Add(arg.ValueKind == JsonValueKind.String ? arg.GetString() ?? "" : arg.GetRawText());
                    }
                }

                switch (name)
                {
                    case "trim":
                        current = (current?.ToString() ?? "").Trim();
                        break;
                    case "upper":
                        current = (current?.ToString() ?? "").ToUpperInvariant();
                        break;
                    case "lower":
                        current = (current?.ToString() ?? "").ToLowerInvariant();
                        break;
                    case "default":
                        if (string.IsNullOrWhiteSpace(current?.ToString()) && args.Count > 0)
                            current = args[0];
                        break;
                    case "truncate":
                    {
                        if (!int.TryParse(args.Count > 0 ? args[0] : "", NumberStyles.Integer, CultureInfo.InvariantCulture, out var length) || length < 0)
                            break;
                        var suffix = args.Count > 1 ? args[1] : "...";
                        var text = current?.ToString() ?? "";
                        if (text.Length > length)
                            current = text.Substring(0, length) + suffix;
                        break;
                    }
                    case "date":
                    {
                        var format = args.Count > 0 && !string.IsNullOrWhiteSpace(args[0]) ? args[0] : "yyyy-MM-dd";
                        var text = current?.ToString() ?? "";
                        if (DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var dto) ||
                            DateTimeOffset.TryParse(text, out dto))
                        {
                            current = dto.ToString(format, CultureInfo.InvariantCulture);
                        }
                        else if (DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt) ||
                                 DateTime.TryParse(text, out dt))
                        {
                            current = dt.ToString(format, CultureInfo.InvariantCulture);
                        }
                        break;
                    }
                    case "json":
                        current = JsonSerializer.Serialize(current);
                        break;
                }
            }
        }
        catch
        {
            return current?.ToString() ?? "";
        }

        return current?.ToString() ?? "";
    }
${varDeclarations}
}
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>@ViewBag.pageTitle ?? "${escHtml(title)}"</title>
  <style>${css}</style>
</head>
<body>
${cshtmlBody}
${runtimeFormScript()}
</body>
</html>`;
}

// ── C# renderer source generator ──────────────────────────────────────────

function buildCsharpRenderer(templateHtml: string): string {
  // Encode the template as Base64 to avoid any escaping issues
  const base64 = Buffer.from(templateHtml, "utf-8").toString("base64");

  return `using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace CompiledPages;

public static class PageRenderer
{
    private static readonly string Template =
        System.Text.Encoding.UTF8.GetString(Convert.FromBase64String("${base64}"));

    private static readonly Regex _single = new(
        @"\\{DS:([^.}]+)\\.([^}]+)\\}", RegexOptions.Compiled);

    private static readonly Regex _singlePiped = new(
        @"\\{DS_PIPE:([^|}]+)\\|([^|}]*)\\|([^}]*)\\}", RegexOptions.Compiled);

    private static readonly Regex _indexed = new(
        @"\\{DS_AT:([^|}]+)\\|([^|}]*)\\|([^}]+)\\}", RegexOptions.Compiled);

    private static readonly Regex _indexedPiped = new(
        @"\\{DS_AT_PIPE:([^|}]+)\\|([^|}]*)\\|([^|}]*)\\|([^}]*)\\}", RegexOptions.Compiled);

    private static readonly Regex _listBlock = new(
        @"\\{DS_LIST_START:([^}]+)\\}(.*?)\\{DS_LIST_END\\}",
        RegexOptions.Compiled | RegexOptions.Singleline);

    private static readonly Regex _ifBlock = new(
        @"\\{DS_IF:([^|}]+)\\|([^}]*)\\}(.*?)(?:\\{DS_ELSE\\}(.*?))?\\{DS_ENDIF\\}",
        RegexOptions.Compiled | RegexOptions.Singleline);

    private static readonly Regex _item = new(
        @"\\{DS_ITEM:([^}]+)\\}", RegexOptions.Compiled);

    private static readonly Regex _options = new(
        @"\\{DS_OPTIONS:([^|}]+)\\|([^|}]*)\\|([^|}]*)\\|([^}]*)\\}",
        RegexOptions.Compiled);

    private static readonly Regex _predicate = new(
        @"^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=>\\s*\\1\\.([A-Za-z_][A-Za-z0-9_]*)\\s*(==|!=|>|<|contains|startsWith|endsWith)\\s*(.+?)\\s*$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static string Render(IReadOnlyDictionary<string, object?> vb)
    {
        static object? Raw(IReadOnlyDictionary<string, object?>? row, string k)
        {
            if (row is null) return null;
            if (k == "*") return row;
            if (row.TryGetValue(k, out var exact)) return exact;
            var fallback = row.FirstOrDefault(entry => string.Equals(entry.Key, k, StringComparison.OrdinalIgnoreCase));
            return fallback.Key is null ? null : fallback.Value;
        }

        static string V(IReadOnlyDictionary<string, object?>? row, string k) =>
            Raw(row, k)?.ToString() ?? "";

        IReadOnlyDictionary<string, object?>? SingleRow(string k) =>
            vb.TryGetValue(k, out var v) && v is IReadOnlyDictionary<string, object?> r ? r : null;

        IEnumerable<IReadOnlyDictionary<string, object?>> Rows(string k)
        {
            if (!vb.TryGetValue(k, out var v) || v is null)
                return Array.Empty<IReadOnlyDictionary<string, object?>>();

            if (v is IReadOnlyDictionary<string, object?> oneRow)
                return new[] { oneRow };

            return v is IEnumerable<IReadOnlyDictionary<string, object?>> rs
                ? rs
                : Array.Empty<IReadOnlyDictionary<string, object?>>();
        }

        static string DecodeBase64Url(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return "";

            var normalized = value.Replace('-', '+').Replace('_', '/');
            switch (normalized.Length % 4)
            {
                case 2:
                    normalized += "==";
                    break;
                case 3:
                    normalized += "=";
                    break;
            }

            try
            {
                return Encoding.UTF8.GetString(Convert.FromBase64String(normalized));
            }
            catch
            {
                return "";
            }
        }

        static List<(string Name, string[] Args)> ReadPipeOps(string encodedPipes)
        {
            var ops = new List<(string Name, string[] Args)>();
            if (string.IsNullOrWhiteSpace(encodedPipes))
                return ops;

            var json = DecodeBase64Url(encodedPipes);
            if (string.IsNullOrWhiteSpace(json))
                return ops;

            try
            {
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.ValueKind != JsonValueKind.Array)
                    return ops;

                foreach (var op in doc.RootElement.EnumerateArray())
                {
                    if (!op.TryGetProperty("name", out var nameElement))
                        continue;

                    var name = (nameElement.GetString() ?? "").Trim().ToLowerInvariant();
                    if (string.IsNullOrWhiteSpace(name))
                        continue;

                    var args = new List<string>();
                    if (op.TryGetProperty("args", out var argsElement) &&
                        argsElement.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var arg in argsElement.EnumerateArray())
                        {
                            args.Add(arg.ValueKind == JsonValueKind.String ? arg.GetString() ?? "" : arg.GetRawText());
                        }
                    }

                    ops.Add((name, args.ToArray()));
                }
            }
            catch
            {
                return ops;
            }

            return ops;
        }

        static string ApplyPipes(object? raw, string encodedPipes)
        {
            var current = raw;
            foreach (var (name, args) in ReadPipeOps(encodedPipes))
            {
                switch (name)
                {
                    case "trim":
                        current = (current?.ToString() ?? "").Trim();
                        break;
                    case "upper":
                        current = (current?.ToString() ?? "").ToUpperInvariant();
                        break;
                    case "lower":
                        current = (current?.ToString() ?? "").ToLowerInvariant();
                        break;
                    case "default":
                        if (string.IsNullOrWhiteSpace(current?.ToString()) && args.Length > 0)
                            current = args[0];
                        break;
                    case "truncate":
                    {
                        if (!int.TryParse(args.Length > 0 ? args[0] : "", NumberStyles.Integer, CultureInfo.InvariantCulture, out var length) || length < 0)
                            break;
                        var text = current?.ToString() ?? "";
                        var suffix = args.Length > 1 ? args[1] : "...";
                        if (text.Length > length)
                            current = text.Substring(0, length) + suffix;
                        break;
                    }
                    case "date":
                    {
                        var format = args.Length > 0 && !string.IsNullOrWhiteSpace(args[0]) ? args[0] : "yyyy-MM-dd";
                        if (current is DateTimeOffset dto)
                        {
                            current = dto.ToString(format, CultureInfo.InvariantCulture);
                            break;
                        }
                        if (current is DateTime dt)
                        {
                            current = dt.ToString(format, CultureInfo.InvariantCulture);
                            break;
                        }

                        var text = current?.ToString() ?? "";
                        if (DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsedDto) ||
                            DateTimeOffset.TryParse(text, out parsedDto))
                        {
                            current = parsedDto.ToString(format, CultureInfo.InvariantCulture);
                        }
                        else if (DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDt) ||
                                 DateTime.TryParse(text, out parsedDt))
                        {
                            current = parsedDt.ToString(format, CultureInfo.InvariantCulture);
                        }
                        break;
                    }
                    case "json":
                        current = JsonSerializer.Serialize(current);
                        break;
                }
            }

            return current?.ToString() ?? "";
        }

        static int ResolveIndexToken(string token, int fallbackIndex)
        {
            var safeFallback = fallbackIndex < 0 ? 0 : fallbackIndex;
            var trimmed = (token ?? "").Trim();

            if (string.IsNullOrWhiteSpace(trimmed))
                return safeFallback;

            if (trimmed.Equals("index", StringComparison.OrdinalIgnoreCase))
                return safeFallback;

            return int.TryParse(trimmed, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) && parsed >= 0
                ? parsed
                : safeFallback;
        }

        string OptionTags(string source, string valueField, string labelField, string selected)
        {
            var labelKey = string.IsNullOrWhiteSpace(labelField) ? valueField : labelField;
            var sb = new StringBuilder();

            foreach (var row in Rows(source))
            {
                var value = V(row, valueField);
                var label = V(row, labelKey);
                if (string.IsNullOrWhiteSpace(label))
                    label = value;

                var selectedAttr = value.Equals(selected, StringComparison.OrdinalIgnoreCase) ? " selected" : "";
                sb.Append("<option value=\\\"")
                  .Append(WebUtility.HtmlEncode(value))
                  .Append("\\\"")
                  .Append(selectedAttr)
                  .Append(">")
                  .Append(WebUtility.HtmlEncode(label))
                  .Append("</option>");
            }

            return sb.ToString();
        }

        static string NormalizeLiteral(string literal)
        {
            var value = literal.Trim();
            if ((value.StartsWith("\\\"") && value.EndsWith("\\\"")) || (value.StartsWith("'") && value.EndsWith("'")))
                return value.Substring(1, value.Length - 2);
            return value;
        }

        static bool CompareValue(string left, string op, string right)
        {
            if (op.Equals("contains", StringComparison.OrdinalIgnoreCase))
                return left.Contains(right, StringComparison.OrdinalIgnoreCase);
            if (op.Equals("startsWith", StringComparison.OrdinalIgnoreCase))
                return left.StartsWith(right, StringComparison.OrdinalIgnoreCase);
            if (op.Equals("endsWith", StringComparison.OrdinalIgnoreCase))
                return left.EndsWith(right, StringComparison.OrdinalIgnoreCase);

            if (decimal.TryParse(left, NumberStyles.Any, CultureInfo.InvariantCulture, out var leftNum) &&
                decimal.TryParse(right, NumberStyles.Any, CultureInfo.InvariantCulture, out var rightNum))
            {
                return op switch
                {
                    "==" => leftNum == rightNum,
                    "!=" => leftNum != rightNum,
                    ">"  => leftNum > rightNum,
                    "<"  => leftNum < rightNum,
                    _    => false,
                };
            }

            var cmp = string.Compare(left, right, StringComparison.OrdinalIgnoreCase);
            return op switch
            {
                "==" => cmp == 0,
                "!=" => cmp != 0,
                ">"  => cmp > 0,
                "<"  => cmp < 0,
                _    => false,
            };
        }

        static bool MatchesPredicate(IReadOnlyDictionary<string, object?> row, string predicate)
        {
            if (string.IsNullOrWhiteSpace(predicate))
                return false;

            var match = _predicate.Match(predicate);
            if (!match.Success)
                return false;

            var field = match.Groups[2].Value;
            var op = match.Groups[3].Value;
            var right = NormalizeLiteral(match.Groups[4].Value);
            var left = V(row, field);
            return CompareValue(left, op, right);
        }

        bool EvaluateCondition(string source, string predicate)
        {
            if (vb.TryGetValue(source, out var sourceValue))
            {
                if (sourceValue is IReadOnlyDictionary<string, object?> oneRow)
                    return MatchesPredicate(oneRow, predicate);

                if (sourceValue is IEnumerable<IReadOnlyDictionary<string, object?>> manyRows)
                {
                    foreach (var row in manyRows)
                    {
                        if (MatchesPredicate(row, predicate))
                            return true;
                    }
                }
            }

            return false;
        }

        // Resolve conditional blocks first so branch content can still contain list/single markers.
        var output = _ifBlock.Replace(Template, m =>
        {
            var source = m.Groups[1].Value;
            var predicate = m.Groups[2].Value;
            var ifHtml = m.Groups[3].Value;
            var elseHtml = m.Groups[4].Success ? m.Groups[4].Value : "";
            return EvaluateCondition(source, predicate) ? ifHtml : elseHtml;
        });

        // Resolve list blocks first (they contain nested DS_ITEM markers)
        output = _listBlock.Replace(output, m =>
        {
            var name  = m.Groups[1].Value;
            var block = m.Groups[2].Value;
            var sb    = new StringBuilder();
            var currentIndex = 0;
            foreach (var row in Rows(name))
            {
                var rowCopy = row;
                var indexCopy = currentIndex;
                var listChunk = _item.Replace(block, im => V(rowCopy, im.Groups[1].Value));
                listChunk = _indexedPiped.Replace(listChunk, im =>
                {
                    var source = im.Groups[1].Value;
                    var indexToken = im.Groups[2].Value;
                    var field = im.Groups[3].Value;
                    var encodedPipes = im.Groups[4].Value;

                    if (source.Equals(name, StringComparison.OrdinalIgnoreCase) &&
                        indexToken.Equals("index", StringComparison.OrdinalIgnoreCase))
                    {
                        return ApplyPipes(Raw(rowCopy, field), encodedPipes);
                    }

                    var indexedRow = Rows(source).ElementAtOrDefault(ResolveIndexToken(indexToken, indexCopy));
                    return ApplyPipes(Raw(indexedRow, field), encodedPipes);
                });
                listChunk = _indexed.Replace(listChunk, im =>
                {
                    var source = im.Groups[1].Value;
                    var indexToken = im.Groups[2].Value;
                    var field = im.Groups[3].Value;

                    if (source.Equals(name, StringComparison.OrdinalIgnoreCase) &&
                        indexToken.Equals("index", StringComparison.OrdinalIgnoreCase))
                    {
                        return V(rowCopy, field);
                    }

                    var indexedRow = Rows(source).ElementAtOrDefault(ResolveIndexToken(indexToken, indexCopy));
                    return V(indexedRow, field);
                });
                sb.Append(listChunk);
                currentIndex++;
            }
            return sb.ToString();
        });

        // Resolve datasource-backed select option markers.
        output = _options.Replace(output, m =>
            OptionTags(m.Groups[1].Value, m.Groups[2].Value, m.Groups[3].Value, m.Groups[4].Value));

        // Resolve indexed list bindings with pipes (outside list blocks fallback to first row).
        output = _indexedPiped.Replace(output, m =>
        {
            var row = Rows(m.Groups[1].Value).ElementAtOrDefault(ResolveIndexToken(m.Groups[2].Value, 0));
            return ApplyPipes(Raw(row, m.Groups[3].Value), m.Groups[4].Value);
        });

        // Resolve indexed list bindings (outside list blocks fallback to first row).
        output = _indexed.Replace(output, m =>
        {
            var row = Rows(m.Groups[1].Value).ElementAtOrDefault(ResolveIndexToken(m.Groups[2].Value, 0));
            return V(row, m.Groups[3].Value);
        });

        // Resolve single-record field bindings with pipes.
        output = _singlePiped.Replace(output,
            m => ApplyPipes(Raw(SingleRow(m.Groups[1].Value), m.Groups[2].Value), m.Groups[3].Value));

        // Resolve single-record field bindings
        return _single.Replace(output,
            m => V(SingleRow(m.Groups[1].Value), m.Groups[2].Value));
    }
}
`;
}

// ── Public entry point ─────────────────────────────────────────────────────

import { getDisplaySourcesFromRootProps } from "@/lib/datasource-roots";
import { exportedPageStyles } from "@/puck/export-styles";

export type TemplateBundle = {
  razorTemplate: string;
  csharpSource: string;
  dataSourceMapJson: string;
};

export function buildTemplateBundle(
  data: Data,
  context: RenderContext = defaultRenderContext,
): TemplateBundle {
  const rootProps = (data.root as { props?: Record<string, unknown> }).props ?? {};
  const displaySources = getDisplaySourcesFromRootProps(rootProps as Record<string, unknown>);
  const title = String(rootProps.title || "Page");

  const markerBodyHtml = renderItemsWithMarkers(
    (data.content ?? []) as PuckItem[],
    context,
  );
  const bodyHtml = convertMergeTagsToDataSourceMarkers(markerBodyHtml, displaySources);

  const razorTemplate = buildCshtml(title, bodyHtml, exportedPageStyles, displaySources);

  // The C# renderer uses the same marker-enriched body HTML (not the CSHTML)
  const rendererHtml = `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8"/>\n  <meta name="viewport" content="width=device-width,initial-scale=1"/>\n  <title>${escHtml(title)}</title>\n  <style>${exportedPageStyles}</style>\n</head>\n<body>\n${bodyHtml}\n${runtimeFormScript()}\n</body>\n</html>`;

  const csharpSource = buildCsharpRenderer(rendererHtml);

  const dataSourceMapJson = JSON.stringify({
    displaySources,
    // Backward-compatible alias for older API/runtime parsing.
    dataSources: displaySources,
  });

  return { razorTemplate, csharpSource, dataSourceMapJson };
}
