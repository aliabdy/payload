import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ui-sdk/react/dialog";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select";
import { flattenCollections, findRequestNode } from "../../lib/tree";
import { useAppStore } from "../../store/useAppStore";

export function SaveRequestDialog() {
  const open = useAppStore((state) => state.saveDialogOpen);
  const close = useAppStore((state) => state.closeSaveDialog);
  const saveActiveTab = useAppStore((state) => state.saveActiveTab);
  const collections = useAppStore((state) => state.data.collections);
  const selectedNode = useAppStore((state) => state.selectedNode);
  const tab = useAppStore((state) =>
    state.tabs.find((item) => item.id === state.activeTabId),
  );

  const targets = useMemo(() => flattenCollections(collections), [collections]);
  const [name, setName] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open || !tab) return;
    setName(
      tab.autoNamed || tab.name === "Untitled request" || !tab.name
        ? "My request"
        : tab.name,
    );
    let preferred = selectedNode;
    if (preferred) {
      const requestNode = findRequestNode(collections, preferred);
      if (requestNode) preferred = requestNode.parent.id;
    }
    const valid = targets.some((target) => target.value === preferred);
    setTargetId(valid ? preferred : (targets[0]?.value ?? null));
    setTouched(false);
  }, [open, tab, selectedNode, collections, targets]);

  const invalid = touched && name.trim().length === 0;

  const submit = () => {
    setTouched(true);
    if (!name.trim()) return;
    saveActiveTab(name, targetId);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent className="panel-dialog">
        <DialogTitle className="dialog-heading">Save request</DialogTitle>
        <DialogDescription className="dialog-copy">
          Keep this request in a collection so you can open it later.
        </DialogDescription>
        <div className="dialog-form">
          <Field invalid={invalid}>
            <FieldLabel>Request name</FieldLabel>
            <Input
              value={name}
              onValueChange={setName}
              aria-label="Request name"
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            {invalid ? <FieldError>Enter a request name.</FieldError> : null}
          </Field>
          {targets.length > 0 ? (
            <Field>
              <FieldLabel>Save to</FieldLabel>
              <Select
                value={targetId}
                onValueChange={(value) => setTargetId(value)}
              >
                <SelectTrigger aria-label="Save to">
                  <SelectValue placeholder="Choose a folder" />
                </SelectTrigger>
                <SelectContent className="select-content">
                  {targets.map((target) => (
                    <SelectItem
                      key={target.value}
                      value={target.value}
                      label={target.label}
                    >
                      <span style={{ paddingLeft: target.depth * 12 }}>
                        {target.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <p className="inline-alert">
              No collections yet. Saving creates a "My requests" collection.
            </p>
          )}
        </div>
        <div className="dialog-actions">
          <DialogClose className="small-button ghost-button">Cancel</DialogClose>
          <Button className="small-button primary-button" onClick={submit}>
            Save to collection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
