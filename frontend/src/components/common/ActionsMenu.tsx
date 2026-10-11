import { useEffect, useRef, useState } from 'react'
import { MoreVertical, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface ActionMenuItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
}

export function ActionsMenu({ items, label = 'Actions' }: { items: ActionMenuItem[]; label?: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open ])

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-1 w-52 rounded-md border bg-card p-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50',
                item.destructive && 'text-destructive hover:bg-destructive/10 hover:text-destructive',
              )}
            >
              {item.icon && <item.icon className="size-4 shrink-0" />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
