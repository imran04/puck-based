import type { ReactNode } from "react";
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
} from "./form-schema";

export type { FormBlockProps, FormField, FormFieldType } from "./form-schema";

function helpId(baseId: string, field: FormField) {
  return field.helpText ? `${baseId}_help` : undefined;
}

function renderHelp(field: FormField, id?: string) {
  return field.helpText ? (
    <span className="pb-help" id={id}>
      {field.helpText}
    </span>
  ) : null;
}

function renderOptions(
  field: FormField,
  name: string,
  id: string,
  required: boolean,
  type: "radio" | "checkbox",
) {
  const selected = parseOptions(field.defaultValue);

  return (
    <div className="pb-choice-list">
      {parseOptions(field.options).map((option, optionIndex) => {
        const optionId = `${id}_${optionIndex}`;
        const value = option;

        return (
          <label className="pb-choice" key={optionId} htmlFor={optionId}>
            <input
              defaultChecked={selected.includes(value)}
              id={optionId}
              name={type === "checkbox" ? `${name}[]` : name}
              required={type === "radio" ? required : false}
              type={type}
              value={value}
            />
            <span>{option}</span>
          </label>
        );
      })}
    </div>
  );
}

function renderLayoutField(field: FormField, index: number, layout?: FormLayout) {
  const key = `${field.type}_${field.label}_${index}`;

  if (field.type === "heading") {
    return (
      <div className={`${fieldClassName(field, layout)} pb-form-copy`} key={key}>
        <h3>{field.label || "Section heading"}</h3>
        {field.helpText ? <p>{field.helpText}</p> : null}
      </div>
    );
  }

  if (field.type === "paragraph") {
    return (
      <div className={`${fieldClassName(field, layout)} pb-form-copy`} key={key}>
        <p>{field.label || field.helpText}</p>
      </div>
    );
  }

  if (field.type === "divider") {
    return <hr className={`${fieldClassName(field, layout)} pb-divider`} key={key} />;
  }

  return null;
}

function renderField(field: FormField, index: number, layout?: FormLayout): ReactNode {
  const layoutField = renderLayoutField(field, index, layout);

  if (layoutField) {
    return layoutField;
  }

  const name = normalizeName(field.name || field.label, `field_${index + 1}`);
  const id = `form_${name}_${index}`;
  const required = Boolean(field.required);
  const descriptionId = helpId(id, field);
  const commonProps = {
    id,
    name,
    required,
    placeholder: field.placeholder || undefined,
    defaultValue: field.defaultValue || undefined,
    "aria-describedby": descriptionId,
  };

  if (field.type === "hidden") {
    return (
      <input
        defaultValue={field.defaultValue || ""}
        key={id}
        name={name}
        type="hidden"
      />
    );
  }

  if (field.type === "textarea") {
    return (
      <label className={fieldClassName(field, layout)} key={id} htmlFor={id}>
        <span className="pb-label">
          {field.label}
          {required ? " *" : ""}
        </span>
        <textarea
          className="pb-textarea"
          rows={field.rows || 4}
          {...commonProps}
        />
        {renderHelp(field, descriptionId)}
      </label>
    );
  }

  if (field.type === "select") {
    const options = parseOptions(field.options);

    return (
      <label className={fieldClassName(field, layout)} key={id} htmlFor={id}>
        <span className="pb-label">
          {field.label}
          {required ? " *" : ""}
        </span>
        <select
          aria-describedby={descriptionId}
          className="pb-select"
          defaultValue={field.defaultValue || ""}
          id={id}
          name={name}
          required={required}
        >
          <option value="">{field.placeholder || "Select an option"}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {renderHelp(field, descriptionId)}
      </label>
    );
  }

  if (field.type === "radio" || field.type === "checkboxGroup") {
    const choiceType = field.type === "radio" ? "radio" : "checkbox";

    return (
      <fieldset
        aria-describedby={descriptionId}
        className={`${fieldClassName(field, layout)} pb-choice-field`}
        key={id}
      >
        <legend className="pb-label">
          {field.label}
          {required ? " *" : ""}
        </legend>
        {renderOptions(field, name, id, required, choiceType)}
        {renderHelp(field, descriptionId)}
      </fieldset>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className={`${fieldClassName(field, layout)} pb-checkbox-row`} key={id}>
        <input
          defaultChecked={field.defaultValue === "true"}
          id={id}
          name={name}
          required={required}
          type="checkbox"
          value="true"
        />
        <span>
          {field.label}
          {required ? " *" : ""}
          {field.helpText ? <small>{field.helpText}</small> : null}
        </span>
      </label>
    );
  }

  const inputType = ["email", "tel", "number", "date", "file"].includes(field.type)
    ? field.type
    : "text";

  return (
    <label className={fieldClassName(field, layout)} key={id} htmlFor={id}>
      <span className="pb-label">
        {field.label}
        {required ? " *" : ""}
      </span>
      <input
        className="pb-input"
        type={inputType}
        {...(inputType === "file" ? { ...commonProps, defaultValue: undefined } : commonProps)}
      />
      {renderHelp(field, descriptionId)}
    </label>
  );
}

export function FormBlock({
  title,
  description,
  actionUrl,
  relayMethod,
  fields,
  submitLabel,
  layout,
  width,
  surface,
  controlStyle,
  density,
  submitAlign,
  submitWidth,
}: FormBlockProps) {
  const mergedProps = {
    layout: layout || defaultFormProps.layout,
    width: width || defaultFormProps.width,
    surface: surface || defaultFormProps.surface,
    controlStyle: controlStyle || defaultFormProps.controlStyle,
    density: density || defaultFormProps.density,
    submitAlign: submitAlign || defaultFormProps.submitAlign,
    submitWidth: submitWidth || defaultFormProps.submitWidth,
  };

  return (
    <form
      action="/api/forms/submit"
      className={formClassName(mergedProps)}
      method="post"
    >
      <input name="_formTitle" type="hidden" value={title} />
      <input name="_pbRelayUrl" type="hidden" value={actionUrl || ""} />
      <input name="_pbRelayMethod" type="hidden" value={relayMethod || "post"} />
      <div>
        <h2 className="pb-form__title">{title}</h2>
        {description ? (
          <p className="pb-form__description">{description}</p>
        ) : null}
      </div>
      <div className={fieldsClassName(mergedProps)}>
        {(fields || []).map((field, index) =>
          renderField(field, index, mergedProps.layout),
        )}
      </div>
      <div className={footerClassName(mergedProps)}>
        <button className="pb-submit" type="submit">
          {submitLabel || "Submit"}
        </button>
      </div>
    </form>
  );
}
