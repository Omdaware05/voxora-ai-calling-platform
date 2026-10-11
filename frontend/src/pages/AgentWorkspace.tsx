import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, History, Pencil, PhoneCall, Radio } from 'lucide-react'
import { getAgent, getAgentWorkspace, listAgentVersions, restoreAgentVersion } from '../api/agents'
import { PageHeader } from '../components/layout/PageHeader'
import { StatCard } from '../components/common/StatCard'
import { StatusBadge } from '../components/common/StatusBadge'
import { ErrorState } from '../components/common/ErrorState'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Skeleton, TableSkeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { StartCallDialog } from '../components/common/StartCallDialog'
import { toast } from '../components/common/Toaster'
import { formatDateTime, formatSeconds, getErrorMessage } from '../lib/utils'

export function AgentWorkspace(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; version: number } | null>(null)
  const [callOpen, setCallOpen] = useState(false)

  const workspace = useQuery({
    queryKey: ['agents', id, 'workspace'],
    queryFn: () => getAgentWorkspace(id!),
    enabled: !!id,
  })
  const agentQuery = useQuery({
    queryKey: ['agents', id],
    queryFn: () => getAgent(id!),
    enabled: !!id,
  })
  const versions = useQuery({
    queryKey: ['agents', id, 'versions'],
    queryFn: () => listAgentVersions(id!),
    enabled: !!id,
  })

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => restoreAgentVersion(id!, versionId),
    onSuccess: () => {
      toast.success('Version restored')
      setRestoreTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['agents', id] })
      void queryClient.invalidateQueries({ queryKey: ['agents', id, 'workspace'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (!id) {
    return <ErrorState error={new Error('Missing agent id')} title="Invalid agent" />
  }

  if (workspace.isLoading || agentQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
        </div>
        <TableSkeleton rows={5} cols={5} />
      </div>
    )
  }

  if (workspace.isError || agentQuery.isError) {
    return (
      <ErrorState
        error={workspace.error ?? agentQuery.error}
        onRetry={() => { void workspace.refetch(); void agentQuery.refetch() }}
        title="Failed to load agent workspace"
      />
    )
  }

  const agent = agentQuery.data
  const ws = workspace.data
  const recentCalls = ws?.recent_calls ?? []

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate('/agents')} className="mb-4">
        <ArrowLeft className="size-4" /> Back to agents
      </Button>
      <PageHeader
        title={agent?.name ?? 'Agent workspace'}
        description={agent ? `Business: ${typeof agent.business_name === 'string' ? agent.business_name : '—'}` : undefined}
        actions={
          <>
            {agent && <StatusBadge status={String(agent.status)} />}
            <Button variant="outline" size="sm" onClick={() => setCallOpen(true)}>
              <PhoneCall className="size-4" /> Start call
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/agents')}>
              <Pencil className="size-4" /> Edit in builder
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Active calls" value={ws?.active_calls ?? 0} icon={Radio} />
        <StatCard title="Calls today" value={ws?.calls_today ?? 0} icon={PhoneCall} />
        <StatCard
          title="Language"
          value={typeof agent?.language === 'string' && agent.language ? agent.language : '—'}
        />
        <StatCard
          title="Voice"
          value={typeof agent?.voice === 'string' && agent.voice ? agent.voice : 'Default'}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent calls</CardTitle>
          </CardHeader>
          <CardContent>
            {recentCalls.length === 0 ? (
              <EmptyState
                title="No calls yet"
                description="This agent hasn't made any calls. Start a call or launch a campaign."
                actionLabel="Start a call"
                onAction={() => setCallOpen(true)}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCalls.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link to={`/calls/${c.id}`} className="font-medium text-primary hover:underline">
                          {c.contact_name ?? c.phone ?? 'Unknown'}
                        </Link>
                      </TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                      <TableCell className="text-right tabular-nums">{formatSeconds(c.duration_sec)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(c.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4" /> Versions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {versions.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            ) : versions.isError ? (
              <ErrorState error={versions.error} onRetry={() => void versions.refetch()} title="Failed to load versions" />
            ) : (versions.data ?? []).length === 0 ? (
              <EmptyState title="No versions yet" description="Saved changes create a new version snapshot." />
            ) : (
              <ul className="space-y-2">
                {(versions.data ?? []).map((v) => (
                  <li key={v.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">v{v.version}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(v.created_at)}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRestoreTarget({ id: v.id, version: v.version })}
                    >
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => restoreTarget && restoreMutation.mutate(restoreTarget.id)}
        title={`Restore version v${restoreTarget?.version}?`}
        description="The agent's current configuration will be replaced with this version."
        confirmLabel="Restore version"
        destructive={false}
        loading={restoreMutation.isPending}
      />

      <StartCallDialog open={callOpen} onClose={() => setCallOpen(false)} agentId={id} />
    </div>
  )
}
