import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pause, Play, Plus, Square, Trash2, X, Zap } from 'lucide-react'
import {
  addContactsToCampaign,
  createCampaign,
  deleteCampaign,
  listCampaigns,
  pauseCampaign,
  resumeCampaign,
  startCampaign,
  stopCampaign,
} from '../api/campaigns'
import { listAgents } from '../api/agents'
import { listQuestionnaires } from '../api/questionnaires'
import { listContacts } from '../api/contacts'
import type { Campaign } from '../api/types'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Skeleton, TableSkeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { StatusBadge } from '../components/common/StatusBadge'
import { ErrorState } from '../components/common/ErrorState'
import { SearchInput } from '../components/common/SearchInput'
import { ActionsMenu } from '../components/common/ActionsMenu'
import { toast } from '../components/common/Toaster'
import { formatDateTime, getErrorMessage } from '../lib/utils'
import { useDebounce } from '../hooks/useDebounce'

const campaignSchema = z.object({
  name: z.string().trim().min(1, 'Campaign name is required').max(160),
  agent_id: z.string().min(1, 'Select an agent'),
  questionnaire_id: z.string().optional(),
  contact_ids: z.array(z.string()).min(1, 'Select at least one contact'),
  concurrency: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (v === undefined || v === '') return true
        const n = Number(v)
        return Number.isInteger(n) && n >= 1 && n <= 100
      },
      { message: 'Concurrency must be a whole number between 1 and 100' },
    ),
  caller_id: z.string().optional(),
  scheduled_at: z.string().optional(),
})

type CampaignFormValues = z.infer<typeof campaignSchema>

function CampaignWizard({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element | null {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)
  const [contactSearch, setContactSearch] = useState('')
  const debouncedContactSearch = useDebounce(contactSearch)

  const { data: agentsData } = useQuery({
    queryKey: ['agents', 'all-wizard'],
    queryFn: () => listAgents({ page: 1, page_size: 100, status: 'active' }),
    enabled: open,
  })
  const { data: questionnairesData } = useQuery({
    queryKey: ['questionnaires', 'wizard'],
    queryFn: () => listQuestionnaires({ status: 'published', page: 1, page_size: 100 }),
    enabled: open,
  })
  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['contacts', 'wizard', debouncedContactSearch],
    queryFn: () =>
      listContacts({ page: 1, page_size: 50, search: debouncedContactSearch || undefined }),
    enabled: open,
  })

  const questionnaires = Array.isArray(questionnairesData) ? questionnairesData : (questionnairesData?.items ?? [])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: { name: '', agent_id: '', questionnaire_id: '', contact_ids: [], concurrency: '2', caller_id: '', scheduled_at: '' },
  })

  const selectedIds = watch('contact_ids')

  const mutation = useMutation({
    mutationFn: (values: CampaignFormValues) =>
      createCampaign({
        name: values.name,
        agent_id: values.agent_id,
        questionnaire_id: values.questionnaire_id || null,
        concurrency: values.concurrency ? Number(values.concurrency) : null,
        caller_id: values.caller_id || null,
        scheduled_at: values.scheduled_at || null,
        // contacts attached in a follow-up call since contract separates them
      } as Partial<Campaign>).then(async (campaign) => {
        if (values.contact_ids.length > 0) {
          await addContactsToCampaign(campaign.id, values.contact_ids)
        }
        return campaign
      }),
    onSuccess: (c) => {
      toast.success(`Campaign "${c.name}" created`)
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      onClose()
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  })

  if (!open) return null

  const toggleContact = (id: string): void => {
    setValue(
      'contact_ids',
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
      { shouldDirty: true, shouldValidate: true },
    )
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="New campaign">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">New campaign</h2>
            <p className="text-sm text-muted-foreground">Set up an outbound calling campaign.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer rounded-md p-1.5 hover:bg-accent">
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit((v) => mutation.mutate(v))(e)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 slim-scroll">
            <div className="space-y-1.5">
              <Label htmlFor="camp-name">Campaign name</Label>
              <Input id="camp-name" placeholder="e.g. Q4 lead reactivation" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Agent</Label>
                <Select {...register('agent_id')}>
                  <option value="">Select an agent…</option>
                  {(agentsData?.items ?? []).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
                {errors.agent_id && <p className="text-xs text-destructive">{errors.agent_id.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Questionnaire</Label>
                <Select {...register('questionnaire_id')}>
                  <option value="">None</option>
                  {questionnaires.map((q) => (
                    <option key={q.id} value={q.id}>{q.name}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="camp-concurrency">Concurrency</Label>
                <Input id="camp-concurrency" type="number" min={1} max={100} {...register('concurrency')} />
                {errors.concurrency && <p className="text-xs text-destructive">{errors.concurrency.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="camp-caller">Caller ID</Label>
                <Input id="camp-caller" placeholder="+1 555 010 0000" {...register('caller_id')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="camp-schedule">Schedule for (optional)</Label>
              <Input id="camp-schedule" type="datetime-local" {...register('scheduled_at')} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Contacts ({selectedIds.length} selected)</Label>
                <SearchInput value={contactSearch} onChange={setContactSearch} placeholder="Search contacts…" className="max-w-56" />
              </div>
              {errors.contact_ids && <p className="text-xs text-destructive">{errors.contact_ids.message}</p>}
              <div className="max-h-64 overflow-y-auto rounded-md border slim-scroll">
                {contactsLoading ? (
                  <div className="space-y-2 p-3"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
                ) : (contactsData?.items ?? []).length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">No contacts found.</p>
                ) : (
                  <ul className="divide-y">
                    {(contactsData?.items ?? []).map((c) => (
                      <li key={c.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent/50">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(c.id)}
                            onChange={() => toggleContact(c.id)}
                            className="size-4 accent-primary"
                          />
                          <span className="flex-1 text-sm">
                            <span className="font-medium">{c.name}</span>
                            <span className="ml-2 text-muted-foreground">{c.phone}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {serverError && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {(isSubmitting || mutation.isPending) && <Loader2 className="size-4 animate-spin" />}
              Create campaign
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function Campaigns(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ campaign: Campaign; action: 'start' | 'stop' } | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['campaigns'],
    queryFn: listCampaigns,
  })

  const campaigns: Campaign[] = Array.isArray(data) ? data : (data?.items ?? [])

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['campaigns'] })
  }

  const lifecycleMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'start' | 'pause' | 'resume' | 'stop' }) => {
      switch (action) {
        case 'start': return startCampaign(id)
        case 'pause': return pauseCampaign(id)
        case 'resume': return resumeCampaign(id)
        case 'stop': return stopCampaign(id)
      }
    },
    onSuccess: (c) => {
      toast.success(`Campaign "${c.name}" updated`)
      invalidate()
      setConfirmAction(null)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
      setConfirmAction(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCampaign(id),
    onSuccess: () => {
      toast.success('Campaign deleted')
      setDeleteTarget(null)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const canTransition = (c: Campaign, action: 'start' | 'pause' | 'resume' | 'stop'): boolean => {
    const status = c.status.toLowerCase()
    switch (action) {
      case 'start': return ['draft', 'scheduled', 'paused'].includes(status)
      case 'pause': return status === 'running'
      case 'resume': return status === 'paused'
      case 'stop': return ['running', 'paused'].includes(status)
    }
  }

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Outbound calling campaigns at scale."
        actions={
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="size-4" /> New campaign
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load campaigns" />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="No campaigns yet"
          description="Create your first campaign to start calling contacts in bulk."
          actionLabel="New campaign"
          onAction={() => setWizardOpen(true)}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Progress</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link to={`/campaigns/${c.id}`} className="font-medium text-primary hover:underline">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell><StatusBadge status={c.status} /></TableCell>
                <TableCell className="text-muted-foreground">{c.agent_name ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.total_contacts != null ? `${Math.round(c.progress ?? 0)}% (${c.total_contacts})` : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDateTime(c.created_at)}</TableCell>
                <TableCell className="text-right">
                  <ActionsMenu
                    items={[
                      ...(canTransition(c, 'start')
                        ? [{ label: 'Start', icon: Play, onClick: () => setConfirmAction({ campaign: c, action: 'start' }) }]
                        : []),
                      ...(canTransition(c, 'pause')
                        ? [{ label: 'Pause', icon: Pause, onClick: () => lifecycleMutation.mutate({ id: c.id, action: 'pause' }) }]
                        : []),
                      ...(canTransition(c, 'resume')
                        ? [{ label: 'Resume', icon: Play, onClick: () => lifecycleMutation.mutate({ id: c.id, action: 'resume' }) }]
                        : []),
                      ...(canTransition(c, 'stop')
                        ? [{ label: 'Stop', icon: Square, onClick: () => setConfirmAction({ campaign: c, action: 'stop' }) }]
                        : []),
                      { label: 'Delete', icon: Trash2, destructive: true, onClick: () => setDeleteTarget(c) },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {wizardOpen && <CampaignWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />}

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && lifecycleMutation.mutate({ id: confirmAction.campaign.id, action: confirmAction.action })}
        title={`${confirmAction?.action === 'start' ? 'Start' : 'Stop'} "${confirmAction?.campaign.name}"?`}
        description={
          confirmAction?.action === 'start'
            ? 'The campaign will begin dialing its contacts.'
            : 'The campaign will stop dialing immediately. This cannot be undone.'
        }
        confirmLabel={confirmAction?.action === 'start' ? 'Start campaign' : 'Stop campaign'}
        destructive={confirmAction?.action === 'stop'}
        loading={lifecycleMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This permanently deletes the campaign and its contact list."
        confirmLabel="Delete campaign"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
