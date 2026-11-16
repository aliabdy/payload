import { useEffect, useRef, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@ui-sdk/react/button";
import {
  Checkbox,
  CheckboxIndicator,
} from "@ui-sdk/react/checkbox";
import { Input } from "@ui-sdk/react/input";
import { Textarea } from "@ui-sdk/react/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@ui-sdk/react/tooltip";
import type { KV } from "../../types";
import { uid } from "../../lib/format";

interface KeyValueEditorProps {
  items: KV[];
  onChange: (items: KV[]) => void;
  labelPrefix: string;
  addLabel: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export function KeyValueEditor({
  items,
  onChange,
  labelPrefix,
  addLabel,
  keyPlaceholder = "key",
  valuePlaceholder = "value",
}: KeyValueEditorProps) {
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [returnFocus, setReturnFocus] = useState(false);
  const bulkTextareaRef = useRef<HTMLTextAreaElement>(null);
  const bulkButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (bulk) {
      bulkTextareaRef.current?.focus();
    } else if (returnFocus) {
      bulkButtonRef.current?.focus();
      setReturnFocus(false);
    }
  }, [bulk, returnFocus]);

  const update = (index: number, patch: Partial<KV>) => {
    const next = items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    );
    if (
      index === items.length - 1 &&
      (next[index].key.length > 0 || next[index].value.length > 0) &&
      (patch.key !== undefined || patch.value !== undefined)
    ) {
      next.push({ id: uid(), enabled: true, key: "", value: "" });
    }
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  const append = () => {
    if (items.length > 0 && !items[items.length - 1].key && !items[items.length - 1].value) {
      return;
    }
    onChange([...items, { id: uid(), enabled: true, key: "", value: "" }]);
  };

  const startBulk = () => {
    setBulkText(
      items
        .filter((item) => item.key || item.value)
        .map((item) => `${item.key}: ${item.value}`)
        .join("\n"),
    );
    setBulk(true);
  };

  const applyBulk = () => {
    const parsed: KV[] = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf(":");
        if (separator === -1) {
          return { id: uid(), enabled: true, key: line, value: "" };
        }
        return {
          id: uid(),
          enabled: true,
          key: line.slice(0, separator).trim(),
          value: line.slice(separator + 1).trim(),
        };
      });
    onChange([
      ...parsed,
      { id: uid(), enabled: true, key: "", value: "" },
    ]);
    setReturnFocus(true);
    setBulk(false);
  };

  if (bulk) {
    return (
      <div className="field-stack" style={{ maxWidth: "none" }}>
        <Textarea
          ref={bulkTextareaRef}
          className="kv-bulk-textarea"
          value={bulkText}
          onValueChange={setBulkText}
          aria-label={`Bulk edit ${labelPrefix} rows`}
          placeholder="key: value"
          rows={8}
          spellCheck={false}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <Button className="small-button primary-button" onClick={applyBulk}>
            Apply rows
          </Button>
          <Button
            className="small-button ghost-button"
            onClick={() => {
              setReturnFocus(true);
              setBulk(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="kv-grid kv-head" aria-hidden="true">
        <span />
        <span>Key</span>
        <span>Value</span>
        <span />
      </div>
      {items.map((item, index) => (
        <div className="kv-grid" key={item.id}>
          <Checkbox
            checked={item.enabled}
            onCheckedChange={(checked) => update(index, { enabled: checked === true })}
            aria-label={`Enable ${labelPrefix} ${index + 1}`}
          >
            <CheckboxIndicator>
              <Check className="checkbox-indicator" size={12} strokeWidth={3} />
            </CheckboxIndicator>
          </Checkbox>
          <Input
            value={item.key}
            onValueChange={(value) => update(index, { key: value })}
            aria-label={`${labelPrefix} ${index + 1} key`}
            placeholder={keyPlaceholder}
            spellCheck={false}
          />
          <Input
            value={item.value}
            onValueChange={(value) => update(index, { value })}
            aria-label={`${labelPrefix} ${index + 1} value`}
            placeholder={valuePlaceholder}
            spellCheck={false}
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  className="icon-button kv-remove"
                  aria-label={`Delete ${labelPrefix} ${index + 1}`}
                  onClick={() => remove(index)}
                />
              }
            >
              <Trash2 size={13} aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent data-agent-hidden>
              Delete {labelPrefix} {index + 1}
            </TooltipContent>
          </Tooltip>
        </div>
      ))}
      {items.length === 0 ? (
        <p className="inline-empty">No {labelPrefix.toLowerCase()} rows yet.</p>
      ) : null}
      <div className="kv-actions">
        <Button className="small-button ghost-button" onClick={append}>
          <Plus size={12} />
          {addLabel}
        </Button>
        <Button
          ref={bulkButtonRef}
          className="small-button ghost-button"
          onClick={startBulk}
        >
          Bulk edit
        </Button>
      </div>
    </div>
  );
}
