"use client";

import { RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ReusableBlock, ReusableBlockKind } from "@/lib/reusable-blocks";

type ReusableBlockPickerProps = {
  kind: ReusableBlockKind;
  value?: ReusableBlock | null;
  onChange: (value: ReusableBlock | null) => void;
  readOnly?: boolean;
};

export function ReusableBlockPicker({
  kind,
  value,
  onChange,
  readOnly,
}: ReusableBlockPickerProps) {
  const [blocks, setBlocks] = useState<ReusableBlock[]>([]);
  const [status, setStatus] = useState("Loading saved library...");

  const loadBlocks = useCallback(async () => {
    try {
      const response = await fetch(`/api/custom-blocks?kind=${kind}`);

      if (!response.ok) {
        throw new Error("Could not load saved blocks");
      }

      const payload = (await response.json()) as ReusableBlock[];
      setBlocks(payload);
      setStatus(payload.length ? "Saved snapshots are copied into this page." : "No saved items yet.");
    } catch {
      setStatus("Library is unavailable right now.");
    }
  }, [kind]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadBlocks(), 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadBlocks]);

  function selectBlock(blockId: string) {
    const block = blocks.find((item) => item.id === blockId) || null;
    onChange(block);
  }

  return (
    <div className="reusable-picker">
      <div className="reusable-picker__row">
        <select
          disabled={readOnly}
          onChange={(event) => selectBlock(event.currentTarget.value)}
          value={value?.id || ""}
        >
          <option value="">Choose saved {kind}</option>
          {blocks.map((block) => (
            <option key={block.id} value={block.id}>
              {block.name}
            </option>
          ))}
        </select>
        <button
          aria-label="Refresh saved library"
          disabled={readOnly}
          onClick={() => void loadBlocks()}
          type="button"
        >
          <RefreshCcw size={15} />
        </button>
      </div>
      <p>{value ? `${value.componentType} snapshot selected.` : status}</p>
    </div>
  );
}
