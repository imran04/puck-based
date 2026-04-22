/**
 * Generates:
 *  1. A Razor CSHTML template (stored as a human-readable artifact)
 *  2. A C# PageRenderer class source (compiled to assembly bytes by the API)
 *
 * The approach uses a template string with {DS:source.field} and
 * {DS_LIST_START:source}...{DS_ITEM:field}...{DS_LIST_END} markers.
 * The C# renderer resolves these at runtime using regexes.
 */

import type { Data } from "@puckeditor/core";

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

/** Returns the fallback or the marker if a binding exists */
function bindOrFallback(bindings: DsBindings | undefined, propName: string, fallback: string): string {
  const b = bindings?.[propName];
  return b ? dsMarker(b.source, b.field) : fallback;
}

// ── Component HTML with marker substitution ────────────────────────────────

type PuckItem = { type: string; props?: Record<string, unknown> };

function escHtml(v: string): string {
  return String(v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizePredicateMarker(value: string) {
  return String(value || "")
    .replace(/[{}]/g, "")
    .replace(/\r?\n/g, " ")
    .trim();
}

function renderItemWithMarkers(item: PuckItem): string {
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
      const whenTrue = renderItemsWithMarkers((props.whenTrue as PuckItem[]) ?? []);
      const whenFalse = renderItemsWithMarkers((props.whenFalse as PuckItem[]) ?? []);

      if (!source || !predicate) {
        return `<div class="pb-empty-state">Configure datasource and predicate for this conditional block.</div>`;
      }

      return `<section class="pb-conditional">{DS_IF:${source}|${predicate}}${whenTrue}{DS_ELSE}${whenFalse}{DS_ENDIF}</section>`;
    }

    case "Section": {
      const inner = renderItemsWithMarkers((props.content as PuckItem[]) ?? []);
      const tone = String(props.tone || "white");
      const padding = String(props.padding || "normal");
      const cls = ["pb-section", tone === "soft" ? "pb-section--soft" : "", tone === "dark" ? "pb-section--dark" : "", `pb-section--${padding}`].filter(Boolean).join(" ");
      return `<section class="${cls}"><div class="pb-container pb-stack">${inner}</div></section>`;
    }

    case "Container": {
      const inner = renderItemsWithMarkers((props.content as PuckItem[]) ?? []);
      return `<div class="pb-container">${inner}</div>`;
    }

    case "Stack": {
      const inner = renderItemsWithMarkers((props.content as PuckItem[]) ?? []);
      return `<div class="pb-stack-layout pb-stack-layout--${escHtml(String(props.gap || "medium"))}">${inner}</div>`;
    }

    case "Columns": {
      const cols = Number(props.columns || "2");
      const slots = ([props.first, props.second, props.third, props.fourth] as PuckItem[][]).slice(0, cols);
      const inner = slots.map(s => `<div class="pb-column">${renderItemsWithMarkers(s ?? [])}</div>`).join("");
      return `<div class="pb-columns-layout pb-columns-layout--${cols}">${inner}</div>`;
    }

    case "Grid": {
      const inner = renderItemsWithMarkers((props.content as PuckItem[]) ?? []);
      return `<div class="pb-grid-layout pb-grid-layout--${escHtml(String(props.columns || "3"))}">${inner}</div>`;
    }

    case "Box": {
      const inner = renderItemsWithMarkers((props.content as PuckItem[]) ?? []);
      return `<div class="pb-box pb-box--${escHtml(String(props.surface || "card"))}">${inner}</div>`;
    }

    case "TwoColumn": {
      const left  = renderItemsWithMarkers((props.left as PuckItem[]) ?? []);
      const right = renderItemsWithMarkers((props.right as PuckItem[]) ?? []);
      return `<div class="pb-columns"><div>${left}</div><div>${right}</div></div>`;
    }

    case "SplitSection": {
      const content = renderItemsWithMarkers((props.content as PuckItem[]) ?? []);
      const media   = renderItemsWithMarkers((props.media as PuckItem[]) ?? []);
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

    case "ImageBlock":
      return `<figure class="pb-image pb-image--${escHtml(String(props.aspect || "wide"))}"><img alt="${escHtml(String(props.alt || "Image"))}" src="${escHtml(String(props.src || ""))}" /></figure>`;

    case "Testimonial": {
      const quote = bindOrFallback(bindings, "quote", escHtml(String(props.quote || "")));
      const name  = bindOrFallback(bindings, "name",  escHtml(String(props.name || "")));
      const role  = bindOrFallback(bindings, "role",  escHtml(String(props.role || "")));
      return `<article class="pb-testimonial"><p>${quote}</p><div class="pb-testimonial__person"><div><strong>${name}</strong><small>${role}</small></div></div></article>`;
    }

    default:
      return "";
  }
}

function renderItemsWithMarkers(items: PuckItem[]): string {
  return items.map(renderItemWithMarkers).join("");
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

  // Convert conditional/list/single datasource markers to CSHTML-friendly syntax.
  const cshtmlBody = bodyHtml
    .replace(/\{DS_IF:([^|}]+)\|([^}]*)\}([\s\S]*?)(?:\{DS_ELSE\}([\s\S]*?))?\{DS_ENDIF\}/g, (_, src, pred, ifHtml, elseHtml) =>
      `@* IF ${src} :: ${pred} *@${ifHtml}${elseHtml ? `@* ELSE *@${elseHtml}` : ""}@* ENDIF *@`)
    .replace(/\{DS:([^.}]+)\.([^}]+)\}/g, (_, src, fld) =>
      `@(ViewBag.${src} is IDictionary<string,object?> _${src}_${fld} ? (_${src}_${fld}.TryGetValue("${fld}", out var _v_${src}_${fld}) ? _v_${src}_${fld}?.ToString() ?? "" : "") : "")`)
    .replace(/\{DS_LIST_START:([^}]+)\}/g, (_, src) =>
      `@foreach (var __item in (ViewBag.${src} as IEnumerable<IDictionary<string,object?>> ?? Array.Empty<IDictionary<string,object?>>())){`)
    .replace(/\{DS_ITEM:([^}]+)\}/g, (_, fld) =>
      `@(__item.TryGetValue("${fld}", out var __v_${fld}) ? __v_${fld}?.ToString() ?? "" : "")`)
    .replace(/\{DS_LIST_END\}/g, "}");

  return `@using System.Collections.Generic
@{
    Layout = null;
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
using System.Text;
using System.Text.RegularExpressions;

namespace CompiledPages;

public static class PageRenderer
{
    private static readonly string Template =
        System.Text.Encoding.UTF8.GetString(Convert.FromBase64String("${base64}"));

    private static readonly Regex _single = new(
        @"\\{DS:([^.}]+)\\.([^}]+)\\}", RegexOptions.Compiled);

    private static readonly Regex _listBlock = new(
        @"\\{DS_LIST_START:([^}]+)\\}(.*?)\\{DS_LIST_END\\}",
        RegexOptions.Compiled | RegexOptions.Singleline);

    private static readonly Regex _ifBlock = new(
        @"\\{DS_IF:([^|}]+)\\|([^}]*)\\}(.*?)(?:\\{DS_ELSE\\}(.*?))?\\{DS_ENDIF\\}",
        RegexOptions.Compiled | RegexOptions.Singleline);

    private static readonly Regex _item = new(
        @"\\{DS_ITEM:([^}]+)\\}", RegexOptions.Compiled);

    private static readonly Regex _predicate = new(
        @"^\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=>\\s*\\1\\.([A-Za-z_][A-Za-z0-9_]*)\\s*(==|!=|>|<|contains|startsWith|endsWith)\\s*(.+?)\\s*$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static string Render(IReadOnlyDictionary<string, object?> vb)
    {
        static string V(IReadOnlyDictionary<string, object?>? row, string k)
        {
            if (row is null) return "";
            if (row.TryGetValue(k, out var exact)) return exact?.ToString() ?? "";
            var fallback = row.FirstOrDefault(entry => string.Equals(entry.Key, k, StringComparison.OrdinalIgnoreCase));
            return fallback.Key is null ? "" : fallback.Value?.ToString() ?? "";
        }

        IReadOnlyDictionary<string, object?>? SingleRow(string k) =>
            vb.TryGetValue(k, out var v) && v is IReadOnlyDictionary<string, object?> r ? r : null;

        IEnumerable<IReadOnlyDictionary<string, object?>> Rows(string k) =>
            vb.TryGetValue(k, out var v) && v is IEnumerable<IReadOnlyDictionary<string, object?>> rs
                ? rs : Array.Empty<IReadOnlyDictionary<string, object?>>();

        static string NormalizeLiteral(string literal)
        {
            var value = literal.Trim();
            if ((value.StartsWith("\"") && value.EndsWith("\"")) || (value.StartsWith("'") && value.EndsWith("'")))
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
            foreach (var row in Rows(name))
            {
                var rowCopy = row;
                sb.Append(_item.Replace(block, im => V(rowCopy, im.Groups[1].Value)));
            }
            return sb.ToString();
        });

        // Resolve single-record field bindings
        return _single.Replace(output,
            m => V(SingleRow(m.Groups[1].Value), m.Groups[2].Value));
    }
}
`;
}

// ── Public entry point ─────────────────────────────────────────────────────

import { exportedPageStyles } from "@/puck/export-styles";

export type TemplateBundle = {
  razorTemplate: string;
  csharpSource: string;
  dataSourceMapJson: string;
};

export function buildTemplateBundle(data: Data): TemplateBundle {
  const rootProps = (data.root as { props?: Record<string, unknown> }).props ?? {};
  const dataSources = (rootProps.dataSources as DataSourceDefinition[]) ?? [];
  const title = String(rootProps.title || "Page");

  const bodyHtml = renderItemsWithMarkers(
    (data.content ?? []) as PuckItem[],
  );

  const razorTemplate = buildCshtml(title, bodyHtml, exportedPageStyles, dataSources);

  // The C# renderer uses the same marker-enriched body HTML (not the CSHTML)
  const rendererHtml = `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8"/>\n  <meta name="viewport" content="width=device-width,initial-scale=1"/>\n  <title>${escHtml(title)}</title>\n  <style>${exportedPageStyles}</style>\n</head>\n<body>\n${bodyHtml}\n</body>\n</html>`;

  const csharpSource = buildCsharpRenderer(rendererHtml);

  const dataSourceMapJson = JSON.stringify({ dataSources });

  return { razorTemplate, csharpSource, dataSourceMapJson };
}
