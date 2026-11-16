import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@ui-sdk/react/alert-dialog";
import { Button } from "@ui-sdk/react/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  agentConfirm: string;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  agentConfirm,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <AlertDialogContent className="panel-dialog">
        <AlertDialogTitle className="dialog-heading">{title}</AlertDialogTitle>
        <AlertDialogDescription className="dialog-copy">
          {description}
        </AlertDialogDescription>
        <div className="dialog-actions">
          <AlertDialogClose className="small-button ghost-button" data-slot="button">
            Cancel
          </AlertDialogClose>
          <Button
            className="small-button danger-button"
            data-agent-confirm={agentConfirm}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
