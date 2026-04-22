"use client";

import { useRef } from "react";
import { mergeTags } from "@/puck/merge-tags";

type MergeTextFieldProps = {
  value?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  multiline?: boolean;
};

function insertToken(value: string, token: string, start?: number | null, end?: number | null) {
  const safeStart = typeof start === "number" ? start : value.length;
  const safeEnd = typeof end === "number" ? end : safeStart;

  return `${value.slice(0, safeStart)}${token}${value.slice(safeEnd)}`;
}

export function MergeTextField({
  value,
  onChange,
  readOnly,
  multiline = true,
}: MergeTextFieldProps) {
  const textRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const currentValue = value || "";
  const groups = Array.from(new Set(mergeTags.map((tag) => tag.group)));
  const Field = multiline ? "textarea" : "input";

  function addToken(token: string) {
    const element = textRef.current;
    const nextValue = insertToken(
      currentValue,
      token,
      element?.selectionStart,
      element?.selectionEnd,
    );

    onChange(nextValue);
    window.requestAnimationFrame(() => element?.focus());
  }

  return (
    <div className="merge-field">
      <Field
        ref={textRef as never}
        readOnly={readOnly}
        value={currentValue}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="merge-field__groups">
        {groups.map((group) => (
          <div className="merge-field__group" key={group}>
            <p>{group}</p>
            <div>
              {mergeTags
                .filter((tag) => tag.group === group)
                .map((tag) => (
                  <button
                    disabled={readOnly}
                    key={tag.token}
                    onClick={() => addToken(tag.token)}
                    type="button"
                  >
                    {tag.label}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
