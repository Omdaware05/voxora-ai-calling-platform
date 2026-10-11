import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  Bot,
  Building2,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PhoneCall,
  PhoneOutgoing,
  Radio,
  Settings as SettingsIcon,
  Sun,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../auth/AuthContext'
import { useTheme } from '../../theme/ThemeProvider'
import { listFollowUps } from '../../api/followups'
import { cn } from '../../lib/utils'
import { formatDateTime } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { SearchInput } from '../common/SearchInput'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/live-calls', label: 'Live Calls', icon: Radio },
  { to: '/calls', label: 'Calls', icon: PhoneCall },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/campaigns', label: 'Campaigns', icon: Zap },
  { to: '/questionnaires', label: 'Questionnaires', icon: ClipboardList },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/leads', label: 'Leads', icon: PhoneOutgoing },
  { to: '/follow-ups', label: 'Follow-ups', icon: CalendarClock },
  { to: '/models', label: 'Model Lab', icon: FlaskConical },
  { to: '/businesses', label: 'Businesses', icon: Building2 },
  { to: '/telephony', label: 'Telephony', icon: PhoneOutgoing },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-5">
          <Link to="/" className="flex items-center gap-2" onClick={onClose}>
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-lg font-black text-primary-foreground">
              V
            </span>
            <span className="text-lg font-bold tracking-tight">Voxora</span>
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1.5 hover:bg-accent lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3 slim-scroll" aria-label="Main navigation">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'nav-link flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                  isActive
                    ? 'bg-primary/10 text-primary dark:bg-primary/20'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground">Voxora Enterprise</p>
          <p className="text-xs font-medium text-muted-foreground">AI Voice Calling Platform</p>
        </div>
      </aside>
    </>
  )
}

function NotificationsBell(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data } = useQuery({
    queryKey: ['followups', 'pending-notif'],
    queryFn: () => listFollowUps({ status: 'pending', page: 1, page_size: 5 }),
    staleTime: 60 * 1000,
  })

  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const items = Array.isArray(data) ? data : data?.items ?? []

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <Bell className="size-5" />
        {items.length > 0 && (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {items.length}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border bg-card p-2 shadow-xl">
          <p className="px-2 py-1.5 text-sm font-semibold">Follow-ups due</p>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              Nothing pending — you&apos;re all caught up.
            </p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto slim-scroll">
              {items.map((f) => (
                <li key={f.id}>
                  <Link
                    to="/follow-ups"
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-2 py-2 hover:bg-accent"
                  >
                    <p className="text-sm font-medium">{f.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(f.scheduled_at)}
                      {f.contact_name ? ` · ${f.contact_name}` : ''}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function UserMenu(): React.JSX.Element {
  const { user, logout, isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const initials = (user?.name ?? user?.email ?? '?')
    .split(' ')
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 hover:bg-accent"
        aria-label="User menu"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {initials}
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border bg-card p-2 shadow-xl">
          <div className="px-2 py-2">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            <div className="mt-1.5 flex gap-1.5">
              <Badge variant="secondary">{user?.role}</Badge>
              {isAdmin && <Badge variant="info">Admin</Badge>}
            </div>
          </div>
          <div className="border-t pt-1">
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
            >
              <SettingsIcon className="size-4" /> Settings
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function AppLayout(): React.JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { resolvedTheme, toggle } = useTheme()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
          <form
            className="hidden flex-1 md:block"
            onSubmit={(e) => {
              e.preventDefault()
              navigate(query ? `/contacts?search=${encodeURIComponent(query)}` : '/contacts')
              setQuery('')
            }}
          >
            <SearchInput value={query} onChange={setQuery} placeholder="Search contacts…" />
          </form>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolvedTheme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
            <NotificationsBell />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
