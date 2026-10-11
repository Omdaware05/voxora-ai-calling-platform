import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, PhoneOff, Radio, X } from 'lucide-react'
import { hangupCall, listLiveCalls } from '../api/calls'
import type { CallSummary, TranscriptSegment } from '../api/types'
import { wsUrl } from '../api/client'
import { useWebSocket } from '../hooks/useWebSocket'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { StatusBadge } from '../components/common/StatusBadge'
import { ErrorState } from '../components/common/ErrorState'
import { toast } from '../components/common/Toaster'
import { cn, formatSeconds, getErrorMessage } from '../lib/utils'

type CallWsEvent = {
  type: 'call.created' | 'call.updated' | 'call.ended'
  call: CallSummary
}

type TranscriptWsEvent = {
  type: 'transcript.segment'
  segment: TranscriptSegment
}

function ElapsedTimer({ startedAt }: { startedAt?: string | null }): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const start = startedAt ? new Date(startedAt).getTime() : NaN
  const elapsed = Number.isNaN(start) ? 0 : Math.max(0, Math.floor((now - start) / 1000))
  return <span className="tabular-nums">{formatSeconds(elapsed)}</span>
}

function LiveTranscriptPanel({ call, onClose }: { call: CallSummary; onClose: () => void }): React.JSX.Element {
  const [segments, setSegments] = useState<TranscriptSegment[]>([])

  const url = useMemo(() => wsUrl(`/v1/ws/calls/${call.id}`), [call.id])

  const onMessage = useCallback((msg: TranscriptWsEvent) => {
    if (msg.type === 'transcript.segment' && msg.segment) {
      setSegments((prev) => [...prev, msg.segment])
    }
  }, [])

  const { connected } = useWebSocket<TranscriptWsEvent>(url, onMessage)

  useEffect(() => {
    setSegments([])
  }, [call.id])

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Live transcript">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Live transcript</h2>
            <p className="text-sm text-muted-foreground">{call.contact_name ?? call.phone ?? 'Unknown'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={connected ? 'success' : 'muted'}>{connected ? 'Live' : 'Connecting…'}</Badge>
            <button type="button" aria-label="Close transcript" onClick={onClose} className="cursor-pointer rounded-md p-1.5 hover:bg-accent">
              <X className="size-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 slim-scroll">
          {segments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Waiting for transcript segments…
            </p>
          ) : (
            segments.map((s, i) => {
              const isAgent = s.speaker.toLowerCase() === 'agent' || s.speaker.toLowerCase() === 'ai'
              return (
                <div key={i} className={cn('flex', isAgent ? 'justify-start' : 'justify-end')}>
                  <div className={cn('max-w-[85%] rounded-lg px-3 py-2 text-sm', isAgent ? 'bg-accent text-accent-foreground' : 'bg-primary/10')}>
                    <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                      {isAgent ? 'AI' : 'Customer'}
                    </p>
                    <p>{s.text}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className="border-t px-5 py-3">
          <Link to={`/calls/${call.id}`} className="text-sm font-medium text-primary hover:underline">
            Open full call detail
          </Link>
        </div>
      </div>
    </div>
  )
}

export function LiveCalls(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [transcriptCall, setTranscriptCall] = useState<CallSummary | null>(null)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['live-calls'],
    queryFn: listLiveCalls,
    // No polling — live updates arrive over the WebSocket below.
  })

  const onMessage = useCallback(
    (msg: CallWsEvent) => {
      if (!msg.call || !msg.type.startsWith('call.')) return
      queryClient.setQueryData<CallSummary[]>(['live-calls'], (prev) => {
        const list = prev ?? []
        if (msg.type === 'call.created') {
          return list.some((c) => c.id === msg.call.id) ? list : [msg.call, ...list]
        }
        if (msg.type === 'call.ended') {
          return list.filter((c) => c.id !== msg.call.id)
        }
        return list.map((c) => (c.id === msg.call.id ? { ...c, ...msg.call } : c))
      })
    },
    [queryClient],
  )

  const wsURL = useMemo(() => wsUrl('/v1/ws/calls'), [])
  const { connected } = useWebSocket<CallWsEvent>(wsURL, onMessage)

  const hangup = useMutation({
    mutationFn: (id: string) => hangupCall(id),
    onSuccess: () => {
      toast.success('Call ended')
      void queryClient.invalidateQueries({ queryKey: ['live-calls'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const calls = data ?? []

  return (
    <div>
      <PageHeader
        title="Live calls"
        description="Calls happening right now, updated in real time."
        actions={
          <Badge variant={connected ? 'success' : 'warning'}>
            <span className={cn('size-1.5 rounded-full bg-current', connected && 'animate-pulse')} />
            {connected ? 'Connected' : 'Reconnecting…'}
          </Badge>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load live calls" />
      ) : calls.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No live calls"
          description="Active calls will appear here the moment they connect."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {calls.map((c) => (
            <Card key={c.id} className="border-primary/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    <Link to={`/calls/${c.id}`} className="hover:text-primary hover:underline">
                      {c.contact_name ?? c.phone ?? 'Unknown'}
                    </Link>
                  </CardTitle>
                  <StatusBadge status={c.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Elapsed</span>
                  <span className="font-semibold"><ElapsedTimer startedAt={c.started_at} /></span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Agent</span>
                  <span className="font-medium">{c.agent_name ?? '—'}</span>
                </div>
                {c.campaign_name && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Campaign</span>
                    <span className="font-medium">{c.campaign_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setTranscriptCall(c)}
                  >
                    <MessageSquare className="size-4" /> Transcript
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => hangup.mutate(c.id)}
                    disabled={hangup.isPending}
                  >
                    <PhoneOff className="size-4" /> Hang up
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {transcriptCall && (
        <LiveTranscriptPanel call={transcriptCall} onClose={() => setTranscriptCall(null)} />
      )}
    </div>
  )
}
