import { useEffect, useState } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

export type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

type Listener = (items: ToastItem[]) => void

let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<Listener>()

function emit(): void {
  for (const l of listeners) l([...items])
}

function push(kind: ToastKind, message: string): void {
  const id = nextId++
  items = [...items, { id, kind, message }]
  emit()
  setTimeout(() => {
    items = items.filter((t) => t.id !== id)
    emit()
  }, 4200)
}

export const toast = {
  success: (message: string): void => push('success', message),
  error: (message: string): void => push('error', message),
  info: (message: string): void => push('info', message),
}

const ICONS: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

export function Toaster(): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const listener: Listener = (next) => setToasts(next)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div
            key={t.id}
            className={cn(
              'toast-enter pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-lg',
              t.kind === 'success' && 'border-emerald-500/40',
              t.kind === 'error' && 'border-destructive/50',
              t.kind === 'info' && 'border-sky-500/40',
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 size-5 shrink-0',
                t.kind === 'success' && 'text-emerald-500',
                t.kind === 'error' && 'text-destructive',
                t.kind === 'info' && 'text-sky-500',
              )}
            />
            <p className="flex-1 text-sm">{t.message}</p>
            <button
              type="button"
              aria-label="Dismiss notification"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={() => {
                items = items.filter((x) => x.id !== t.id)
                emit()
              }}
            >
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
