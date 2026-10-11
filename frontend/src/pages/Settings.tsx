import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Info, KeyRound, Loader2, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { createUser, deleteUser, listUsers, updateUser } from '../api/users'
import type { User } from '../api/types'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Switch } from '../components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '../components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { TableSkeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { ErrorState } from '../components/common/ErrorState'
import { ActionsMenu } from '../components/common/ActionsMenu'
import { toast } from '../components/common/Toaster'
import { getErrorMessage } from '../lib/utils'

/* ---------------- Profile ---------------- */

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email'),
})

function ProfileTab(): React.JSX.Element {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [avatar, setAvatar] = useState(() => localStorage.getItem(`voxora_avatar_${user?.id ?? 'x'}`) ?? '')
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ name: string; email: string }>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '' },
  })

  const mutation = useMutation({
    mutationFn: (v: { name: string; email: string }) => updateUser(user!.id, v),
    onSuccess: () => {
      toast.success('Profile updated')
      localStorage.setItem(`voxora_avatar_${user!.id}`, avatar)
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
        <CardDescription>Your personal account details.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSubmit((v) => mutation.mutate(v))(e)} className="max-w-md space-y-4" noValidate>
          <div className="flex items-center gap-4">
            {avatar ? (
              <img src={avatar} alt="Avatar" className="size-14 rounded-full object-cover" />
            ) : (
              <span className="flex size-14 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                {(user?.name ?? '?').charAt(0).toUpperCase()}
              </span>
            )}
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="avatar-url">Avatar URL</Label>
              <Input id="avatar-url" placeholder="https://…" value={avatar} onChange={(e) => setAvatar(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Name</Label>
            <Input id="profile-name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          {serverError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {(isSubmitting || mutation.isPending) && <Loader2 className="size-4 animate-spin" />}
            Save profile
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

/* ---------------- Organization ---------------- */

const ORG_KEY = 'voxora_org'

interface OrgSettings {
  name: string
  industry: string
  timezone: string
}

function loadOrg(): OrgSettings {
  try {
    const raw = localStorage.getItem(ORG_KEY)
    if (raw) return JSON.parse(raw) as OrgSettings
  } catch {
    // fall through to defaults
  }
  return { name: '', industry: '', timezone: '' }
}

function OrganizationTab(): React.JSX.Element {
  const [org, setOrg] = useState<OrgSettings>(loadOrg)
  const save = (): void => {
    localStorage.setItem(ORG_KEY, JSON.stringify(org))
    toast.success('Organization settings saved')
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Organization</CardTitle>
        <CardDescription>
          Workspace identity. These settings are stored locally in this browser — the backend
          does not expose an organization endpoint yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="max-w-md space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="org-name">Organization name</Label>
          <Input id="org-name" value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} placeholder="Acme Inc." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-industry">Industry</Label>
          <Input id="org-industry" value={org.industry} onChange={(e) => setOrg({ ...org, industry: e.target.value })} placeholder="e.g. Healthcare" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-tz">Timezone</Label>
          <Input id="org-tz" value={org.timezone} onChange={(e) => setOrg({ ...org, timezone: e.target.value })} placeholder="e.g. Asia/Kolkata" />
        </div>
        <Button onClick={save}>Save organization</Button>
      </CardContent>
    </Card>
  )
}

/* ---------------- Users (admin) ---------------- */

const userSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  role: z.string().min(1, 'Select a role'),
})

type UserFormValues = z.infer<typeof userSchema>

function UserDialog({ open, user, onClose }: { open: boolean; user: User | null; onClose: () => void }): React.JSX.Element | null {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '', password: '', role: user?.role ?? 'manager' },
  })
  const mutation = useMutation({
    mutationFn: (v: UserFormValues) => {
      const payload = {
        name: v.name,
        email: v.email,
        role: v.role,
        ...(v.password ? { password: v.password } : {}),
      }
      return user ? updateUser(user.id, payload) : createUser({ ...payload, password: v.password || 'changeme123' })
    },
    onSuccess: () => {
      toast.success(user ? 'User updated' : 'User invited')
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  })
  if (!open) return null
  return (
    <Dialog open={open} onClose={onClose} labelledBy="dialog-title">
      <DialogTitle>{user ? 'Edit user' : 'Invite user'}</DialogTitle>
      <DialogDescription>
        {user ? 'Update role and details.' : 'New users receive an invite to sign in.'}
      </DialogDescription>
      <form onSubmit={(e) => void handleSubmit((v) => mutation.mutate(v))(e)} className="mt-4 space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select {...register('role')}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="agent">Agent</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{user ? 'New password (optional)' : 'Password'}</Label>
            <Input type="password" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
        </div>
        {serverError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {(isSubmitting || mutation.isPending) && <Loader2 className="size-4 animate-spin" />}
            {user ? 'Save changes' : 'Invite user'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

function UsersTab(): React.JSX.Element {
  const { user: me } = useAuth()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      toast.success('User deleted')
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Users</CardTitle>
            <CardDescription>Manage who can access this workspace.</CardDescription>
          </div>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="size-4" /> Invite user
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load users" />
        ) : (data ?? []).length === 0 ? (
          <EmptyState title="No users" description="Invite your team to get started." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.name}
                    {me?.id === u.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                      {u.role}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <ActionsMenu
                      items={[
                        { label: 'Edit', icon: Pencil, onClick: () => { setEditing(u); setDialogOpen(true) } },
                        {
                          label: 'Delete',
                          icon: Trash2,
                          destructive: true,
                          disabled: me?.id === u.id,
                          onClick: () => setDeleteTarget(u),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {dialogOpen && (
        <UserDialog key={editing?.id ?? 'new'} open={dialogOpen} user={editing} onClose={() => { setDialogOpen(false); setEditing(null) }} />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={`Remove "${deleteTarget?.name}"?`}
        description="They will lose access to this workspace immediately."
        confirmLabel="Remove user"
        loading={deleteMutation.isPending}
      />
    </Card>
  )
}

/* ---------------- Security ---------------- */

function SecurityTab(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="size-4" /> Change password
          </CardTitle>
          <CardDescription>Rotate your sign-in credentials.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              The API does not expose a password-change endpoint yet. To change your password,
              please contact your workspace administrator — this section will become interactive
              once the backend supports it.
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" /> API keys
          </CardTitle>
          <CardDescription>Programmatic access to the Voxora API.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              The API does not expose API key management yet. Key issuance and revocation will
              appear here once the backend supports it — no placeholder actions are shown
              in the meantime.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ---------------- Notifications ---------------- */

const NOTIF_KEY = 'voxora_notifications'

interface NotifSettings {
  call_completed: boolean
  lead_qualified: boolean
  followup_reminder: boolean
  campaign_finished: boolean
}

function loadNotif(): NotifSettings {
  try {
    const raw = localStorage.getItem(NOTIF_KEY)
    if (raw) return { call_completed: true, lead_qualified: true, followup_reminder: true, campaign_finished: true, ...(JSON.parse(raw) as Partial<NotifSettings>) }
  } catch {
    // defaults
  }
  return { call_completed: true, lead_qualified: true, followup_reminder: true, campaign_finished: true }
}

const NOTIF_LABELS: [keyof NotifSettings, string, string][] = [
  ['call_completed', 'Call completed', 'Notify when a call finishes.'],
  ['lead_qualified', 'Lead qualified', 'Notify when a lead becomes qualified.'],
  ['followup_reminder', 'Follow-up reminders', 'Remind me about due follow-ups.'],
  ['campaign_finished', 'Campaign finished', 'Notify when a campaign completes.'],
]

function NotificationsTab(): React.JSX.Element {
  const [settings, setSettings] = useState<NotifSettings>(loadNotif)
  const toggle = (key: keyof NotifSettings): void => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(NOTIF_KEY, JSON.stringify(next))
      return next
    })
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notifications</CardTitle>
        <CardDescription>Choose what you want to be notified about. Preferences are saved in this browser.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {NOTIF_LABELS.map(([key, label, desc]) => (
          <div key={key} className="flex items-center justify-between gap-4 rounded-md px-2 py-3 hover:bg-accent/40">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <Switch checked={settings[key]} onCheckedChange={() => toggle(key)} label={label} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/* ---------------- Settings page ---------------- */

export function Settings(): React.JSX.Element {
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('profile')

  return (
    <div>
      <PageHeader title="Settings" description="Manage your account, workspace and preferences." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          {isAdmin && <TabsTrigger value="users">Users</TabsTrigger>}
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="organization"><OrganizationTab /></TabsContent>
        {isAdmin && (
          <TabsContent value="users"><UsersTab /></TabsContent>
        )}
        <TabsContent value="security"><SecurityTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
      </Tabs>
    </div>
  )
}
