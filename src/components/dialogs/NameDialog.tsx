import { useEffect, useState } from "react";
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

interface NameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  initialValue?: string;
  submitLabel: string;
  onSubmit: (value: string) => void;
}

export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  initialValue = "",
  submitLabel,
  onSubmit,
}: NameDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setTouched(false);
    }
  }, [open, initialValue]);

  const invalid = touched && value.trim().length === 0;
  const submit = () => {
    setTouched(true);
    if (!value.trim()) return;
    onSubmit(value.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent className="panel-dialog">
        <DialogTitle className="dialog-heading">{title}</DialogTitle>
        <DialogDescription className="dialog-copy">{description}</DialogDescription>
        <div className="dialog-form">
          <Field invalid={invalid}>
            <FieldLabel>{label}</FieldLabel>
            <Input
              value={value}
              onValueChange={setValue}
              aria-label={label}
              autoFocus
              spellCheck={false}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            {invalid ? <FieldError>Enter a name.</FieldError> : null}
          </Field>
        </div>
        <div className="dialog-actions">
          <DialogClose className="small-button ghost-button">Cancel</DialogClose>
          <Button className="small-button primary-button" onClick={submit}>
            {submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
