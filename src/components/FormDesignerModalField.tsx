"use client";

import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  normalizeName,
  type FormField,
  type FormFieldType,
  type FormFieldWidth,
} from "@/puck/form-schema";

type FormDesignerModalFieldProps = {
  value?: FormField[];
  onChange: (value: FormField[]) => void;
  readOnly?: boolean;
};

const fieldTypes: Array<{ label: string; value: FormFieldType }> = [
  { label: "Text", value: "text" },
  { label: "Email", value: "email" },
  { label: "Phone", value: "tel" },
  { label: "Number", value: "number" },
  { label: "Date", value: "date" },
  { label: "File", value: "file" },
  { label: "Textarea", value: "textarea" },
  { label: "Select", value: "select" },
  { label: "Radio group", value: "radio" },
  { label: "Checkbox", value: "checkbox" },
  { label: "Checkbox group", value: "checkboxGroup" },
  { label: "Hidden", value: "hidden" },
  { label: "Section heading", value: "heading" },
  { label: "Paragraph", value: "paragraph" },
  { label: "Divider", value: "divider" },
];

const widths: Array<{ label: string; value: FormFieldWidth }> = [
  { label: "Auto", value: "auto" },
  { label: "Full", value: "full" },
  { label: "Half", value: "half" },
  { label: "Third", value: "third" },
  { label: "Two thirds", value: "twoThirds" },
];

function createField(type: FormFieldType, index: number): FormField {
  const labelByType: Record<FormFieldType, string> = {
    text: "Text field",
    email: "Email",
    tel: "Phone",
    number: "Number",
    date: "Date",
    file: "Upload",
    textarea: "Long answer",
    select: "Select one",
    radio: "Choose one",
    checkbox: "Consent checkbox",
    checkboxGroup: "Choose many",
    hidden: "Hidden value",
    heading: "Section heading",
    paragraph: "Helpful copy",
    divider: "Divider",
  };
  const label = labelByType[type];
  const machineName = normalizeName(label, `field_${index + 1}`);

  return {
    label,
    name: type === "heading" || type === "paragraph" || type === "divider" ? "" : machineName,
    type,
    width: type === "heading" || type === "paragraph" || type === "divider" ? "full" : "auto",
    placeholder: "",
    required: false,
    helpText: "",
    defaultValue: "",
    rows: type === "textarea" ? 5 : 4,
    options:
      type === "select" || type === "radio" || type === "checkboxGroup"
        ? "Option one\nOption two\nOption three"
        : "",
  };
}

function isOptionsField(type: FormFieldType) {
  return type === "select" || type === "radio" || type === "checkboxGroup";
}

function isLayoutOnlyField(type: FormFieldType) {
  return type === "heading" || type === "paragraph" || type === "divider";
}

function isPlaceholderField(type: FormFieldType) {
  return !["checkbox", "checkboxGroup", "radio", "hidden", "heading", "paragraph", "divider", "file"].includes(type);
}

export function FormDesignerModalField({
  value,
  onChange,
  readOnly,
}: FormDesignerModalFieldProps) {
  const fields = useMemo(() => value || [], [value]);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = fields[selectedIndex] || fields[0];
  const selectedSafeIndex = fields[selectedIndex] ? selectedIndex : 0;

  function updateFields(nextFields: FormField[]) {
    onChange(nextFields);

    if (selectedIndex >= nextFields.length) {
      setSelectedIndex(Math.max(nextFields.length - 1, 0));
    }
  }

  function addField(type: FormFieldType) {
    const nextField = createField(type, fields.length);
    const nextFields = [...fields, nextField];
    updateFields(nextFields);
    setSelectedIndex(nextFields.length - 1);
  }

  function updateField(index: number, patch: Partial<FormField>) {
    updateFields(
      fields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...patch } : field,
      ),
    );
  }

  function moveField(index: number, direction: -1 | 1) {
    const target = index + direction;

    if (target < 0 || target >= fields.length) {
      return;
    }

    const nextFields = [...fields];
    const [field] = nextFields.splice(index, 1);
    nextFields.splice(target, 0, field);
    updateFields(nextFields);
    setSelectedIndex(target);
  }

  function duplicateField(index: number) {
    const field = fields[index];
    const nextField = {
      ...field,
      label: `${field.label} copy`,
      name: field.name ? `${field.name}_copy` : field.name,
    };
    const nextFields = [...fields.slice(0, index + 1), nextField, ...fields.slice(index + 1)];
    updateFields(nextFields);
    setSelectedIndex(index + 1);
  }

  function removeField(index: number) {
    const nextFields = fields.filter((_, fieldIndex) => fieldIndex !== index);
    updateFields(nextFields);
  }

  return (
    <div className="form-designer-field">
      <div className="form-designer-field__summary">
        <div>
          <strong>{fields.length} fields</strong>
          <span>
            {fields.filter((field) => !isLayoutOnlyField(field.type)).length} inputs,
            {" "}
            {fields.filter((field) => isLayoutOnlyField(field.type)).length} layout rows
          </span>
        </div>
        <button disabled={readOnly} onClick={() => setOpen(true)} type="button">
          Open form designer
        </button>
      </div>

      {open ? (
        <div className="form-modal" role="dialog" aria-modal="true" aria-label="Form designer">
          <div className="form-modal__panel">
            <header className="form-modal__header">
              <div>
                <p>Form designer</p>
                <h2>Fields, layout, and content</h2>
              </div>
              <button onClick={() => setOpen(false)} type="button">
                Done
              </button>
            </header>

            <div className="form-modal__body">
              <aside className="form-modal__rail">
                <div className="form-modal__add">
                  {fieldTypes.map((fieldType) => (
                    <button
                      key={fieldType.value}
                      onClick={() => addField(fieldType.value)}
                      type="button"
                    >
                      <Plus size={14} />
                      {fieldType.label}
                    </button>
                  ))}
                </div>
              </aside>

              <section className="form-modal__list" aria-label="Form fields">
                {fields.map((field, index) => (
                  <button
                    className={
                      index === selectedSafeIndex
                        ? "form-modal__row form-modal__row--active"
                        : "form-modal__row"
                    }
                    key={`${field.type}_${field.name}_${index}`}
                    onClick={() => setSelectedIndex(index)}
                    type="button"
                  >
                    <GripVertical size={16} />
                    <span>
                      <strong>{field.label || "Untitled"}</strong>
                      <small>{field.type} · {field.width || "auto"}</small>
                    </span>
                  </button>
                ))}
              </section>

              <section className="form-modal__editor" aria-label="Selected field editor">
                {selected ? (
                  <>
                    <div className="form-modal__editor-top">
                      <div>
                        <p>Selected field</p>
                        <h3>{selected.label || "Untitled"}</h3>
                      </div>
                      <div className="form-modal__mini-actions">
                        <button
                          disabled={selectedSafeIndex === 0}
                          onClick={() => moveField(selectedSafeIndex, -1)}
                          type="button"
                        >
                          Up
                        </button>
                        <button
                          disabled={selectedSafeIndex === fields.length - 1}
                          onClick={() => moveField(selectedSafeIndex, 1)}
                          type="button"
                        >
                          Down
                        </button>
                        <button onClick={() => duplicateField(selectedSafeIndex)} type="button">
                          <Copy size={14} />
                        </button>
                        <button onClick={() => removeField(selectedSafeIndex)} type="button">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <label>
                      Type
                      <select
                        value={selected.type}
                        onChange={(event) =>
                          updateField(selectedSafeIndex, {
                            type: event.target.value as FormFieldType,
                          })
                        }
                      >
                        {fieldTypes.map((fieldType) => (
                          <option key={fieldType.value} value={fieldType.value}>
                            {fieldType.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Label / content
                      <input
                        value={selected.label}
                        onChange={(event) =>
                          updateField(selectedSafeIndex, {
                            label: event.target.value,
                            name:
                              selected.name || isLayoutOnlyField(selected.type)
                                ? selected.name
                                : normalizeName(event.target.value, selected.name),
                          })
                        }
                      />
                    </label>

                    {!isLayoutOnlyField(selected.type) ? (
                      <label>
                        Machine name
                        <input
                          value={selected.name}
                          onChange={(event) =>
                            updateField(selectedSafeIndex, { name: event.target.value })
                          }
                        />
                      </label>
                    ) : null}

                    <label>
                      Width
                      <select
                        value={selected.width || "auto"}
                        onChange={(event) =>
                          updateField(selectedSafeIndex, {
                            width: event.target.value as FormFieldWidth,
                          })
                        }
                      >
                        {widths.map((width) => (
                          <option key={width.value} value={width.value}>
                            {width.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {isPlaceholderField(selected.type) ? (
                      <label>
                        Placeholder
                        <input
                          value={selected.placeholder || ""}
                          onChange={(event) =>
                            updateField(selectedSafeIndex, { placeholder: event.target.value })
                          }
                        />
                      </label>
                    ) : null}

                    <label>
                      Help text
                      <textarea
                        value={selected.helpText || ""}
                        onChange={(event) =>
                          updateField(selectedSafeIndex, { helpText: event.target.value })
                        }
                      />
                    </label>

                    {!isLayoutOnlyField(selected.type) && selected.type !== "file" ? (
                      <label>
                        Default value
                        <input
                          value={selected.defaultValue || ""}
                          onChange={(event) =>
                            updateField(selectedSafeIndex, { defaultValue: event.target.value })
                          }
                        />
                      </label>
                    ) : null}

                    {selected.type === "textarea" ? (
                      <label>
                        Rows
                        <input
                          min={2}
                          type="number"
                          value={selected.rows || 4}
                          onChange={(event) =>
                            updateField(selectedSafeIndex, {
                              rows: Number(event.target.value) || 4,
                            })
                          }
                        />
                      </label>
                    ) : null}

                    {isOptionsField(selected.type) ? (
                      <label>
                        Options
                        <textarea
                          value={selected.options || ""}
                          onChange={(event) =>
                            updateField(selectedSafeIndex, { options: event.target.value })
                          }
                        />
                      </label>
                    ) : null}

                    {!isLayoutOnlyField(selected.type) ? (
                      <label className="form-modal__check">
                        <input
                          checked={Boolean(selected.required)}
                          onChange={(event) =>
                            updateField(selectedSafeIndex, { required: event.target.checked })
                          }
                          type="checkbox"
                        />
                        Required
                      </label>
                    ) : null}
                  </>
                ) : (
                  <div className="form-modal__empty">
                    <p>Add a field to begin designing this form.</p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
