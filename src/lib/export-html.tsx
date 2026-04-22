import type { Data } from "@puckeditor/core";
import sanitizeHtml from "sanitize-html";
import { exportedPageStyles } from "@/puck/export-styles";
import { safeFormAction, safeLinkUrl, safeMediaUrl } from "@/lib/url";
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
} from "@/puck/form-schema";
import { decorateMergeTagsInHtml, mergeTextToHtml } from "@/puck/merge-tags";

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getTitle(data: Data, fallback: string) {
  const root = data.root as { props?: { title?: string }; title?: string };
  return root.props?.title || root.title || fallback;
}

type PuckItem = {
  type: string;
  props?: Record<string, unknown>;
};

function slot(value: unknown) {
  return Array.isArray(value) ? renderItems(value as PuckItem[]) : "";
}

function sectionClass(tone: unknown, padding: unknown) {
  return [
    "pb-section",
    tone === "soft" ? "pb-section--soft" : "",
    tone === "dark" ? "pb-section--dark" : "",
    `pb-section--${padding || "normal"}`,
  ]
    .filter(Boolean)
    .join(" ");
}

function containerClass(width: unknown = "standard", align: unknown = "left") {
  return [
    "pb-container",
    `pb-container--${String(width || "standard")}`,
    `pb-container--align-${String(align || "left")}`,
  ].join(" ");
}

function textLines(value: unknown) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function styleAttr(properties: Record<string, string>) {
  const value = Object.entries(properties)
    .map(([key, val]) => `${key}: ${val}`)
    .join("; ");

  return value ? ` style="${escapeHtml(value)}"` : "";
}

function richTextToHtml(value: unknown) {
  const raw = String(value || "");

  if (!raw.trim()) {
    return "";
  }

  const html = /<\/?[a-z][\w:-]*(\s[^>]*)?>/i.test(raw)
    ? raw
    : `<p>${mergeTextToHtml(raw).replace(/\r?\n/g, "<br />")}</p>`;

  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "a",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "br",
      "hr",
      "span",
      "div",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      span: ["class", "data-merge-tag"],
      div: ["style"],
      p: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
      h5: ["style"],
      h6: ["style"],
    },
    allowedClasses: {
      span: ["pb-merge-tag"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedStyles: {
      "*": {
        "text-align": [/^left$/, /^center$/, /^right$/, /^justify$/],
      },
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
    textFilter: (text) => decorateMergeTagsInHtml(text),
  });
}

function renderFormHelp(field: FormField, id: string) {
  return field.helpText
    ? `<span class="pb-help" id="${id}">${escapeHtml(field.helpText)}</span>`
    : "";
}

function renderLayoutFormField(field: FormField, index: number, layout?: FormLayout) {
  const className = fieldClassName(field, layout);

  if (field.type === "heading") {
    return `<div class="${className} pb-form-copy">
  <h3>${escapeHtml(field.label || "Section heading")}</h3>
  ${field.helpText ? `<p>${escapeHtml(field.helpText)}</p>` : ""}
</div>`;
  }

  if (field.type === "paragraph") {
    return `<div class="${className} pb-form-copy">
  <p>${escapeHtml(field.label || field.helpText || "")}</p>
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
  <input id="${optionId}" name="${escapeHtml(inputName)}" type="${inputType}" value="${escapeHtml(option)}"${checked}${requiredAttr} />
  <span>${escapeHtml(option)}</span>
</label>`;
      })
      .join("")}
  </div>`;
}

function renderFormField(field: FormField, index: number, layout?: FormLayout) {
  const layoutField = renderLayoutFormField(field, index, layout);

  if (layoutField) {
    return layoutField;
  }

  const label = escapeHtml(String(field.label || `Field ${index + 1}`));
  const name = normalizeName(field.name || field.label, `field_${index + 1}`);
  const id = `form_${name}_${index}`;
  const required = field.required ? " required" : "";
  const descriptionId = field.helpText ? `${id}_help` : "";
  const placeholder = field.placeholder
    ? ` placeholder="${escapeHtml(String(field.placeholder))}"`
    : "";
  const describedBy = descriptionId ? ` aria-describedby="${descriptionId}"` : "";
  const defaultValue = field.defaultValue
    ? ` value="${escapeHtml(String(field.defaultValue))}"`
    : "";
  const className = fieldClassName(field, layout);

  if (field.type === "hidden") {
    return `<input name="${escapeHtml(name)}" type="hidden"${defaultValue} />`;
  }

  if (field.type === "textarea") {
    return `<label class="${className}" for="${id}">
  <span class="pb-label">${label}${required ? " *" : ""}</span>
  <textarea class="pb-textarea" id="${id}" name="${escapeHtml(name)}" rows="${field.rows || 4}"${placeholder}${required}${describedBy}>${escapeHtml(field.defaultValue || "")}</textarea>
  ${renderFormHelp(field, descriptionId)}
</label>`;
  }

  if (field.type === "select") {
    const options = parseOptions(field.options)
      .map((option) => {
        const selected = option === field.defaultValue ? " selected" : "";

        return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(option)}</option>`;
      })
      .join("");

    return `<label class="${className}" for="${id}">
  <span class="pb-label">${label}${required ? " *" : ""}</span>
  <select class="pb-select" id="${id}" name="${escapeHtml(name)}"${required}${describedBy}>
    <option value="">${escapeHtml(String(field.placeholder || "Select an option"))}</option>
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
  <input id="${id}" name="${escapeHtml(name)}" type="checkbox" value="true"${required}${checked} />
  <span>${label}${required ? " *" : ""}${field.helpText ? `<small>${escapeHtml(field.helpText)}</small>` : ""}</span>
</label>`;
  }

  const inputType = ["email", "tel", "number", "date", "file"].includes(String(field.type))
    ? String(field.type)
    : "text";
  const value = inputType === "file" ? "" : defaultValue;

  return `<label class="${className}" for="${id}">
  <span class="pb-label">${label}${required ? " *" : ""}</span>
  <input class="pb-input" id="${id}" name="${escapeHtml(name)}" type="${inputType}"${placeholder}${required}${describedBy}${value} />
  ${renderFormHelp(field, descriptionId)}
</label>`;
}

function renderComponent(item: PuckItem): string {
  const props = item.props || {};

  switch (item.type) {
    case "Hero": {
      const heroClass = props.tone === "dark" ? "pb-hero pb-hero--dark" : "pb-hero";
      return `<section class="${heroClass}">
  <div class="pb-container pb-hero__grid">
    <div>
      ${props.eyebrow ? `<p class="pb-eyebrow">${mergeTextToHtml(String(props.eyebrow))}</p>` : ""}
      <h1 class="pb-title">${mergeTextToHtml(String(props.title || ""))}</h1>
      ${props.body ? `<p class="pb-copy">${mergeTextToHtml(String(props.body))}</p>` : ""}
      <div class="pb-actions">
        ${
          props.primaryLabel
            ? `<a class="pb-button" href="${escapeHtml(safeLinkUrl(String(props.primaryHref || "")))}">${mergeTextToHtml(String(props.primaryLabel))}</a>`
            : ""
        }
        ${
          props.secondaryLabel
            ? `<a class="pb-button pb-button--secondary" href="${escapeHtml(safeLinkUrl(String(props.secondaryHref || "")))}">${mergeTextToHtml(String(props.secondaryLabel))}</a>`
            : ""
        }
      </div>
    </div>
    <div aria-hidden="true" class="pb-visual"></div>
  </div>
</section>`;
    }

    case "Section":
      return `<section class="${sectionClass(props.tone, props.padding)}">
  <div class="${containerClass(props.width, props.align)} pb-stack">
    ${slot(props.content)}
  </div>
</section>`;

    case "Container":
      return `<div class="${containerClass(props.width, props.align)}">
  ${slot(props.content)}
</div>`;

    case "Stack":
      return `<div class="pb-stack-layout pb-stack-layout--${escapeHtml(String(props.gap || "medium"))} pb-stack-layout--${escapeHtml(String(props.align || "stretch"))}">
  ${slot(props.content)}
</div>`;

    case "Columns": {
      const columns = Number(props.columns || "2");
      const slots = [props.first, props.second, props.third, props.fourth].slice(0, columns);

      return `<div class="pb-columns-layout pb-columns-layout--${escapeHtml(String(props.columns || "2"))} pb-columns-layout--${escapeHtml(String(props.ratio || "equal"))} pb-layout-gap--${escapeHtml(String(props.gap || "medium"))} pb-layout-align--${escapeHtml(String(props.align || "start"))}">
  ${slots.map((column) => `<div class="pb-column">${slot(column)}</div>`).join("")}
</div>`;
    }

    case "Grid":
      return `<div class="pb-grid-layout pb-grid-layout--${escapeHtml(String(props.columns || "3"))} pb-layout-gap--${escapeHtml(String(props.gap || "medium"))}">
  ${slot(props.content)}
</div>`;

    case "SplitSection":
      return `<section class="${sectionClass(props.tone, "normal")}">
  <div class="pb-container pb-split pb-split--${escapeHtml(String(props.ratio || "equal"))} pb-split--media-${escapeHtml(String(props.mediaSide || "right"))}">
    <div class="pb-split__content">${slot(props.content)}</div>
    <div class="pb-split__media">${slot(props.media)}</div>
  </div>
</section>`;

    case "Box":
      return `<div class="pb-box pb-box--${escapeHtml(String(props.surface || "card"))} pb-box--padding-${escapeHtml(String(props.padding || "medium"))}">
  ${slot(props.content)}
</div>`;

    case "Spacer":
      return `<div aria-hidden="true" class="pb-spacer pb-spacer--${escapeHtml(String(props.size || "medium"))}"></div>`;

    case "Divider": {
      const divider = `<hr class="pb-section-divider pb-section-divider--${escapeHtml(String(props.tone || "light"))}" />`;

      return props.inset === "container" ? `<div class="pb-container">${divider}</div>` : divider;
    }

    case "TwoColumn":
      return `<div class="pb-columns">
  <div>${slot(props.left)}</div>
  <div>${slot(props.right)}</div>
</div>`;

    case "Heading": {
      const tag = props.level === "h3" ? "h3" : "h2";
      return `<${tag} class="pb-heading">${mergeTextToHtml(String(props.text || ""))}</${tag}>`;
    }

    case "RichText":
      return `<div class="pb-rich-text">${richTextToHtml(props.text)}</div>`;

    case "FeatureCard":
      return `<article class="pb-card">
  <h3 class="pb-card__title">${mergeTextToHtml(String(props.title || ""))}</h3>
  <p class="pb-card__body">${mergeTextToHtml(String(props.body || ""))}</p>
</article>`;

    case "ButtonLink": {
      const className =
        props.variant === "secondary" ? "pb-button pb-button--secondary" : "pb-button";
      return `<a class="${className}" href="${escapeHtml(safeLinkUrl(String(props.href || "")))}">${mergeTextToHtml(String(props.label || "Continue"))}</a>`;
    }

    case "ImageBlock": {
      const src = safeMediaUrl(String(props.src || ""));
      return `<figure class="pb-image pb-image--${escapeHtml(String(props.aspect || "wide"))}">
  ${
    src
      ? `<img alt="${escapeHtml(String(props.alt || "Image"))}" src="${escapeHtml(src)}" />`
      : `<div class="pb-media-placeholder">Image</div>`
  }
  ${props.caption ? `<figcaption>${mergeTextToHtml(String(props.caption))}</figcaption>` : ""}
</figure>`;
    }

    case "VideoEmbed": {
      const url = safeMediaUrl(String(props.url || ""));
      return `<figure class="pb-video">
  <div class="pb-video__frame">
    ${
      url
        ? `<iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen src="${escapeHtml(url)}" title="${escapeHtml(String(props.title || "Video"))}"></iframe>`
        : `<div class="pb-media-placeholder">Video</div>`
    }
  </div>
  ${props.caption ? `<figcaption>${mergeTextToHtml(String(props.caption))}</figcaption>` : ""}
</figure>`;
    }

    case "Gallery": {
      const images = [props.imageOne, props.imageTwo, props.imageThree, props.imageFour].map(
        (src) => safeMediaUrl(String(src || "")),
      );
      return `<figure class="pb-gallery">
  <div class="pb-gallery__grid">
    ${images
      .map((src, index) =>
        src
          ? `<img alt="Gallery image ${index + 1}" src="${escapeHtml(src)}" />`
          : `<div class="pb-media-placeholder">Image ${index + 1}</div>`,
      )
      .join("")}
  </div>
  ${props.caption ? `<figcaption>${mergeTextToHtml(String(props.caption))}</figcaption>` : ""}
</figure>`;
    }

    case "QuoteBlock":
      return `<figure class="pb-quote">
  <blockquote>${mergeTextToHtml(String(props.quote || ""))}</blockquote>
  ${
    props.author || props.role
      ? `<figcaption>${props.author ? `<strong>${mergeTextToHtml(String(props.author))}</strong>` : ""}${props.role ? `<span>${mergeTextToHtml(String(props.role))}</span>` : ""}</figcaption>`
      : ""
  }
</figure>`;

    case "Testimonial": {
      const avatar = safeMediaUrl(String(props.avatarUrl || ""));
      const name = String(props.name || "");
      return `<article class="pb-testimonial">
  <p>${mergeTextToHtml(String(props.quote || ""))}</p>
  <div class="pb-testimonial__person">
    ${
      avatar
        ? `<img alt="" src="${escapeHtml(avatar)}" />`
        : `<span aria-hidden="true">${escapeHtml(name ? name.slice(0, 1).toUpperCase() : "T")}</span>`
    }
    <div>
      <strong>${mergeTextToHtml(name)}</strong>
      <small>${mergeTextToHtml(String(props.role || ""))}</small>
    </div>
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
      ([value, label]) => `<div class="pb-stat">
    <strong>${mergeTextToHtml(String(value || ""))}</strong>
    <span>${mergeTextToHtml(String(label || ""))}</span>
  </div>`,
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
      ([question, answer], index) => `<details${index === 0 ? " open" : ""}>
    <summary>${mergeTextToHtml(String(question || ""))}</summary>
    <p>${mergeTextToHtml(String(answer || ""))}</p>
  </details>`,
    )
    .join("")}
</div>`;
    }

    case "TextList": {
      const tag = props.style === "numbers" ? "ol" : "ul";
      return `<div class="pb-text-list pb-text-list--${escapeHtml(String(props.style || "bullets"))}">
  ${props.title ? `<h3>${mergeTextToHtml(String(props.title))}</h3>` : ""}
  <${tag}>
    ${textLines(props.items)
      .map((item) => `<li>${mergeTextToHtml(item)}</li>`)
      .join("")}
  </${tag}>
</div>`;
    }

    case "LogoStrip":
      return `<div class="pb-logo-strip">
  ${props.title ? `<p>${mergeTextToHtml(String(props.title))}</p>` : ""}
  <div>
    ${textLines(props.logos)
      .map((logo) => `<span>${mergeTextToHtml(logo)}</span>`)
      .join("")}
  </div>
</div>`;

    case "TableBlock": {
      const rows = textLines(props.rows).map((row) =>
        row.split("|").map((cell) => cell.trim()),
      );
      const [header, ...body] = rows;
      return `<div class="pb-table-wrap">
  <table class="pb-table">
    ${props.caption ? `<caption>${mergeTextToHtml(String(props.caption))}</caption>` : ""}
    ${
      header
        ? `<thead><tr>${header.map((cell) => `<th>${mergeTextToHtml(cell)}</th>`).join("")}</tr></thead>`
        : ""
    }
    <tbody>
      ${body
        .map((row) => `<tr>${row.map((cell) => `<td>${mergeTextToHtml(cell)}</td>`).join("")}</tr>`)
        .join("")}
    </tbody>
  </table>
</div>`;
    }

    case "Callout":
      return `<aside class="pb-callout pb-callout--${escapeHtml(String(props.tone || "info"))}">
  <strong>${mergeTextToHtml(String(props.title || ""))}</strong>
  <p>${mergeTextToHtml(String(props.body || ""))}</p>
</aside>`;

    case "CodeBlock":
      return `<figure class="pb-code">
  <figcaption>${escapeHtml(String(props.language || ""))}</figcaption>
  <pre><code>${escapeHtml(String(props.code || ""))}</code></pre>
</figure>`;

    case "EmbedBlock": {
      const url = safeMediaUrl(String(props.url || ""));
      const height = Number(props.height) || 420;
      return `<div class="pb-embed"${styleAttr({ "--pb-embed-height": `${height}px` })}>
  ${url ? `<iframe src="${escapeHtml(url)}" title="${escapeHtml(String(props.title || "Embed"))}"></iframe>` : `<div class="pb-media-placeholder">Embed</div>`}
</div>`;
    }

    case "SavedSection":
    case "SavedForm": {
      const block = props.block as { data?: PuckItem } | undefined;
      return block?.data
        ? renderComponent(block.data)
        : `<div class="pb-empty-state">Choose a saved item from the library.</div>`;
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

      return `<form action="${escapeHtml(safeFormAction(String(formProps.actionUrl || "")))}" class="${formClassName(formProps)}" method="post">
  <input name="_formTitle" type="hidden" value="${escapeHtml(String(props.title || "Form"))}" />
  <div>
    <h2 class="pb-form__title">${escapeHtml(String(formProps.title || "Form"))}</h2>
    ${
      formProps.description
        ? `<p class="pb-form__description">${escapeHtml(String(formProps.description))}</p>`
        : ""
    }
  </div>
  <div class="${fieldsClassName(formProps)}">
    ${fields.map((field, index) => renderFormField(field, index, formProps.layout)).join("")}
  </div>
  <div class="${footerClassName(formProps)}">
    <button class="pb-submit" type="submit">${escapeHtml(String(formProps.submitLabel || "Submit"))}</button>
  </div>
</form>`;
    }

    default:
      return "";
  }
}

function renderItems(items: PuckItem[]) {
  return items.map(renderComponent).join("");
}

export function buildStaticHtml(data: Data, fallbackTitle = "Published page") {
  const title = getTitle(data, fallbackTitle);
  const markup = renderItems((data.content || []) as PuckItem[]);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${exportedPageStyles}</style>
</head>
<body>
${markup}
</body>
</html>
`;
}
