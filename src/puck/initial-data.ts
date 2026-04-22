import type { Data } from "@puckeditor/core";

export const initialPageData: Data = {
  root: {
    props: {
      title: "Puck Studio Page",
    },
  },
  content: [
    {
      type: "Hero",
      props: {
        id: "Hero-home",
        eyebrow: "Puck-native builder",
        title: "Design pages and forms without surrendering your codebase",
        body: "A real page-builder foundation with controlled components, responsive slots, publish flow, and portable HTML export.",
        primaryLabel: "Open builder",
        primaryHref: "/builder/pages/home",
        secondaryLabel: "Export HTML",
        secondaryHref: "/api/pages/home/export",
        tone: "light",
      },
    },
    {
      type: "Section",
      props: {
        id: "Section-overview",
        tone: "white",
        padding: "normal",
        content: [
          {
            type: "Heading",
            props: {
              id: "Heading-overview",
              text: "One editor spine for pages and forms",
              level: "h2",
            },
          },
          {
            type: "RichText",
            props: {
              id: "RichText-overview",
              text: "<p>Puck owns the drag-and-drop experience. The form block stores plain schema that can render in React, publish as normal HTML, and later connect to validation, storage, workflows, and integrations.</p>",
            },
          },
          {
            type: "TwoColumn",
            props: {
              id: "TwoColumn-overview",
              left: [
                {
                  type: "FeatureCard",
                  props: {
                    id: "FeatureCard-layout",
                    title: "Page builder",
                    body: "Slots, constrained components, viewports, and clean published JSON.",
                  },
                },
              ],
              right: [
                {
                  type: "FeatureCard",
                  props: {
                    id: "FeatureCard-form",
                    title: "Form designer",
                    body: "A reorderable field schema inside Puck, without Form.io or SurveyJS licensing baggage.",
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      type: "Section",
      props: {
        id: "Section-form",
        tone: "soft",
        padding: "normal",
        content: [
          {
            type: "FormBlock",
            props: {
              id: "FormBlock-lead",
              title: "Lead capture",
              description:
                "Edit these fields in the Puck inspector. The output remains portable HTML.",
              actionUrl: "/api/forms/submit",
              layout: "two",
              width: "wide",
              surface: "card",
              controlStyle: "outline",
              density: "comfortable",
              submitLabel: "Send request",
              submitAlign: "left",
              submitWidth: "auto",
              successMessage: "Thanks. We received your request.",
              fields: [
                {
                  label: "Tell us about the project",
                  name: "",
                  type: "heading",
                  placeholder: "",
                  required: false,
                  helpText:
                    "Use heading, paragraph, and divider rows to structure longer forms.",
                  defaultValue: "",
                  width: "full",
                  rows: 4,
                  options: "",
                },
                {
                  label: "Work email",
                  name: "email",
                  type: "email",
                  placeholder: "you@company.com",
                  required: true,
                  helpText: "",
                  defaultValue: "",
                  width: "half",
                  rows: 4,
                  options: "",
                },
                {
                  label: "Phone",
                  name: "phone",
                  type: "tel",
                  placeholder: "+1 555 0100",
                  required: false,
                  helpText: "Optional, but useful for urgent timelines.",
                  defaultValue: "",
                  width: "half",
                  rows: 4,
                  options: "",
                },
                {
                  label: "Project type",
                  name: "project_type",
                  type: "select",
                  placeholder: "Choose one",
                  required: true,
                  helpText: "",
                  defaultValue: "",
                  width: "half",
                  rows: 4,
                  options: "Landing page\nWebsite\nInternal tool\nCampaign form",
                },
                {
                  label: "Budget range",
                  name: "budget_range",
                  type: "radio",
                  placeholder: "",
                  required: true,
                  helpText: "",
                  defaultValue: "$10k-$25k",
                  width: "half",
                  rows: 4,
                  options: "$5k-$10k\n$10k-$25k\n$25k+",
                },
                {
                  label: "What should this builder do?",
                  name: "brief",
                  type: "textarea",
                  placeholder: "Tell us the workflow",
                  required: false,
                  helpText: "Include integrations, publishing needs, and form behavior.",
                  defaultValue: "",
                  width: "full",
                  rows: 5,
                  options: "",
                },
                {
                  label: "I agree to be contacted about this request.",
                  name: "consent",
                  type: "checkbox",
                  placeholder: "",
                  required: true,
                  helpText: "",
                  defaultValue: "",
                  width: "full",
                  rows: 4,
                  options: "",
                },
              ],
            },
          },
        ],
      },
    },
  ],
};
