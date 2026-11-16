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
import { Textarea } from "@ui-sdk/react/textarea";
import { parseCurl } from "../../lib/curl";
import { toastSuccess } from "../../lib/toast";
import { useAppStore } from "../../store/useAppStore";

export function CurlImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createScratchTab = useAppStore((state) => state.createScratchTab);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorId = "curl-import-error";

  useEffect(() => {
    if (open) {
      setText("");
      setError(null);
    }
  }, [open]);

  const importCurl = () => {
    const result = parseCurl(text);
    if (!result.parsed) {
      setError(result.error ?? "That cURL command could not be parsed.");
      return;
    }
    const { parsed } = result;
    const tabId = createScratchTab({
      name: "Imported cURL",
      method: parsed.method,
      url: parsed.url,
      headers: parsed.headers,
      body: parsed.body,
      auth: parsed.auth,
      options: parsed.options,
    });
    toastSuccess(
      "cURL imported",
      parsed.warnings.length > 0
        ? parsed.warnings.join(" ")
        : `Opened ${parsed.method} ${parsed.url} as a draft.`,
    );
    void tabId;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent className="panel-dialog curl-dialog">
        <DialogTitle className="dialog-heading">Import cURL</DialogTitle>
        <DialogDescription className="dialog-copy">
          Paste a cURL command. Headers, JSON or form bodies, basic auth and
          common flags are imported into a new draft.
        </DialogDescription>
        <div className="dialog-form">
          <Field invalid={!!error}>
            <FieldLabel>cURL command</FieldLabel>
            <Textarea
              value={text}
              onValueChange={(value) => {
                setText(value);
                if (error) setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              rows={9}
              spellCheck={false}
              placeholder={"curl 'https://api.example.com/users' \\\n  -H 'Accept: application/json'"}
            />
            {error ? (
              <p id={errorId} role="alert" className="inline-alert">
                {error}
              </p>
            ) : null}
          </Field>
        </div>
        <div className="dialog-actions">
          <DialogClose className="small-button ghost-button">Cancel</DialogClose>
          <Button
            className="small-button primary-button"
            onClick={importCurl}
            disabled={text.trim().length === 0}
          >
            Import request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
