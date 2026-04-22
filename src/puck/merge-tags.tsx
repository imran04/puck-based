import type { ReactNode } from "react";

export type MergeTag = {
  label: string;
  token: string;
  group: "Contact" | "Company" | "System" | "Form";
  fallback: string;
};

export const mergeTags: MergeTag[] = [
  {
    group: "Contact",
    label: "First name",
    token: "{{contact.first_name}}",
    fallback: "First name",
  },
  {
    group: "Contact",
    label: "Last name",
    token: "{{contact.last_name}}",
    fallback: "Last name",
  },
  {
    group: "Contact",
    label: "Email",
    token: "{{contact.email}}",
    fallback: "email@example.com",
  },
  {
    group: "Company",
    label: "Company",
    token: "{{company.name}}",
    fallback: "Company",
  },
  {
    group: "Company",
    label: "Industry",
    token: "{{company.industry}}",
    fallback: "Industry",
  },
  {
    group: "System",
    label: "Today",
    token: "{{system.today}}",
    fallback: "Today",
  },
  {
    group: "System",
    label: "Page URL",
    token: "{{system.page_url}}",
    fallback: "Page URL",
  },
  {
    group: "Form",
    label: "Last submission",
    token: "{{form.last_submission}}",
    fallback: "Last submission",
  },
];

const mergeTagPattern = /(\{\{[a-zA-Z0-9_.-]+\}\})/g;
const exactMergeTagPattern = /^\{\{[a-zA-Z0-9_.-]+\}\}$/;

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderMergeText(value: string): ReactNode {
  const parts = String(value || "").split(mergeTagPattern);

  return parts.map((part, index) =>
    exactMergeTagPattern.test(part) ? (
      <span className="pb-merge-tag" data-merge-tag={part} key={`${part}_${index}`}>
        {part}
      </span>
    ) : (
      part
    ),
  );
}

export function mergeTextToHtml(value: string) {
  return String(value || "")
    .split(mergeTagPattern)
    .map((part) => {
      if (exactMergeTagPattern.test(part)) {
        return `<span class="pb-merge-tag" data-merge-tag="${escapeHtml(part)}">${escapeHtml(part)}</span>`;
      }

      return escapeHtml(part);
    })
    .join("");
}

export function decorateMergeTagsInHtml(value: string) {
  return String(value || "").replace(mergeTagPattern, (token) => {
    if (!exactMergeTagPattern.test(token)) {
      return token;
    }

    return `<span class="pb-merge-tag" data-merge-tag="${token}">${token}</span>`;
  });
}
