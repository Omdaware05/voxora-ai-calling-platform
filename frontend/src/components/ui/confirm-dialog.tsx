import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from './dialog'
import { Button } from './button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = true,
  loading,
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="dialog-title">
      <div className="flex items-start gap-4">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
            destructive ? 'bg-destructive/10 text-destructive' : 'bg-accent text-accent-foreground'
          }`}
        >
          <AlertTriangle className="size-5" />
        </div>
        <div className="flex-1">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} disabled={loading}>
          {loading ? 'Working…' : confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
