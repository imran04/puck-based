import { Render, type Config, type RichtextField } from "@puckeditor/core";
import type { CSSProperties, ReactNode } from "react";
import { ConditionalRuleFieldRenderer } from "@/components/ConditionalRuleFieldRenderer";
import { DsBindingsFieldRenderer } from "@/components/DsBindingsFieldRenderer";
import { FormDataSinkFieldRenderer } from "@/components/FormDataSinkFieldRenderer";
import { FormDesignerModalField } from "@/components/FormDesignerModalField";
import { MergeTextField } from "@/components/MergeTextField";
import { ReusableBlockPicker } from "@/components/ReusableBlockPicker";
import { DataSourceManager } from "@/components/DataSourcePanel";
import type {
  ConditionalRule,
  DataSourceDefinition,
  DsBindings,
} from "@/lib/datasource-template";
import type { ReusableBlock } from "@/lib/reusable-blocks";
import { safeLinkUrl, safeMediaUrl } from "@/lib/url";
import { FormBlock, type FormBlockProps } from "./form";
import { defaultFormProps, type FormDataSink, type FormField } from "./form-schema";
import { mergeTags, renderMergeText } from "./merge-tags";

type Slot = (props?: { className?: string }) => ReactNode;

type SectionProps = {
  tone: "white" | "soft" | "dark";
  padding: "compact" | "normal" | "spacious";
  width?: "narrow" | "standard" | "wide" | "full";
  align?: "left" | "center" | "right";
  content: Slot;
};

type HeroProps = {
  eyebrow: string;
  title: string;
  body: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  tone: "light" | "dark";
};

type ContainerProps = {
  width: "narrow" | "standard" | "wide" | "full";
  align: "left" | "center" | "right";
  content: Slot;
};

type StackProps = {
  gap: "none" | "small" | "medium" | "large" | "xlarge";
  align: "stretch" | "left" | "center" | "right";
  content: Slot;
};

type ColumnsProps = {
  columns: "2" | "3" | "4";
  gap: "small" | "medium" | "large";
  ratio: "equal" | "sidebarLeft" | "sidebarRight" | "featureLeft" | "featureRight";
  align: "start" | "center" | "end" | "stretch";
  first: Slot;
  second: Slot;
  third: Slot;
  fourth: Slot;
};

type GridProps = {
  columns: "2" | "3" | "4";
  gap: "small" | "medium" | "large";
  content: Slot;
};

type SplitSectionProps = {
  tone: "white" | "soft" | "dark";
  mediaSide: "left" | "right";
  ratio: "equal" | "mediaWide" | "contentWide";
  content: Slot;
  media: Slot;
};

type BoxProps = {
  surface: "plain" | "card" | "soft" | "dark" | "outline";
  padding: "none" | "small" | "medium" | "large";
  content: Slot;
};

type SpacerProps = {
  size: "small" | "medium" | "large" | "xlarge";
};

type DividerProps = {
  tone: "light" | "dark" | "accent";
  inset: "none" | "container";
};

type ImageBlockProps = {
  src: string;
  alt: string;
  caption: string;
  aspect: "auto" | "wide" | "square" | "portrait";
};

type VideoEmbedProps = {
  title: string;
  url: string;
  caption: string;
};

type GalleryProps = {
  imageOne: string;
  imageTwo: string;
  imageThree: string;
  imageFour: string;
  caption: string;
};

type QuoteBlockProps = {
  quote: string;
  author: string;
  role: string;
};

type TestimonialProps = {
  quote: string;
  name: string;
  role: string;
  avatarUrl: string;
};

type StatsProps = {
  statOneValue: string;
  statOneLabel: string;
  statTwoValue: string;
  statTwoLabel: string;
  statThreeValue: string;
  statThreeLabel: string;
};

type FaqProps = {
  questionOne: string;
  answerOne: string;
  questionTwo: string;
  answerTwo: string;
  questionThree: string;
  answerThree: string;
};

type TextListProps = {
  title: string;
  items: string;
  style: "bullets" | "checks" | "numbers";
};

type LogoStripProps = {
  title: string;
  logos: string;
};

type TableBlockProps = {
  caption: string;
  rows: string;
};

type CalloutProps = {
  title: string;
  body: string;
  tone: "info" | "success" | "warning" | "dark";
};

type CodeBlockProps = {
  language: string;
  code: string;
};

type EmbedBlockProps = {
  title: string;
  url: string;
  height: string;
};

type SavedBlockProps = {
  block?: ReusableBlock | null;
};

function mergeTextField(label: string, multiline = true) {
  return {
    type: "custom" as const,
    label,
    render: ({
      value,
      onChange,
      readOnly,
    }: {
      value?: string;
      onChange: (value: string) => void;
      readOnly?: boolean;
    }) => (
      <MergeTextField
        multiline={multiline}
        onChange={onChange}
        readOnly={readOnly}
        value={value || ""}
      />
    ),
  };
}

function richTextField(label: string): RichtextField {
  return {
    type: "richtext",
    label,
    contentEditable: true,
    initialHeight: 260,
    renderMenu: ({ children, editor, readOnly }) => (
      <div className="richtext-field-menu">
        {children}
        <div className="richtext-field-menu__merge-tags">
          {mergeTags.map((tag) => (
            <button
              disabled={readOnly || !editor}
              key={tag.token}
              onMouseDown={(event) => {
                event.preventDefault();
                editor?.chain().focus().insertContent(tag.token).run();
              }}
              type="button"
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>
    ),
  };
}

function sectionClass(tone: SectionProps["tone"], padding: SectionProps["padding"]) {
  return [
    "pb-section",
    tone === "soft" ? "pb-section--soft" : "",
    tone === "dark" ? "pb-section--dark" : "",
    `pb-section--${padding}`,
  ]
    .filter(Boolean)
    .join(" ");
}

function containerClass(width = "standard", align = "left") {
  return ["pb-container", `pb-container--${width}`, `pb-container--align-${align}`].join(
    " ",
  );
}

function asProps<T>(props: unknown) {
  return props as T;
}

function reusableBlockField(kind: "section" | "form") {
  return {
    type: "custom" as const,
    label: kind === "section" ? "Saved section" : "Saved form",
    render: ({
      value,
      onChange,
      readOnly,
    }: {
      value?: ReusableBlock | null;
      onChange: (value: ReusableBlock | null) => void;
      readOnly?: boolean;
    }) => (
      <ReusableBlockPicker
        kind={kind}
        onChange={onChange}
        readOnly={readOnly}
        value={value || null}
      />
    ),
  };
}

function renderSavedBlock(block?: ReusableBlock | null, label = "saved item") {
  if (!block?.data) {
    return <div className="pb-empty-state">Choose a {label} from the library.</div>;
  }

  return (
    <div className="pb-reusable">
      <Render
        config={puckConfig}
        data={{ root: { props: { title: block.name } }, content: [block.data] }}
      />
    </div>
  );
}

function textLines(value: string) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

// ── Datasource field helpers ───────────────────────────────────────────────

function dataSourceManagerField(kind: "display" | "sink") {
  return {
    type: "custom" as const,
    label: kind === "display" ? "Display datasources" : "Sink datasources",
    render: ({
      value,
      onChange,
    }: {
      value?: DataSourceDefinition[];
      onChange: (v: DataSourceDefinition[]) => void;
    }) => <DataSourceManager kind={kind} onChange={onChange} value={value} />,
  };
}

function dsBindingsField(bindableFields: string[]) {
  return {
    type: "custom" as const,
    label: "Field bindings",
    render: ({
      value,
      onChange,
    }: {
      value?: DsBindings;
      onChange: (v: DsBindings) => void;
    }) => (
      <DsBindingsFieldRenderer
        bindableFields={bindableFields}
        onChange={onChange}
        value={value}
      />
    ),
  };
}

function conditionalRuleField() {
  return {
    type: "custom" as const,
    label: "Condition",
    render: ({
      value,
      onChange,
      readOnly,
    }: {
      value?: ConditionalRule;
      onChange: (v: ConditionalRule) => void;
      readOnly?: boolean;
    }) => (
      <ConditionalRuleFieldRenderer
        onChange={onChange}
        readOnly={readOnly}
        value={value}
      />
    ),
  };
}

function formDataSinkField() {
  return {
    type: "custom" as const,
    label: "Datasource writeback",
    render: ({
      value,
      onChange,
      readOnly,
    }: {
      value?: FormDataSink;
      onChange: (v: FormDataSink) => void;
      readOnly?: boolean;
    }) => (
      <FormDataSinkFieldRenderer
        onChange={onChange}
        readOnly={readOnly}
        value={value}
      />
    ),
  };
}

type DynamicListProps = {
  source: string;
  titleField: string;
  bodyField: string;
  urlField: string;
  layout: "cards" | "table" | "list";
};

type ConditionalSwitchProps = {
  condition: ConditionalRule;
  whenTrue: Slot;
  whenFalse: Slot;
};

const defaultConditionalRule: ConditionalRule = {
  source: "",
  field: "",
  operator: "eq",
  value: "",
  predicate: "",
};

export const puckConfig: Config = {
  categories: {
    layout: {
      title: "Layout",
      components: [
        "Section",
        "Container",
        "Stack",
        "Columns",
        "Grid",
        "SplitSection",
        "Box",
        "Spacer",
        "Divider",
        "TwoColumn",
      ],
      defaultExpanded: true,
    },
    content: {
      title: "Content",
      components: [
        "Hero",
        "Heading",
        "RichText",
        "FeatureCard",
        "DynamicList",
        "ConditionalSwitch",
        "ButtonLink",
        "ImageBlock",
        "VideoEmbed",
        "Gallery",
        "QuoteBlock",
        "Testimonial",
        "Stats",
        "Faq",
        "TextList",
        "LogoStrip",
        "TableBlock",
        "Callout",
        "CodeBlock",
        "EmbedBlock",
      ],
      defaultExpanded: true,
    },
    library: {
      title: "Library",
      components: ["SavedSection", "SavedForm"],
      defaultExpanded: true,
    },
    forms: {
      title: "Forms",
      components: ["FormBlock"],
      defaultExpanded: true,
    },
  },
  root: {
    fields: {
      title: { type: "text", label: "Page title" },
      displaySources: dataSourceManagerField("display"),
    },
    defaultProps: {
      title: "Puck Studio Page",
      displaySources: [],
    },
    render: ({ children }: { children?: ReactNode }) => (
      <main className="pb-page">{children}</main>
    ),
  },
  components: {
    Hero: {
      label: "Hero",
      fields: {
        eyebrow: mergeTextField("Eyebrow", false),
        title: mergeTextField("Title"),
        body: mergeTextField("Body"),
        primaryLabel: mergeTextField("Primary label", false),
        primaryHref: { type: "text", label: "Primary URL" },
        secondaryLabel: mergeTextField("Secondary label", false),
        secondaryHref: { type: "text", label: "Secondary URL" },
        tone: {
          type: "radio",
          label: "Tone",
          options: [
            { label: "Light", value: "light" },
            { label: "Dark", value: "dark" },
          ],
        },
        _dsBindings: dsBindingsField(["eyebrow", "title", "body", "primaryLabel", "secondaryLabel"]),
      },
      defaultProps: {
        eyebrow: "Puck-native builder",
        title: "Design pages and forms without surrendering your codebase",
        body: "A real page-builder foundation with controlled components, responsive slots, publish flow, and portable HTML export.",
        primaryLabel: "Start editing",
        primaryHref: "/builder/pages/home",
        secondaryLabel: "View published",
        secondaryHref: "/p/home",
        tone: "light",
      } satisfies HeroProps,
      render: (props) => {
        const {
          eyebrow,
          title,
          body,
          primaryLabel,
          primaryHref,
          secondaryLabel,
          secondaryHref,
          tone,
        } = asProps<HeroProps>(props);

        return (
          <section className={tone === "dark" ? "pb-hero pb-hero--dark" : "pb-hero"}>
            <div className="pb-container pb-hero__grid">
              <div>
                {eyebrow ? <p className="pb-eyebrow">{renderMergeText(eyebrow)}</p> : null}
                <h1 className="pb-title">{renderMergeText(title)}</h1>
                {body ? <p className="pb-copy">{renderMergeText(body)}</p> : null}
                <div className="pb-actions">
                  {primaryLabel ? (
                    <a className="pb-button" href={safeLinkUrl(primaryHref)}>
                      {renderMergeText(primaryLabel)}
                    </a>
                  ) : null}
                  {secondaryLabel ? (
                    <a className="pb-button pb-button--secondary" href={safeLinkUrl(secondaryHref)}>
                      {renderMergeText(secondaryLabel)}
                    </a>
                  ) : null}
                </div>
              </div>
              <div aria-hidden="true" className="pb-visual" />
            </div>
          </section>
        );
      },
    },
    Section: {
      label: "Section",
      fields: {
        tone: {
          type: "select",
          label: "Tone",
          options: [
            { label: "White", value: "white" },
            { label: "Soft", value: "soft" },
            { label: "Dark", value: "dark" },
          ],
        },
        padding: {
          type: "select",
          label: "Padding",
          options: [
            { label: "Compact", value: "compact" },
            { label: "Normal", value: "normal" },
            { label: "Spacious", value: "spacious" },
          ],
        },
        width: {
          type: "select",
          label: "Inner width",
          options: [
            { label: "Narrow", value: "narrow" },
            { label: "Standard", value: "standard" },
            { label: "Wide", value: "wide" },
            { label: "Full", value: "full" },
          ],
        },
        align: {
          type: "select",
          label: "Content align",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
        },
        content: { type: "slot" },
      },
      defaultProps: {
        tone: "white",
        padding: "normal",
        width: "standard",
        align: "left",
        content: [
          {
            type: "Heading",
            props: {
              text: "A builder your product team can actually use",
              level: "h2",
            },
          },
          {
            type: "RichText",
            props: {
              text: "Use slots for nested layouts, constrained components for brand safety, and first-party JSON for every page and form.",
            },
          },
        ],
      },
      render: (props) => {
        const { tone, padding, width, align, content: Content } =
          asProps<SectionProps>(props);

        return (
          <section className={sectionClass(tone, padding)}>
            <div className={`${containerClass(width, align)} pb-stack`}>
              <Content />
            </div>
          </section>
        );
      },
    },
    Container: {
      label: "Container",
      fields: {
        width: {
          type: "select",
          label: "Width",
          options: [
            { label: "Narrow", value: "narrow" },
            { label: "Standard", value: "standard" },
            { label: "Wide", value: "wide" },
            { label: "Full", value: "full" },
          ],
        },
        align: {
          type: "select",
          label: "Align",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
        },
        content: { type: "slot" },
      },
      defaultProps: {
        width: "standard",
        align: "left",
        content: [
          {
            type: "RichText",
            props: {
              text: "Constrain nested content without creating another page section.",
            },
          },
        ],
      },
      render: (props) => {
        const { width, align, content: Content } = asProps<ContainerProps>(props);

        return (
          <div className={containerClass(width, align)}>
            <Content />
          </div>
        );
      },
    },
    Stack: {
      label: "Stack",
      fields: {
        gap: {
          type: "select",
          label: "Gap",
          options: [
            { label: "None", value: "none" },
            { label: "Small", value: "small" },
            { label: "Medium", value: "medium" },
            { label: "Large", value: "large" },
            { label: "Extra large", value: "xlarge" },
          ],
        },
        align: {
          type: "select",
          label: "Align",
          options: [
            { label: "Stretch", value: "stretch" },
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
        },
        content: { type: "slot" },
      },
      defaultProps: {
        gap: "medium",
        align: "stretch",
        content: [
          {
            type: "Heading",
            props: { text: "Stacked content", level: "h3" },
          },
          {
            type: "RichText",
            props: { text: "Use stack to control vertical rhythm inside sections." },
          },
        ],
      },
      render: (props) => {
        const { gap, align, content: Content } = asProps<StackProps>(props);

        return (
          <div className={`pb-stack-layout pb-stack-layout--${gap} pb-stack-layout--${align}`}>
            <Content />
          </div>
        );
      },
    },
    Columns: {
      label: "Columns",
      fields: {
        columns: {
          type: "select",
          label: "Columns",
          options: [
            { label: "2", value: "2" },
            { label: "3", value: "3" },
            { label: "4", value: "4" },
          ],
        },
        ratio: {
          type: "select",
          label: "Ratio",
          options: [
            { label: "Equal", value: "equal" },
            { label: "Sidebar left", value: "sidebarLeft" },
            { label: "Sidebar right", value: "sidebarRight" },
            { label: "Feature left", value: "featureLeft" },
            { label: "Feature right", value: "featureRight" },
          ],
        },
        gap: {
          type: "select",
          label: "Gap",
          options: [
            { label: "Small", value: "small" },
            { label: "Medium", value: "medium" },
            { label: "Large", value: "large" },
          ],
        },
        align: {
          type: "select",
          label: "Vertical align",
          options: [
            { label: "Start", value: "start" },
            { label: "Center", value: "center" },
            { label: "End", value: "end" },
            { label: "Stretch", value: "stretch" },
          ],
        },
        first: { type: "slot" },
        second: { type: "slot" },
        third: { type: "slot" },
        fourth: { type: "slot" },
      },
      defaultProps: {
        columns: "2",
        ratio: "equal",
        gap: "medium",
        align: "start",
        first: [{ type: "FeatureCard", props: { title: "First column", body: "Drop content here." } }],
        second: [{ type: "FeatureCard", props: { title: "Second column", body: "Drop content here." } }],
        third: [{ type: "FeatureCard", props: { title: "Third column", body: "Drop content here." } }],
        fourth: [{ type: "FeatureCard", props: { title: "Fourth column", body: "Drop content here." } }],
      },
      render: (props) => {
        const {
          columns,
          ratio,
          gap,
          align,
          first: First,
          second: Second,
          third: Third,
          fourth: Fourth,
        } = asProps<ColumnsProps>(props);
        const slots = [First, Second, Third, Fourth].slice(0, Number(columns));

        return (
          <div
            className={`pb-columns-layout pb-columns-layout--${columns} pb-columns-layout--${ratio} pb-layout-gap--${gap} pb-layout-align--${align}`}
          >
            {slots.map((Column, index) => (
              <div className="pb-column" key={index}>
                <Column />
              </div>
            ))}
          </div>
        );
      },
    },
    Grid: {
      label: "Grid",
      fields: {
        columns: {
          type: "select",
          label: "Columns",
          options: [
            { label: "2", value: "2" },
            { label: "3", value: "3" },
            { label: "4", value: "4" },
          ],
        },
        gap: {
          type: "select",
          label: "Gap",
          options: [
            { label: "Small", value: "small" },
            { label: "Medium", value: "medium" },
            { label: "Large", value: "large" },
          ],
        },
        content: { type: "slot" },
      },
      defaultProps: {
        columns: "3",
        gap: "medium",
        content: [
          { type: "FeatureCard", props: { title: "Grid item", body: "Drop repeated items here." } },
          { type: "FeatureCard", props: { title: "Grid item", body: "Drop repeated items here." } },
          { type: "FeatureCard", props: { title: "Grid item", body: "Drop repeated items here." } },
        ],
      },
      render: (props) => {
        const { columns, gap, content: Content } = asProps<GridProps>(props);

        return (
          <div className={`pb-grid-layout pb-grid-layout--${columns} pb-layout-gap--${gap}`}>
            <Content />
          </div>
        );
      },
    },
    SplitSection: {
      label: "Split section",
      fields: {
        tone: {
          type: "select",
          label: "Tone",
          options: [
            { label: "White", value: "white" },
            { label: "Soft", value: "soft" },
            { label: "Dark", value: "dark" },
          ],
        },
        mediaSide: {
          type: "radio",
          label: "Media side",
          options: [
            { label: "Left", value: "left" },
            { label: "Right", value: "right" },
          ],
        },
        ratio: {
          type: "select",
          label: "Ratio",
          options: [
            { label: "Equal", value: "equal" },
            { label: "Media wide", value: "mediaWide" },
            { label: "Content wide", value: "contentWide" },
          ],
        },
        content: { type: "slot" },
        media: { type: "slot" },
      },
      defaultProps: {
        tone: "soft",
        mediaSide: "right",
        ratio: "equal",
        content: [
          { type: "Heading", props: { text: "A composed split section", level: "h2" } },
          { type: "RichText", props: { text: "Use this for editorial/product layouts with text on one side and media or forms on the other." } },
        ],
        media: [{ type: "Box", props: { surface: "card", padding: "large", content: [{ type: "RichText", props: { text: "Media, form, or nested layout area" } }] } }],
      },
      render: (props) => {
        const { tone, mediaSide, ratio, content: Content, media: Media } =
          asProps<SplitSectionProps>(props);

        return (
          <section className={sectionClass(tone, "normal")}>
            <div
              className={`pb-container pb-split pb-split--${ratio} pb-split--media-${mediaSide}`}
            >
              <div className="pb-split__content">
                <Content />
              </div>
              <div className="pb-split__media">
                <Media />
              </div>
            </div>
          </section>
        );
      },
    },
    Box: {
      label: "Box",
      fields: {
        surface: {
          type: "select",
          label: "Surface",
          options: [
            { label: "Plain", value: "plain" },
            { label: "Card", value: "card" },
            { label: "Soft", value: "soft" },
            { label: "Dark", value: "dark" },
            { label: "Outline", value: "outline" },
          ],
        },
        padding: {
          type: "select",
          label: "Padding",
          options: [
            { label: "None", value: "none" },
            { label: "Small", value: "small" },
            { label: "Medium", value: "medium" },
            { label: "Large", value: "large" },
          ],
        },
        content: { type: "slot" },
      },
      defaultProps: {
        surface: "card",
        padding: "medium",
        content: [{ type: "RichText", props: { text: "Box content" } }],
      },
      render: (props) => {
        const { surface, padding, content: Content } = asProps<BoxProps>(props);

        return (
          <div className={`pb-box pb-box--${surface} pb-box--padding-${padding}`}>
            <Content />
          </div>
        );
      },
    },
    Spacer: {
      label: "Spacer",
      fields: {
        size: {
          type: "select",
          label: "Size",
          options: [
            { label: "Small", value: "small" },
            { label: "Medium", value: "medium" },
            { label: "Large", value: "large" },
            { label: "Extra large", value: "xlarge" },
          ],
        },
      },
      defaultProps: { size: "medium" },
      render: (props) => {
        const { size } = asProps<SpacerProps>(props);

        return <div aria-hidden="true" className={`pb-spacer pb-spacer--${size}`} />;
      },
    },
    Divider: {
      label: "Divider",
      fields: {
        tone: {
          type: "select",
          label: "Tone",
          options: [
            { label: "Light", value: "light" },
            { label: "Dark", value: "dark" },
            { label: "Accent", value: "accent" },
          ],
        },
        inset: {
          type: "radio",
          label: "Inset",
          options: [
            { label: "None", value: "none" },
            { label: "Container", value: "container" },
          ],
        },
      },
      defaultProps: { tone: "light", inset: "none" },
      render: (props) => {
        const { tone, inset } = asProps<DividerProps>(props);
        const divider = <hr className={`pb-section-divider pb-section-divider--${tone}`} />;

        return inset === "container" ? <div className="pb-container">{divider}</div> : divider;
      },
    },
    TwoColumn: {
      label: "Two columns",
      fields: {
        left: { type: "slot" },
        right: { type: "slot" },
      },
      defaultProps: {
        left: [
          {
            type: "FeatureCard",
            props: {
              title: "Controlled layout",
              body: "Authors can compose pages freely while the system keeps spacing, typography, and markup exportable.",
            },
          },
        ],
        right: [
          {
            type: "FeatureCard",
            props: {
              title: "Puck form design",
              body: "Forms are modeled as first-party schema and edited inside the same visual builder.",
            },
          },
        ],
      },
      render: (props) => {
        const { left: Left, right: Right } = asProps<{ left: Slot; right: Slot }>(props);

        return (
          <div className="pb-columns">
            <Left />
            <Right />
          </div>
        );
      },
    },
    Heading: {
      label: "Heading",
      fields: {
        text: mergeTextField("Text"),
        level: {
          type: "select",
          label: "Level",
          options: [
            { label: "H2", value: "h2" },
            { label: "H3", value: "h3" },
          ],
        },
        _dsBindings: dsBindingsField(["text"]),
      },
      defaultProps: {
        text: "Build with useful constraints",
        level: "h2",
      },
      render: (props) => {
        const { text, level } = asProps<{ text: string; level: "h2" | "h3" }>(props);

        return level === "h3" ? (
          <h3 className="pb-heading">{renderMergeText(text)}</h3>
        ) : (
          <h2 className="pb-heading">{renderMergeText(text)}</h2>
        );
      },
    },
    RichText: {
      label: "Rich text",
      fields: {
        text: richTextField("Text"),
      },
      defaultProps: {
        text: "<p>Replace this copy with the page content. Use formatting, links, lists, quotes, and merge tags for real editorial work.</p>",
      },
      render: (props) => {
        const { text } = asProps<{ text: string | ReactNode }>(props);

        return (
          <div className="pb-rich-text">
            {typeof text === "string" ? renderMergeText(text) : text}
          </div>
        );
      },
    },
    FeatureCard: {
      label: "Feature card",
      fields: {
        title: mergeTextField("Title", false),
        body: mergeTextField("Body"),
        _dsBindings: dsBindingsField(["title", "body"]),
      },
      defaultProps: {
        title: "Production shape",
        body: "The builder stores clean JSON, renders React, and exports portable HTML on publish.",
      },
      render: (props) => {
        const { title, body } = asProps<{ title: string; body: string }>(props);

        return (
          <article className="pb-card">
            <h3 className="pb-card__title">{renderMergeText(title)}</h3>
            <p className="pb-card__body">{renderMergeText(body)}</p>
          </article>
        );
      },
    },
    ButtonLink: {
      label: "Button link",
      fields: {
        label: mergeTextField("Label", false),
        href: { type: "text", label: "URL" },
        variant: {
          type: "radio",
          label: "Variant",
          options: [
            { label: "Primary", value: "primary" },
            { label: "Secondary", value: "secondary" },
          ],
        },
      },
      defaultProps: {
        label: "Continue",
        href: "#",
        variant: "primary",
      },
      render: (props) => {
        const { label, href, variant } = asProps<{
          label: string;
          href: string;
          variant: "primary" | "secondary";
        }>(props);

        return (
          <a
            className={
              variant === "secondary" ? "pb-button pb-button--secondary" : "pb-button"
            }
            href={safeLinkUrl(href)}
          >
            {renderMergeText(label)}
          </a>
        );
      },
    },
    ImageBlock: {
      label: "Image",
      fields: {
        src: { type: "text", label: "Image URL" },
        alt: mergeTextField("Alt text", false),
        caption: mergeTextField("Caption"),
        aspect: {
          type: "select",
          label: "Aspect",
          options: [
            { label: "Auto", value: "auto" },
            { label: "Wide", value: "wide" },
            { label: "Square", value: "square" },
            { label: "Portrait", value: "portrait" },
          ],
        },
      },
      defaultProps: { src: "", alt: "Image", caption: "", aspect: "wide" } satisfies ImageBlockProps,
      render: (props) => {
        const { src, alt, caption, aspect } = asProps<ImageBlockProps>(props);
        const safeSrc = safeMediaUrl(src);

        return (
          <figure className={`pb-image pb-image--${aspect}`}>
            {safeSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={alt} src={safeSrc} />
            ) : (
              <div className="pb-media-placeholder">Image</div>
            )}
            {caption ? <figcaption>{renderMergeText(caption)}</figcaption> : null}
          </figure>
        );
      },
    },
    VideoEmbed: {
      label: "Video",
      fields: {
        title: mergeTextField("Title", false),
        url: { type: "text", label: "Embed URL" },
        caption: mergeTextField("Caption"),
      },
      defaultProps: {
        title: "Product walkthrough",
        url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        caption: "Replace the URL with a YouTube, Vimeo, or hosted embed URL.",
      } satisfies VideoEmbedProps,
      render: (props) => {
        const { title, url, caption } = asProps<VideoEmbedProps>(props);
        const safeUrl = safeMediaUrl(url);

        return (
          <figure className="pb-video">
            <div className="pb-video__frame">
              {safeUrl ? (
                <iframe
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  src={safeUrl}
                  title={title}
                />
              ) : (
                <div className="pb-media-placeholder">Video</div>
              )}
            </div>
            {caption ? <figcaption>{renderMergeText(caption)}</figcaption> : null}
          </figure>
        );
      },
    },
    Gallery: {
      label: "Gallery",
      fields: {
        imageOne: { type: "text", label: "Image 1 URL" },
        imageTwo: { type: "text", label: "Image 2 URL" },
        imageThree: { type: "text", label: "Image 3 URL" },
        imageFour: { type: "text", label: "Image 4 URL" },
        caption: mergeTextField("Caption"),
      },
      defaultProps: {
        imageOne: "",
        imageTwo: "",
        imageThree: "",
        imageFour: "",
        caption: "A simple responsive gallery.",
      } satisfies GalleryProps,
      render: (props) => {
        const { imageOne, imageTwo, imageThree, imageFour, caption } =
          asProps<GalleryProps>(props);
        const images = [imageOne, imageTwo, imageThree, imageFour].map((src) =>
          safeMediaUrl(src),
        );

        return (
          <figure className="pb-gallery">
            <div className="pb-gallery__grid">
              {images.map((src, index) =>
                src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={`Gallery image ${index + 1}`} key={index} src={src} />
                ) : (
                  <div className="pb-media-placeholder" key={index}>
                    Image {index + 1}
                  </div>
                ),
              )}
            </div>
            {caption ? <figcaption>{renderMergeText(caption)}</figcaption> : null}
          </figure>
        );
      },
    },
    QuoteBlock: {
      label: "Quote",
      fields: {
        quote: mergeTextField("Quote"),
        author: mergeTextField("Author", false),
        role: mergeTextField("Role", false),
      },
      defaultProps: {
        quote: "The builder is opinionated where the brand needs guardrails and flexible where teams need speed.",
        author: "Maya Chen",
        role: "Product lead",
      } satisfies QuoteBlockProps,
      render: (props) => {
        const { quote, author, role } = asProps<QuoteBlockProps>(props);

        return (
          <figure className="pb-quote">
            <blockquote>{renderMergeText(quote)}</blockquote>
            {author || role ? (
              <figcaption>
                {author ? <strong>{renderMergeText(author)}</strong> : null}
                {role ? <span>{renderMergeText(role)}</span> : null}
              </figcaption>
            ) : null}
          </figure>
        );
      },
    },
    Testimonial: {
      label: "Testimonial",
      fields: {
        quote: mergeTextField("Quote"),
        name: mergeTextField("Name", false),
        role: mergeTextField("Role", false),
        avatarUrl: { type: "text", label: "Avatar URL" },
      },
      defaultProps: {
        quote: "We can publish campaign pages and lead forms without waiting for a sprint.",
        name: "Jordan Lee",
        role: "Growth operations",
        avatarUrl: "",
      } satisfies TestimonialProps,
      render: (props) => {
        const { quote, name, role, avatarUrl } = asProps<TestimonialProps>(props);
        const avatar = safeMediaUrl(avatarUrl);

        return (
          <article className="pb-testimonial">
            <p>{renderMergeText(quote)}</p>
            <div className="pb-testimonial__person">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={avatar} />
              ) : (
                <span aria-hidden="true">{name ? name.slice(0, 1).toUpperCase() : "T"}</span>
              )}
              <div>
                <strong>{renderMergeText(name)}</strong>
                <small>{renderMergeText(role)}</small>
              </div>
            </div>
          </article>
        );
      },
    },
    Stats: {
      label: "Stats",
      fields: {
        statOneValue: mergeTextField("Stat 1 value", false),
        statOneLabel: mergeTextField("Stat 1 label", false),
        statTwoValue: mergeTextField("Stat 2 value", false),
        statTwoLabel: mergeTextField("Stat 2 label", false),
        statThreeValue: mergeTextField("Stat 3 value", false),
        statThreeLabel: mergeTextField("Stat 3 label", false),
      },
      defaultProps: {
        statOneValue: "3x",
        statOneLabel: "faster launches",
        statTwoValue: "0",
        statTwoLabel: "vendor lock-in",
        statThreeValue: "100%",
        statThreeLabel: "portable HTML",
      } satisfies StatsProps,
      render: (props) => {
        const typed = asProps<StatsProps>(props);
        const stats = [
          [typed.statOneValue, typed.statOneLabel],
          [typed.statTwoValue, typed.statTwoLabel],
          [typed.statThreeValue, typed.statThreeLabel],
        ];

        return (
          <div className="pb-stats">
            {stats.map(([value, label], index) => (
              <div className="pb-stat" key={index}>
                <strong>{renderMergeText(value)}</strong>
                <span>{renderMergeText(label)}</span>
              </div>
            ))}
          </div>
        );
      },
    },
    Faq: {
      label: "FAQ",
      fields: {
        questionOne: mergeTextField("Question 1", false),
        answerOne: mergeTextField("Answer 1"),
        questionTwo: mergeTextField("Question 2", false),
        answerTwo: mergeTextField("Answer 2"),
        questionThree: mergeTextField("Question 3", false),
        answerThree: mergeTextField("Answer 3"),
      },
      defaultProps: {
        questionOne: "Can this export HTML?",
        answerOne: "Yes. The page exports portable markup with the shared builder CSS inlined.",
        questionTwo: "Can forms be reused?",
        answerTwo: "Yes. Save a form to the library, then insert it as a saved form component.",
        questionThree: "Can text use merge tags?",
        answerThree: "Yes. Merge tags are available in the supported editorial fields.",
      } satisfies FaqProps,
      render: (props) => {
        const typed = asProps<FaqProps>(props);
        const faqs = [
          [typed.questionOne, typed.answerOne],
          [typed.questionTwo, typed.answerTwo],
          [typed.questionThree, typed.answerThree],
        ];

        return (
          <div className="pb-faq">
            {faqs.map(([question, answer], index) => (
              <details key={index} open={index === 0}>
                <summary>{renderMergeText(question)}</summary>
                <p>{renderMergeText(answer)}</p>
              </details>
            ))}
          </div>
        );
      },
    },
    TextList: {
      label: "List",
      fields: {
        title: mergeTextField("Title", false),
        items: mergeTextField("Items"),
        style: {
          type: "radio",
          label: "Style",
          options: [
            { label: "Bullets", value: "bullets" },
            { label: "Checks", value: "checks" },
            { label: "Numbers", value: "numbers" },
          ],
        },
      },
      defaultProps: {
        title: "Included",
        items: "Reusable content blocks\nForm schema storage\nMSSQL-backed page data",
        style: "checks",
      } satisfies TextListProps,
      render: (props) => {
        const { title, items, style } = asProps<TextListProps>(props);
        const Tag = style === "numbers" ? "ol" : "ul";

        return (
          <div className={`pb-text-list pb-text-list--${style}`}>
            {title ? <h3>{renderMergeText(title)}</h3> : null}
            <Tag>
              {textLines(items).map((item, index) => (
                <li key={index}>{renderMergeText(item)}</li>
              ))}
            </Tag>
          </div>
        );
      },
    },
    LogoStrip: {
      label: "Logo strip",
      fields: {
        title: mergeTextField("Title", false),
        logos: mergeTextField("Names"),
      },
      defaultProps: {
        title: "Trusted by teams shipping faster",
        logos: "Northstar\nAcme Cloud\nVertex\nOrbit Labs",
      } satisfies LogoStripProps,
      render: (props) => {
        const { title, logos } = asProps<LogoStripProps>(props);

        return (
          <div className="pb-logo-strip">
            {title ? <p>{renderMergeText(title)}</p> : null}
            <div>
              {textLines(logos).map((logo) => (
                <span key={logo}>{renderMergeText(logo)}</span>
              ))}
            </div>
          </div>
        );
      },
    },
    TableBlock: {
      label: "Table",
      fields: {
        caption: mergeTextField("Caption", false),
        rows: { type: "textarea", label: "Rows" },
      },
      defaultProps: {
        caption: "Plan comparison",
        rows: "Capability | Starter | Pro\nPages | 5 | Unlimited\nForms | Basic | Advanced",
      } satisfies TableBlockProps,
      render: (props) => {
        const { caption, rows } = asProps<TableBlockProps>(props);
        const tableRows = textLines(rows).map((row) => row.split("|").map((cell) => cell.trim()));
        const [header, ...body] = tableRows;

        return (
          <div className="pb-table-wrap">
            <table className="pb-table">
              {caption ? <caption>{renderMergeText(caption)}</caption> : null}
              {header ? (
                <thead>
                  <tr>
                    {header.map((cell, index) => (
                      <th key={index}>{renderMergeText(cell)}</th>
                    ))}
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {body.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{renderMergeText(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      },
    },
    Callout: {
      label: "Callout",
      fields: {
        title: mergeTextField("Title", false),
        body: mergeTextField("Body"),
        tone: {
          type: "select",
          label: "Tone",
          options: [
            { label: "Info", value: "info" },
            { label: "Success", value: "success" },
            { label: "Warning", value: "warning" },
            { label: "Dark", value: "dark" },
          ],
        },
        _dsBindings: dsBindingsField(["title", "body"]),
      },
      defaultProps: {
        title: "Operational note",
        body: "Saved blocks are stored as Puck JSON snapshots so they can render and export independently.",
        tone: "info",
      } satisfies CalloutProps,
      render: (props) => {
        const { title, body, tone } = asProps<CalloutProps>(props);

        return (
          <aside className={`pb-callout pb-callout--${tone}`}>
            <strong>{renderMergeText(title)}</strong>
            <p>{renderMergeText(body)}</p>
          </aside>
        );
      },
    },
    CodeBlock: {
      label: "Code",
      fields: {
        language: { type: "text", label: "Language" },
        code: { type: "textarea", label: "Code" },
      },
      defaultProps: {
        language: "html",
        code: "<section>\n  <h1>Portable export</h1>\n</section>",
      } satisfies CodeBlockProps,
      render: (props) => {
        const { language, code } = asProps<CodeBlockProps>(props);

        return (
          <figure className="pb-code">
            <figcaption>{language}</figcaption>
            <pre>
              <code>{code}</code>
            </pre>
          </figure>
        );
      },
    },
    EmbedBlock: {
      label: "Embed",
      fields: {
        title: mergeTextField("Title", false),
        url: { type: "text", label: "Embed URL" },
        height: { type: "text", label: "Height" },
      },
      defaultProps: {
        title: "Embedded content",
        url: "",
        height: "420",
      } satisfies EmbedBlockProps,
      render: (props) => {
        const { title, url, height } = asProps<EmbedBlockProps>(props);
        const safeUrl = safeMediaUrl(url);
        const frameHeight = Number(height) || 420;
        const style = { "--pb-embed-height": `${frameHeight}px` } as CSSProperties;

        return (
          <div className="pb-embed" style={style}>
            {safeUrl ? (
              <iframe src={safeUrl} title={title} />
            ) : (
              <div className="pb-media-placeholder">Embed</div>
            )}
          </div>
        );
      },
    },
    DynamicList: {
      label: "Dynamic list",
      fields: {
        source: {
          type: "text",
          label: "Datasource name",
        },
        layout: {
          type: "select",
          label: "Layout",
          options: [
            { label: "Cards", value: "cards" },
            { label: "Table", value: "table" },
            { label: "List", value: "list" },
          ],
        },
        titleField: { type: "text", label: "Title field" },
        bodyField:  { type: "text", label: "Body field" },
        urlField:   { type: "text", label: "URL field (optional)" },
      },
      defaultProps: {
        source: "",
        layout: "cards",
        titleField: "title",
        bodyField: "body",
        urlField: "",
      } satisfies DynamicListProps,
      render: (props) => {
        const { source, layout, titleField } = asProps<DynamicListProps>(props);
        if (!source) {
          return (
            <div className="pb-empty-state">
              Configure a datasource name in the list settings.
            </div>
          );
        }
        return (
          <div
            className={layout === "table" ? "pb-table-wrap" : "pb-card-grid"}
            style={{ padding: "12px", border: "1px dashed #1b6dff", borderRadius: "8px" }}
          >
            <p style={{ fontSize: "12px", color: "#5f6368", marginBottom: "8px" }}>
              Dynamic list · source: <strong>{source}</strong> · field: {titleField}
            </p>
            {layout === "table" ? (
              <table className="pb-table" style={{ width: "100%" }}>
                <tbody>
                  {[1, 2, 3].map((i) => (
                    <tr key={i}>
                      <td style={{ padding: "6px", background: "#f5f7fa" }}>Row {i}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              [1, 2, 3].map((i) => (
                <article className="pb-card" key={i} style={{ opacity: 0.5 }}>
                  <h3 className="pb-card__title">Item {i}</h3>
                  <p className="pb-card__body">Placeholder row</p>
                </article>
              ))
            )}
          </div>
        );
      },
    },
    ConditionalSwitch: {
      label: "If / else",
      fields: {
        condition: conditionalRuleField(),
        whenTrue: { type: "slot" },
        whenFalse: { type: "slot" },
      },
      defaultProps: {
        condition: defaultConditionalRule,
        whenTrue: [
          {
            type: "Callout",
            props: {
              title: "Condition matched",
              body: "This content renders when the datasource query evaluates to true.",
              tone: "success",
            },
          },
        ],
        whenFalse: [
          {
            type: "Callout",
            props: {
              title: "Condition did not match",
              body: "This branch renders when the datasource query evaluates to false.",
              tone: "warning",
            },
          },
        ],
      },
      render: (props) => {
        const {
          condition,
          whenTrue: WhenTrue,
          whenFalse: WhenFalse,
        } = asProps<ConditionalSwitchProps>(props);
        const hasSource = Boolean(condition?.source);
        const summary = hasSource
          ? `${condition.source} :: ${condition.predicate || "x => x.field == \"value\""}`
          : "Add a datasource and predicate in block settings.";

        return (
          <section className="pb-conditional">
            <p className="pb-conditional__meta">{summary}</p>
            <div className="pb-conditional__branch">
              <span className="pb-conditional__label">If true</span>
              <WhenTrue />
            </div>
            <div className="pb-conditional__branch pb-conditional__branch--else">
              <span className="pb-conditional__label">Else</span>
              <WhenFalse />
            </div>
          </section>
        );
      },
    },
    SavedSection: {
      label: "Saved section",
      fields: {
        block: reusableBlockField("section"),
      },
      defaultProps: {
        block: null,
      } satisfies SavedBlockProps,
      render: (props) => {
        const { block } = asProps<SavedBlockProps>(props);
        return renderSavedBlock(block, "section");
      },
    },
    SavedForm: {
      label: "Saved form",
      fields: {
        block: reusableBlockField("form"),
      },
      defaultProps: {
        block: null,
      } satisfies SavedBlockProps,
      render: (props) => {
        const { block } = asProps<SavedBlockProps>(props);
        return renderSavedBlock(block, "form");
      },
    },
    FormBlock: {
      label: "Form designer",
      fields: {
        title: { type: "text", label: "Title" },
        description: { type: "textarea", label: "Description" },
        actionUrl: { type: "text", label: "Relay URL" },
        relayMethod: {
          type: "radio",
          label: "Relay method",
          options: [
            { label: "POST", value: "post" },
            { label: "GET", value: "get" },
          ],
        },
        dataSink: formDataSinkField(),
        layout: {
          type: "select",
          label: "Field layout",
          options: [
            { label: "Stacked", value: "stacked" },
            { label: "Two column", value: "two" },
            { label: "Three column", value: "three" },
          ],
        },
        width: {
          type: "select",
          label: "Form width",
          options: [
            { label: "Narrow", value: "narrow" },
            { label: "Standard", value: "standard" },
            { label: "Wide", value: "wide" },
            { label: "Full", value: "full" },
          ],
        },
        surface: {
          type: "select",
          label: "Surface",
          options: [
            { label: "Plain", value: "plain" },
            { label: "Card", value: "card" },
            { label: "Soft", value: "soft" },
            { label: "Dark", value: "dark" },
          ],
        },
        controlStyle: {
          type: "select",
          label: "Input style",
          options: [
            { label: "Outline", value: "outline" },
            { label: "Filled", value: "filled" },
            { label: "Underline", value: "underline" },
          ],
        },
        density: {
          type: "select",
          label: "Density",
          options: [
            { label: "Compact", value: "compact" },
            { label: "Comfortable", value: "comfortable" },
            { label: "Spacious", value: "spacious" },
          ],
        },
        submitLabel: { type: "text", label: "Submit label" },
        submitAlign: {
          type: "select",
          label: "Submit alignment",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
        },
        submitWidth: {
          type: "radio",
          label: "Submit width",
          options: [
            { label: "Auto", value: "auto" },
            { label: "Full", value: "full" },
          ],
        },
        successMessage: { type: "text", label: "Success message" },
        fields: {
          type: "custom",
          label: "Fields",
          render: ({ value, onChange, readOnly }) => (
            <FormDesignerModalField
              onChange={onChange}
              readOnly={readOnly}
              value={(value || []) as FormField[]}
            />
          ),
        },
      },
      defaultProps: {
        ...defaultFormProps,
        fields: [
          {
            label: "Tell us about the project",
            name: "",
            type: "heading",
            width: "full",
            placeholder: "",
            required: false,
            helpText: "Use heading, paragraph, and divider rows to structure longer forms.",
            defaultValue: "",
            rows: 4,
            options: "",
          },
          {
            label: "Work email",
            name: "email",
            type: "email",
            width: "half",
            placeholder: "you@company.com",
            required: true,
            helpText: "",
            defaultValue: "",
            rows: 4,
            options: "",
          },
          {
            label: "Phone",
            name: "phone",
            type: "tel",
            width: "half",
            placeholder: "+1 555 0100",
            required: false,
            helpText: "Optional, but useful for urgent timelines.",
            defaultValue: "",
            rows: 4,
            options: "",
          },
          {
            label: "Project type",
            name: "project_type",
            type: "select",
            width: "half",
            placeholder: "Choose one",
            required: true,
            helpText: "",
            defaultValue: "",
            rows: 4,
            options: "Landing page\nWebsite\nInternal tool\nCampaign form",
          },
          {
            label: "Budget range",
            name: "budget_range",
            type: "radio",
            width: "half",
            placeholder: "",
            required: true,
            helpText: "",
            defaultValue: "$10k-$25k",
            rows: 4,
            options: "$5k-$10k\n$10k-$25k\n$25k+",
          },
          {
            label: "What should this builder do?",
            name: "brief",
            type: "textarea",
            width: "full",
            placeholder: "Tell us the workflow",
            required: false,
            helpText: "Include integrations, publishing needs, and form behavior.",
            defaultValue: "",
            rows: 5,
            options: "",
          },
          {
            label: "I agree to be contacted about this request.",
            name: "consent",
            type: "checkbox",
            width: "full",
            placeholder: "",
            required: true,
            helpText: "",
            defaultValue: "",
            rows: 4,
            options: "",
          },
        ],
      } satisfies FormBlockProps,
      render: (props) => <FormBlock {...asProps<FormBlockProps>(props)} />,
    },
  },
};
