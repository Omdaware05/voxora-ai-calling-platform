import * as React from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './button'

interface FileUploadProps {
  accept?: string
  label: string
  hint?: string
  loading?: boolean
  disabled?: boolean
  onFile: (file: File) => void
  className?: string
}

export function FileUpload({
  accept,
  label,
  hint,
  loading,
  disabled,
  onFile,
  className,
}: FileUploadProps): React.JSX.Element {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)

  const pickFile = (file: File | undefined | null): void => {
    if (file) onFile(file)
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors',
        dragging ? 'border-primary bg-accent/40' : 'bg-card/50',
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        pickFile(e.dataTransfer.files[0])
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled || loading}
        onChange={(e) => {
          pickFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <FileUp className="size-8 text-muted-foreground" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        {label}
      </Button>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
