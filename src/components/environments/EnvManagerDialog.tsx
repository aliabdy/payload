import { useEffect, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ui-sdk/react/dialog";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Listbox, ListboxItem } from "@ui-sdk/react/listbox";
import { useAppStore } from "../../store/useAppStore";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { KeyValueEditor } from "../request/KeyValueEditor";

export function EnvManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const environments = useAppStore((state) => state.data.environments);
  const activeEnvId = useAppStore((state) => state.data.activeEnvId);
  const addEnvironment = useAppStore((state) => state.addEnvironment);
  const updateEnvironment = useAppStore((state) => state.updateEnvironment);
  const deleteEnvironment = useAppStore((state) => state.deleteEnvironment);
  const setActiveEnvironment = useAppStore((state) => state.setActiveEnvironment);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId((current) => {
      if (current && environments.some((env) => env.id === current)) {
        return current;
      }
      return activeEnvId ?? environments[0]?.id ?? null;
    });
  }, [open, environments, activeEnvId]);

  const selected =
    environments.find((environment) => environment.id === selectedId) ?? null;
  const isActive = selected?.id === activeEnvId;

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
        <DialogContent className="panel-dialog env-dialog">
          <DialogTitle className="dialog-heading">Environments</DialogTitle>
          <DialogDescription className="dialog-copy">
            Variables use {"{{name}}"} syntax in URLs, parameters, headers, bodies
            and auth fields.
          </DialogDescription>
          <div className="env-manager">
            <div className="env-list-col">
              <Button
                className="small-button ghost-button"
                onClick={() => {
                  const id = addEnvironment();
                  setSelectedId(id);
                }}
              >
                Add environment
              </Button>
              {environments.length === 0 ? (
                <p className="inline-empty">No environments yet.</p>
              ) : (
                <Listbox
                  aria-label="Environments"
                  className="env-list"
                  value={selectedId}
                  onValueChange={(value) => {
                    if (value) setSelectedId(value);
                  }}
                >
                  {environments.map((environment) => (
                    <ListboxItem
                      key={environment.id}
                      value={environment.id}
                      label={environment.name}
                    >
                      <span className="env-list-name">{environment.name}</span>
                      {environment.id === activeEnvId ? (
                        <span className="count-badge">active</span>
                      ) : null}
                    </ListboxItem>
                  ))}
                </Listbox>
              )}
            </div>
            <div className="env-editor">
              {selected ? (
                <>
                  <Field>
                    <FieldLabel>Environment name</FieldLabel>
                    <Input
                      value={selected.name}
                      onValueChange={(name) =>
                        updateEnvironment(selected.id, { name })
                      }
                      aria-label="Environment name"
                      spellCheck={false}
                    />
                  </Field>
                  <div>
                    <div className="dialog-section-title">Variables</div>
                    <KeyValueEditor
                      items={selected.vars}
                      onChange={(vars) =>
                        updateEnvironment(selected.id, { vars })
                      }
                      labelPrefix="Variable"
                      addLabel="Add variable"
                      keyPlaceholder="name"
                      valuePlaceholder="value"
                    />
                  </div>
                  <div className="settings-actions">
                    <Button
                      className="small-button ghost-button"
                      disabled={isActive}
                      onClick={() => setActiveEnvironment(selected.id)}
                    >
                      {isActive ? "Active environment" : "Use this environment"}
                    </Button>
                    <Button
                      className="small-button danger-button"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete environment
                    </Button>
                  </div>
                </>
              ) : (
                <p className="inline-empty">
                  Add an environment to define reusable variables.
                </p>
              )}
            </div>
          </div>
          <div className="dialog-actions">
            <DialogClose className="small-button ghost-button">Done</DialogClose>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete environment?"
        description="Requests that reference its variables will show unresolved warnings until you define them elsewhere."
        confirmLabel="Delete environment"
        agentConfirm="Deletes this environment and its variables"
        onConfirm={() => {
          if (!selected) return;
          const remaining = environments.filter(
            (environment) => environment.id !== selected.id,
          );
          deleteEnvironment(selected.id);
          setSelectedId(remaining[0]?.id ?? null);
        }}
      />
    </>
  );
}
