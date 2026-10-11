import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, Loader2, Pencil, Plus, Trash2, XCircle } from 'lucide-react'
import {
  cancelFollowUp,
  completeFollowUp,
  createFollowUp,
  deleteFollowUp,
  listFollowUps,
  rescheduleFollowUp,
  updateFollowUp,
} from '../api/followups'
import { listLeads } from '../api/leads'
import { listContacts } from '../api/contacts'
import type { FollowUp, FollowUpStatus } from '../api/types'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Select } from '../components/ui/select'
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '../components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { TableSkeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { Pagination } from '../components/ui/pagination'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { StatusBadge } from '../components/common/StatusBadge'
import { ErrorState } from '../components/common/ErrorState'
import { ActionsMenu } from '../components/common/ActionsMenu'
import { toast } from '../components/common/Toaster'
import { formatDateTime, getErrorMessage } from '../lib/utils'

const PAGE_SIZE = 20
const STATUSES: FollowUpStatus[] = ['pending', 'completed', 'cancelled', 'overdue']

const followUpSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  scheduled_at: z.string().min(1, 'Schedule a date and time'),
  contact_id: z.string().optional(),
  lead_id: z.string().optional(),
  call_id: z.string().optional(),
})

type FollowUpFormValues = z.infer<typeof followUpSchema>

function FollowUpDialog({
  open,
  followUp,
  onClose,
}: {
  open: boolean
  followUp: FollowUp | null
  onClose: () => void
}): React.JSX.Element | null {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: leadsData } = useQuery({
    queryKey: ['leads', 'all-fu'],
    queryFn: () => listLeads({ page: 1, page_size: 100 }),
    enabled: open,
  })
  const { data: contactsData } = useQuery({
    queryKey: ['contacts', 'all-fu'],
    queryFn: () => listContacts({ page: 1, page_size: 100 }),
    enabled: open,
  })
  const leads = Array.isArray(leadsData) ? leadsData : (leadsData?.items ?? [])

  const toLocalInput = (iso?: string | null): string => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number): string => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FollowUpFormValues>({
    resolver: zodResolver(followUpSchema),
    defaultValues: {
      title: followUp?.title ?? '',
      description: followUp?.description ?? '',
      scheduled_at: toLocalInput(followUp?.scheduled_at),
      contact_id: followUp?.contact_id ?? '',
      lead_id: followUp?.lead_id ?? '',
      call_id: followUp?.call_id ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: (v: FollowUpFormValues) => {
      const payload = {
        title: v.title,
        description: v.description || null,
        scheduled_at: new Date(v.scheduled_at).toISOString(),
        contact_id: v.contact_id || null,
        lead_id: v.lead_id || null,
        call_id: v.call_id || null,
      }
      return followUp ? updateFollowUp(followUp.id, payload) : createFollowUp(payload)
    },
    onSuccess: () => {
      toast.success(followUp ? 'Follow-up updated' : 'Follow-up created')
      void queryClient.invalidateQueries({ queryKey: ['followups'] })
      onClose()
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  })

  if (!open) return null

  return (
    <Dialog open={open} onClose={onClose} labelledBy="dialog-title">
      <DialogTitle>{followUp ? 'Edit follow-up' : 'New follow-up'}</DialogTitle>
      <form onSubmit={(e) => void handleSubmit((v) => mutation.mutate(v))(e)} className="mt-4 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input placeholder="e.g. Call back about pricing" {...register('title')} />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Scheduled for</Label>
          <Input type="datetime-local" {...register('scheduled_at')} />
          {errors.scheduled_at && <p className="text-xs text-destructive">{errors.scheduled_at.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Contact</Label>
            <Select {...register('contact_id')}>
              <option value="">None</option>
              {(contactsData?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Lead</Label>
            <Select {...register('lead_id')}>
              <option value="">None</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={3} {...register('description')} />
        </div>
        {serverError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {(isSubmitting || mutation.isPending) && <Loader2 className="size-4 animate-spin" />}
            {followUp ? 'Save changes' : 'Create follow-up'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

function RescheduleDialog({ followUp, onClose }: { followUp: FollowUp; onClose: () => void }): React.JSX.Element {
  const queryClient = useQueryClient()
  const [value, setValue] = useState('')
  const mutation = useMutation({
    mutationFn: () => rescheduleFollowUp(followUp.id, new Date(value).toISOString()),
    onSuccess: () => {
      toast.success('Follow-up rescheduled')
      void queryClient.invalidateQueries({ queryKey: ['followups'] })
      onClose()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
  return (
    <Dialog open onClose={onClose} labelledBy="dialog-title">
      <DialogTitle>Reschedule follow-up</DialogTitle>
      <DialogDescription>Currently scheduled for {formatDateTime(followUp.scheduled_at)}.</DialogDescription>
      <div className="mt-4 space-y-2">
        <Label>New date and time</Label>
        <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!value || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Reschedule
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

export function FollowUps(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FollowUp | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<FollowUp | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FollowUp | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['followups', page, statusFilter],
    queryFn: () =>
      listFollowUps({ page, page_size: PAGE_SIZE, status: statusFilter || undefined }),
  })

  const items: FollowUp[] = Array.isArray(data) ? data : (data?.items ?? [])
  const total = Array.isArray(data) ? data.length : (data?.total ?? 0)

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['followups'] })
  }

  const completeMutation = useMutation({
    mutationFn: (id: string) => completeFollowUp(id),
    onSuccess: () => { toast.success('Follow-up completed'); invalidate() },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelFollowUp(id),
    onSuccess: () => { toast.success('Follow-up cancelled'); invalidate() },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFollowUp(id),
    onSuccess: () => { toast.success('Follow-up deleted'); setDeleteTarget(null); invalidate() },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        description="Never miss a callback."
        actions={
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="size-4" /> New follow-up
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="w-44" aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load follow-ups" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No follow-ups"
          description="Schedule follow-ups from leads or create one directly."
          actionLabel="New follow-up"
          onAction={() => { setEditing(null); setDialogOpen(true) }}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled for</TableHead>
                <TableHead>Contact / Lead</TableHead>
                <TableHead>Related call</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.title}</TableCell>
                  <TableCell><StatusBadge status={f.status} /></TableCell>
                  <TableCell className="tabular-nums">{formatDateTime(f.scheduled_at)}</TableCell>
                  <TableCell className="text-muted-foreground">{f.contact_name ?? '—'}</TableCell>
                  <TableCell>
                    {f.call_id ? (
                      <Link to={`/calls/${f.call_id}`} className="text-primary hover:underline">View call</Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <ActionsMenu
                      items={[
                        ...(f.status === 'pending' || f.status === 'overdue'
                          ? [
                              { label: 'Mark complete', icon: CheckCircle2, onClick: () => completeMutation.mutate(f.id) },
                              { label: 'Reschedule', icon: CalendarClock, onClick: () => setRescheduleTarget(f) },
                              { label: 'Cancel', icon: XCircle, onClick: () => cancelMutation.mutate(f.id) },
                            ]
                          : []),
                        { label: 'Edit', icon: Pencil, onClick: () => { setEditing(f); setDialogOpen(true) } },
                        { label: 'Delete', icon: Trash2, destructive: true, onClick: () => setDeleteTarget(f) },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      )}

      {dialogOpen && (
        <FollowUpDialog key={editing?.id ?? 'new'} open={dialogOpen} followUp={editing} onClose={() => { setDialogOpen(false); setEditing(null) }} />
      )}
      {rescheduleTarget && (
        <RescheduleDialog followUp={rescheduleTarget} onClose={() => setRescheduleTarget(null)} />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.title}"?`}
        description="This permanently deletes the follow-up."
        confirmLabel="Delete follow-up"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
