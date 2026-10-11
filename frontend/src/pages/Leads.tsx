import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Eye, Loader2, Pencil, PhoneOutgoing, Plus, Trash2, X } from 'lucide-react'
import { createLead, deleteLead, getLead, listLeads, updateLead } from '../api/leads'
import { createFollowUp } from '../api/followups'
import type { Lead, LeadStatus } from '../api/types'
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
import { Progress } from '../components/ui/progress'
import { StatusBadge } from '../components/common/StatusBadge'
import { ErrorState } from '../components/common/ErrorState'
import { SearchInput } from '../components/common/SearchInput'
import { ActionsMenu } from '../components/common/ActionsMenu'
import { toast } from '../components/common/Toaster'
import { formatDateTime, getErrorMessage } from '../lib/utils'
import { useDebounce } from '../hooks/useDebounce'

const PAGE_SIZE = 20

const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'interested', 'qualified', 'converted', 'lost']

const leadSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  phone: z.string().trim().optional(),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  status: z.string(),
  score: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (v === undefined || v === '') return true
        const n = Number(v)
        return Number.isFinite(n) && n >= 0 && n <= 100
      },
      { message: 'Score must be between 0 and 100' },
    ),
  notes: z.string().max(2000).optional(),
})

type LeadFormValues = z.infer<typeof leadSchema>

function LeadDialog({ open, lead, onClose }: { open: boolean; lead: Lead | null; onClose: () => void }): React.JSX.Element | null {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: lead?.name ?? '',
      phone: lead?.phone ?? '',
      email: lead?.email ?? '',
      status: lead?.status ?? 'new',
      score: lead?.score != null ? String(lead.score) : '',
      notes: lead?.notes ?? '',
    },
  })
  const mutation = useMutation({
    mutationFn: (v: LeadFormValues) => {
      const payload: Partial<Lead> = {
        name: v.name,
        phone: v.phone || null,
        email: v.email || null,
        status: v.status,
        score: v.score !== undefined && v.score !== '' ? Number(v.score) : null,
        notes: v.notes || null,
      }
      return lead ? updateLead(lead.id, payload) : createLead(payload)
    },
    onSuccess: () => {
      toast.success(lead ? 'Lead updated' : 'Lead created')
      void queryClient.invalidateQueries({ queryKey: ['leads'] })
      onClose()
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  })
  if (!open) return null
  return (
    <Dialog open={open} onClose={onClose} labelledBy="dialog-title">
      <DialogTitle>{lead ? 'Edit lead' : 'New lead'}</DialogTitle>
      <form onSubmit={(e) => void handleSubmit((v) => mutation.mutate(v))(e)} className="mt-4 space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input {...register('phone')} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select {...register('status')}>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Score (0–100)</Label>
          <Input type="number" min={0} max={100} {...register('score')} />
          {errors.score && <p className="text-xs text-destructive">{errors.score.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={3} {...register('notes')} />
        </div>
        {serverError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {(isSubmitting || mutation.isPending) && <Loader2 className="size-4 animate-spin" />}
            {lead ? 'Save changes' : 'Create lead'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

const followUpSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  scheduled_at: z.string().min(1, 'Schedule a date and time'),
  description: z.string().optional(),
})

type FollowUpFormValues = z.infer<typeof followUpSchema>

function CreateFollowUpDialog({ lead, onClose }: { lead: Lead; onClose: () => void }): React.JSX.Element {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FollowUpFormValues>({
    resolver: zodResolver(followUpSchema),
    defaultValues: { title: `Follow up with ${lead.name}`, scheduled_at: '', description: '' },
  })
  const mutation = useMutation({
    mutationFn: (v: FollowUpFormValues) => createFollowUp({ ...v, lead_id: lead.id, status: 'pending' }),
    onSuccess: () => {
      toast.success('Follow-up created')
      void queryClient.invalidateQueries({ queryKey: ['followups'] })
      onClose()
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  })
  return (
    <Dialog open onClose={onClose} labelledBy="dialog-title">
      <DialogTitle>Create follow-up</DialogTitle>
      <DialogDescription>For lead {lead.name}</DialogDescription>
      <form onSubmit={(e) => void handleSubmit((v) => mutation.mutate(v))(e)} className="mt-4 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input {...register('title')} />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Scheduled for</Label>
          <Input type="datetime-local" {...register('scheduled_at')} />
          {errors.scheduled_at && <p className="text-xs text-destructive">{errors.scheduled_at.message}</p>}
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
            Create follow-up
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

function LeadDetailDrawer({ lead, onClose }: { lead: Lead; onClose: () => void }): React.JSX.Element {
  const queryClient = useQueryClient()
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const { data: full } = useQuery({
    queryKey: ['leads', lead.id],
    queryFn: () => getLead(lead.id),
  })
  const statusMutation = useMutation({
    mutationFn: (status: string) => updateLead(lead.id, { status }),
    onSuccess: () => {
      toast.success('Lead status updated')
      void queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
  const l = full ?? lead
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Lead details">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold">{l.name}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer rounded-md p-1.5 hover:bg-accent">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 slim-scroll">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={l.status} />
              <Select
                value={l.status}
                onChange={(e) => statusMutation.mutate(e.target.value)}
                className="w-40"
                aria-label="Change lead status"
              >
                {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          </div>
          {l.score != null && (
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted-foreground">Lead score</span>
                <span className="font-semibold tabular-nums">{l.score}/100</span>
              </div>
              <Progress value={l.score} />
            </div>
          )}
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Phone</dt><dd className="font-medium">{l.phone ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd className="font-medium">{l.email ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Agent</dt><dd className="font-medium">{l.agent_name ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Created</dt><dd className="font-medium">{formatDateTime(l.created_at)}</dd></div>
          </dl>
          {l.notes && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{l.notes}</p>
            </div>
          )}
          {l.call_id && (
            <Link to={`/calls/${l.call_id}`} className="text-sm font-medium text-primary hover:underline">
              View related call
            </Link>
          )}
        </div>
        <div className="border-t px-5 py-4">
          <Button className="w-full" onClick={() => setFollowUpOpen(true)}>
            <CalendarPlus className="size-4" /> Create follow-up
          </Button>
        </div>
      </div>
      {followUpOpen && <CreateFollowUpDialog lead={l} onClose={() => setFollowUpOpen(false)} />}
    </div>
  )
}

export function Leads(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [detailLead, setDetailLead] = useState<Lead | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null)

  const debouncedSearch = useDebounce(search)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['leads', page, debouncedSearch, statusFilter],
    queryFn: () =>
      listLeads({ page, page_size: PAGE_SIZE, search: debouncedSearch || undefined, status: statusFilter || undefined }),
  })

  const leads: Lead[] = Array.isArray(data) ? data : (data?.items ?? [])
  const total = Array.isArray(data) ? data.length : (data?.total ?? 0)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLead(id),
    onSuccess: () => {
      toast.success('Lead deleted')
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Prospects captured from your AI calls."
        actions={
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus className="size-4" /> New lead
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search leads…" />
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="w-44" aria-label="Filter by status">
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load leads" />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={PhoneOutgoing}
          title="No leads yet"
          description="Leads captured from calls will appear here."
          actionLabel="New lead"
          onAction={() => { setEditing(null); setDialogOpen(true) }}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <button type="button" className="cursor-pointer font-medium text-primary hover:underline" onClick={() => setDetailLead(l)}>
                      {l.name}
                    </button>
                  </TableCell>
                  <TableCell><StatusBadge status={l.status} /></TableCell>
                  <TableCell>
                    {l.score != null ? (
                      <div className="flex w-32 items-center gap-2">
                        <Progress value={l.score} className="flex-1" />
                        <span className="text-xs tabular-nums">{l.score}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{l.phone ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{l.agent_name ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(l.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <ActionsMenu
                      items={[
                        { label: 'View details', icon: Eye, onClick: () => setDetailLead(l) },
                        { label: 'Edit', icon: Pencil, onClick: () => { setEditing(l); setDialogOpen(true) } },
                        { label: 'Delete', icon: Trash2, destructive: true, onClick: () => setDeleteTarget(l) },
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
        <LeadDialog key={editing?.id ?? 'new'} open={dialogOpen} lead={editing} onClose={() => { setDialogOpen(false); setEditing(null) }} />
      )}
      {detailLead && <LeadDetailDrawer lead={detailLead} onClose={() => setDetailLead(null)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={`Delete lead "${deleteTarget?.name}"?`}
        description="This permanently deletes the lead."
        confirmLabel="Delete lead"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
