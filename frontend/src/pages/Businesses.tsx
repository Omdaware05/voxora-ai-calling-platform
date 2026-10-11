import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Loader2, Pencil, Plus, Trash2, UserPlus } from 'lucide-react'
import {
  createBusiness,
  deleteBusiness,
  listBusinessAgents,
  listBusinesses,
  updateBusiness,
} from '../api/businesses'
import { listAgents, updateAgent } from '../api/agents'
import type { Business } from '../api/types'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '../components/ui/dialog'
import { Skeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { StatusBadge } from '../components/common/StatusBadge'
import { ErrorState } from '../components/common/ErrorState'
import { ActionsMenu } from '../components/common/ActionsMenu'
import { toast } from '../components/common/Toaster'
import { formatDateTime, getErrorMessage } from '../lib/utils'

const businessSchema = z.object({
  name: z.string().trim().min(1, 'Business name is required').max(160),
  industry: z.string().optional(),
  timezone: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
})

type BusinessFormValues = z.infer<typeof businessSchema>

function BusinessDialog({ open, business, onClose }: { open: boolean; business: Business | null; onClose: () => void }): React.JSX.Element | null {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<BusinessFormValues>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: business?.name ?? '',
      industry: business?.industry ?? '',
      timezone: business?.timezone ?? '',
      phone: business?.phone ?? '',
      email: business?.email ?? '',
    },
  })
  const mutation = useMutation({
    mutationFn: (v: BusinessFormValues) => {
      const payload: Partial<Business> = {
        name: v.name,
        industry: v.industry || null,
        timezone: v.timezone || null,
        phone: v.phone || null,
        email: v.email || null,
      }
      return business ? updateBusiness(business.id, payload) : createBusiness(payload)
    },
    onSuccess: () => {
      toast.success(business ? 'Business updated' : 'Business created')
      void queryClient.invalidateQueries({ queryKey: ['businesses'] })
      onClose()
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  })
  if (!open) return null
  return (
    <Dialog open={open} onClose={onClose} labelledBy="dialog-title">
      <DialogTitle>{business ? 'Edit business' : 'New business'}</DialogTitle>
      <form onSubmit={(e) => void handleSubmit((v) => mutation.mutate(v))(e)} className="mt-4 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label>Business name</Label>
          <Input {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Input placeholder="e.g. Real estate" {...register('industry')} />
          </div>
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Input placeholder="e.g. Asia/Kolkata" {...register('timezone')} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input {...register('phone')} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
        </div>
        {serverError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {(isSubmitting || mutation.isPending) && <Loader2 className="size-4 animate-spin" />}
            {business ? 'Save changes' : 'Create business'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

function AssignAgentsDialog({ business, onClose }: { business: Business; onClose: () => void }): React.JSX.Element {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: agentsData, isLoading } = useQuery({
    queryKey: ['agents', 'assign-business'],
    queryFn: () => listAgents({ page: 1, page_size: 200 }),
  })
  const { data: currentAgents } = useQuery({
    queryKey: ['businesses', business.id, 'agents'],
    queryFn: () => listBusinessAgents(business.id),
  })

  const currentIds = new Set(
    (Array.isArray(currentAgents) ? currentAgents : (currentAgents?.items ?? [])).map((a) => a.id),
  )

  const mutation = useMutation({
    mutationFn: async () => {
      const ids = [...selected]
      await Promise.all(ids.map((id) => updateAgent(id, { business_id: business.id })))
      return ids.length
    },
    onSuccess: (count) => {
      toast.success(`Assigned ${count} agent${count === 1 ? '' : 's'} to ${business.name}`)
      void queryClient.invalidateQueries({ queryKey: ['businesses'] })
      void queryClient.invalidateQueries({ queryKey: ['agents'] })
      onClose()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const available = (agentsData?.items ?? []).filter((a) => !currentIds.has(a.id))

  return (
    <Dialog open onClose={onClose} labelledBy="dialog-title" className="max-w-xl">
      <DialogTitle>Assign agents to {business.name}</DialogTitle>
      <DialogDescription>
        {currentIds.size} agent{currentIds.size === 1 ? '' : 's'} already assigned.
      </DialogDescription>
      <div className="mt-4 max-h-72 overflow-y-auto rounded-md border slim-scroll">
        {isLoading ? (
          <div className="space-y-2 p-3"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : available.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">All agents are already assigned to this business.</p>
        ) : (
          <ul className="divide-y">
            {available.map((a) => (
              <li key={a.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent/50">
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} className="size-4 accent-primary" />
                  <span className="flex-1 text-sm font-medium">{a.name}</span>
                  <StatusBadge status={String(a.status)} />
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={selected.size === 0 || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Assign {selected.size} agent{selected.size === 1 ? '' : 's'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

function BusinessAgentsList({ businessId }: { businessId: string }): React.JSX.Element {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['businesses', businessId, 'agents'],
    queryFn: () => listBusinessAgents(businessId),
  })
  const agents = Array.isArray(data) ? data : (data?.items ?? [])
  if (isLoading) return <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load agents" />
  if (agents.length === 0) return <p className="text-sm text-muted-foreground">No agents assigned yet.</p>
  return (
    <ul className="space-y-2">
      {agents.map((a) => (
        <li key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2">
          <span className="text-sm font-medium">{a.name}</span>
          <div className="flex items-center gap-2">
            <StatusBadge status={String(a.status)} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function Businesses(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Business | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Business | null>(null)
  const [assignTarget, setAssignTarget] = useState<Business | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['businesses'],
    queryFn: listBusinesses,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBusiness(id),
    onSuccess: () => {
      toast.success('Business deleted')
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['businesses'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <div>
      <PageHeader
        title="Businesses"
        description="Client businesses and their assigned agents."
        actions={
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="size-4" /> New business
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load businesses" />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No businesses yet"
          description="Add a business to group agents by client."
          actionLabel="New business"
          onAction={() => { setEditing(null); setDialogOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((b) => (
            <Card key={b.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{b.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {[b.industry, b.timezone].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <ActionsMenu
                    items={[
                      { label: 'Edit', icon: Pencil, onClick: () => { setEditing(b); setDialogOpen(true) } },
                      { label: 'Assign agents', icon: UserPlus, onClick: () => setAssignTarget(b) },
                      { label: 'Delete', icon: Trash2, destructive: true, onClick: () => setDeleteTarget(b) },
                    ]}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Agents</span>
                  <span className="font-semibold tabular-nums">{b.agent_count ?? 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDateTime(b.created_at)}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setExpanded((prev) => (prev === b.id ? null : b.id))}
                >
                  {expanded === b.id ? 'Hide agents' : 'View agents'}
                </Button>
                {expanded === b.id && <BusinessAgentsList businessId={b.id} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dialogOpen && (
        <BusinessDialog key={editing?.id ?? 'new'} open={dialogOpen} business={editing} onClose={() => { setDialogOpen(false); setEditing(null) }} />
      )}
      {assignTarget && <AssignAgentsDialog business={assignTarget} onClose={() => setAssignTarget(null)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This permanently deletes the business. Its agents become unassigned."
        confirmLabel="Delete business"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
