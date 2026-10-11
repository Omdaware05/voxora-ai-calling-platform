import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Pause, Play, Plus, Square, UserPlus } from 'lucide-react'
import {
  addContactsToCampaign,
  getCampaign,
  getCampaignStats,
  pauseCampaign,
  resumeCampaign,
  startCampaign,
  stopCampaign,
} from '../api/campaigns'
import { listCalls } from '../api/calls'
import { listContacts } from '../api/contacts'
import { PageHeader } from '../components/layout/PageHeader'
import { StatCard } from '../components/common/StatCard'
import { StatusBadge } from '../components/common/StatusBadge'
import { ErrorState } from '../components/common/ErrorState'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Skeleton, TableSkeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { Dialog, DialogFooter, DialogTitle } from '../components/ui/dialog'
import { SearchInput } from '../components/common/SearchInput'
import { Progress } from '../components/ui/progress'
import { toast } from '../components/common/Toaster'
import { formatDateTime, formatSeconds, getErrorMessage } from '../lib/utils'
import { useDebounce } from '../hooks/useDebounce'

function AddContactsDialog({ campaignId, onClose }: { campaignId: string; onClose: () => void }): React.JSX.Element {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const debounced = useDebounce(search)

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', 'campaign-add', debounced],
    queryFn: () => listContacts({ page: 1, page_size: 50, search: debounced || undefined }),
  })

  const mutation = useMutation({
    mutationFn: () => addContactsToCampaign(campaignId, selectedIds),
    onSuccess: (res) => {
      toast.success(`Added ${res.added} contacts`)
      void queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] })
      onClose()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const toggle = (id: string): void => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <Dialog open onClose={onClose} labelledBy="dialog-title" className="max-w-xl">
      <DialogTitle>Add contacts</DialogTitle>
      <div className="mt-3 space-y-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search contacts…" />
        <div className="max-h-72 overflow-y-auto rounded-md border slim-scroll">
          {isLoading ? (
            <div className="space-y-2 p-3"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
          ) : (data?.items ?? []).length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No contacts found.</p>
          ) : (
            <ul className="divide-y">
              {(data?.items ?? []).map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent/50">
                    <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggle(c.id)} className="size-4 accent-primary" />
                    <span className="text-sm"><span className="font-medium">{c.name}</span><span className="ml-2 text-muted-foreground">{c.phone}</span></span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={selectedIds.length === 0 || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Add {selectedIds.length} contact{selectedIds.length === 1 ? '' : 's'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

export function CampaignDetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)

  const campaign = useQuery({
    queryKey: ['campaigns', id],
    queryFn: () => getCampaign(id!),
    enabled: !!id,
  })
  const stats = useQuery({
    queryKey: ['campaigns', id, 'stats'],
    queryFn: () => getCampaignStats(id!),
    enabled: !!id,
  })
  const calls = useQuery({
    queryKey: ['campaigns', id, 'calls'],
    queryFn: () => listCalls({ campaign_id: id, page: 1, page_size: 20 }),
    enabled: !!id,
  })

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['campaigns', id] })
    void queryClient.invalidateQueries({ queryKey: ['campaigns'] })
  }

  const lifecycle = useMutation({
    mutationFn: (action: 'start' | 'pause' | 'resume' | 'stop') => {
      if (!id) throw new Error('Missing campaign id')
      switch (action) {
        case 'start': return startCampaign(id)
        case 'pause': return pauseCampaign(id)
        case 'resume': return resumeCampaign(id)
        case 'stop': return stopCampaign(id)
      }
    },
    onSuccess: () => { toast.success('Campaign updated'); invalidate() },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (!id) return <ErrorState error={new Error('Missing campaign id')} title="Invalid campaign" />

  if (campaign.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <TableSkeleton rows={6} cols={5} />
      </div>
    )
  }

  if (campaign.isError || !campaign.data) {
    return <ErrorState error={campaign.error} onRetry={() => void campaign.refetch()} title="Failed to load campaign" />
  }

  const c = campaign.data
  const s = stats.data
  const status = c.status.toLowerCase()
  const outcomeBars = s
    ? [
        { label: 'Answered', value: s.answered, color: 'bg-emerald-500' },
        { label: 'Completed', value: s.completed, color: 'bg-sky-500' },
        { label: 'Failed', value: s.failed, color: 'bg-destructive' },
        { label: 'Busy', value: s.busy, color: 'bg-amber-500' },
        { label: 'No answer', value: s.no_answer, color: 'bg-muted-foreground' },
      ]
    : []
  const maxOutcome = Math.max(1, ...outcomeBars.map((b) => b.value))

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate('/campaigns')} className="mb-4">
        <ArrowLeft className="size-4" /> Back to campaigns
      </Button>
      <PageHeader
        title={c.name}
        description={`Agent: ${c.agent_name ?? '—'} · Created ${formatDateTime(c.created_at)}`}
        actions={
          <>
            <StatusBadge status={c.status} />
            {['draft', 'scheduled', 'paused'].includes(status) && (
              <Button size="sm" onClick={() => lifecycle.mutate('start')} disabled={lifecycle.isPending}>
                <Play className="size-4" /> Start
              </Button>
            )}
            {status === 'running' && (
              <Button size="sm" variant="outline" onClick={() => lifecycle.mutate('pause')} disabled={lifecycle.isPending}>
                <Pause className="size-4" /> Pause
              </Button>
            )}
            {status === 'paused' && (
              <Button size="sm" variant="outline" onClick={() => lifecycle.mutate('resume')} disabled={lifecycle.isPending}>
                <Play className="size-4" /> Resume
              </Button>
            )}
            {['running', 'paused'].includes(status) && (
              <Button size="sm" variant="destructive" onClick={() => lifecycle.mutate('stop')} disabled={lifecycle.isPending}>
                <Square className="size-4" /> Stop
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <UserPlus className="size-4" /> Add contacts
            </Button>
          </>
        }
      />

      {stats.isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} title="Failed to load campaign stats" />
      ) : s ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <StatCard title="Total" value={s.total} />
            <StatCard title="Attempted" value={s.attempted} />
            <StatCard title="Answered" value={s.answered} />
            <StatCard title="Completed" value={s.completed} />
            <StatCard title="Failed" value={s.failed} />
            <StatCard title="Interested" value={s.interested} />
            <StatCard title="Qualified" value={s.qualified} />
            <StatCard title="Avg duration" value={formatSeconds(s.avg_duration_sec)} />
            <StatCard
              title="Answer rate"
              value={s.attempted > 0 ? `${Math.round((s.answered / s.attempted) * 100)}%` : '—'}
            />
            <StatCard
              title="Progress"
              value={`${s.total > 0 ? Math.round((s.attempted / s.total) * 100) : 0}%`}
            />
          </div>

          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Outcomes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {outcomeBars.map((b) => (
                <div key={b.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">{b.label}</span>
                    <span className="font-medium tabular-nums">{b.value}</span>
                  </div>
                  <Progress value={(b.value / maxOutcome) * 100} indicatorClassName={b.color} />
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent calls</CardTitle>
        </CardHeader>
        <CardContent>
          {calls.isLoading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : calls.isError ? (
            <ErrorState error={calls.error} onRetry={() => void calls.refetch()} title="Failed to load calls" />
          ) : (calls.data?.items ?? []).length === 0 ? (
            <EmptyState
              icon={Plus}
              title="No calls yet"
              description="Calls for this campaign will appear here once it starts dialing."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Disposition</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(calls.data?.items ?? []).map((call) => (
                  <TableRow key={call.id}>
                    <TableCell>
                      <Link to={`/calls/${call.id}`} className="font-medium text-primary hover:underline">
                        {call.contact_name ?? call.phone ?? 'Unknown'}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{call.agent_name ?? '—'}</TableCell>
                    <TableCell><StatusBadge status={call.status} /></TableCell>
                    <TableCell className="text-muted-foreground">{call.disposition ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatSeconds(call.duration_sec)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(call.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {addOpen && <AddContactsDialog campaignId={id} onClose={() => setAddOpen(false)} />}
    </div>
  )
}
