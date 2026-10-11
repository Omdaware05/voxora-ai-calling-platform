import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Download, FileAudio, PhoneOff } from 'lucide-react'
import {
  getCall,
  getCallEvents,
  getCallRecording,
  getCallTranscript,
  hangupCall,
} from '../api/calls'
import type { CallDetail as CallDetailType, TranscriptSegment } from '../api/types'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Skeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { Progress } from '../components/ui/progress'
import { StatusBadge } from '../components/common/StatusBadge'
import { ErrorState } from '../components/common/ErrorState'
import { AudioPlayer } from '../components/common/AudioPlayer'
import { toast } from '../components/common/Toaster'
import { cn, formatDateTime, formatSeconds, getErrorMessage } from '../lib/utils'

function OverviewTab({ call }: { call: CallDetailType }): React.JSX.Element {
  const rows: [string, string][] = [
    ['Status', ''],
    ['Direction', call.direction ?? '—'],
    ['Agent', call.agent_name ?? '—'],
    ['Customer', call.contact_name ?? call.phone ?? '—'],
    ['Phone', call.phone ?? '—'],
    ['Campaign', call.campaign_name ?? '—'],
    ['Disposition', call.disposition ?? '—'],
    ['Termination', call.termination_reason ?? '—'],
    ['Duration', formatSeconds(call.duration_sec)],
    ['Started', formatDateTime(call.started_at)],
    ['Ended', formatDateTime(call.ended_at)],
  ]
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between border-b pb-3">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-right text-sm font-medium">
            {label === 'Status' ? <StatusBadge status={call.status} /> : value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function TranscriptTab({ callId }: { callId: string }): React.JSX.Element {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['calls', callId, 'transcript'],
    queryFn: () => getCallTranscript(callId),
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className={cn('h-14', i % 2 === 0 ? 'w-3/4' : 'ml-auto w-2/3')} />
        ))}
      </div>
    )
  }
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load transcript" />

  const segments: TranscriptSegment[] = data?.segments ?? []
  if (segments.length === 0) {
    return (
      <EmptyState
        title="No transcript yet"
        description="Transcript segments appear here as the call progresses."
      />
    )
  }
  return (
    <div className="space-y-3">
      {segments.map((s, i) => {
        const isAgent = s.speaker.toLowerCase() === 'agent' || s.speaker.toLowerCase() === 'ai'
        return (
          <div key={i} className={cn('flex', isAgent ? 'justify-start' : 'justify-end')}>
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-4 py-2.5 text-sm',
                isAgent ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-foreground',
              )}
            >
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                {isAgent ? 'AI Agent' : 'Customer'}
                {s.offset_sec != null && (
                  <span className="ml-2 font-normal tabular-nums">{formatSeconds(s.offset_sec)}</span>
                )}
              </p>
              <p className="whitespace-pre-wrap">{s.text}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RecordingTab({ callId }: { callId: string }): React.JSX.Element {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  const query = useQuery({
    queryKey: ['calls', callId, 'recording'],
    queryFn: async () => {
      try {
        const blob = await getCallRecording(callId)
        return URL.createObjectURL(blob)
      } catch (err) {
        const e = err as { response?: { status?: number } }
        if (e.response?.status === 404) setMissing(true)
        throw err
      }
    },
    retry: false,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (query.data) setObjectUrl(query.data)
  }, [query.data])

  const urlRef = useRef<string | null>(null)
  useEffect(() => {
    urlRef.current = objectUrl
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [objectUrl])

  if (query.isLoading) {
    return <Skeleton className="h-16 w-full" />
  }
  if (missing) {
    return (
      <EmptyState
        icon={FileAudio}
        title="No recording available"
        description="This call has no recording yet — it may still be processing or recording was disabled."
      />
    )
  }
  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        onRetry={() => { setMissing(false); void query.refetch() }}
        title="Failed to load recording"
      />
    )
  }
  if (!objectUrl) return <Skeleton className="h-16 w-full" />

  return (
    <div className="space-y-3">
      <AudioPlayer src={objectUrl} filename={`call-${callId}.mp3`} />
      <a
        href={objectUrl}
        download={`call-${callId}.mp3`}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <Download className="size-4" /> Download recording
      </a>
    </div>
  )
}

function EventsTab({ callId }: { callId: string }): React.JSX.Element {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['calls', callId, 'events'],
    queryFn: () => getCallEvents(callId),
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    )
  }
  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load events" />
  if (!data || data.length === 0) {
    return <EmptyState title="No events" description="Call lifecycle events will appear here." />
  }
  return (
    <ol className="relative space-y-4 border-l pl-6">
      {data.map((e, i) => (
        <li key={e.id ?? i} className="relative">
          <span className="absolute -left-[29px] top-1 size-2.5 rounded-full bg-primary" aria-hidden="true" />
          <p className="text-sm font-medium">{e.type}</p>
          {e.message && <p className="text-sm text-muted-foreground">{e.message}</p>}
          <p className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</p>
        </li>
      ))}
    </ol>
  )
}

function AnalysisTab({ call }: { call: CallDetailType }): React.JSX.Element {
  const a = call.analysis
  if (!a || (!a.summary && a.lead_score == null && !a.intent)) {
    return (
      <EmptyState
        title="No AI analysis yet"
        description="Analysis is generated after the call completes."
      />
    )
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Intent</p>
            <p className="mt-1 text-sm font-semibold">{a.intent ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Interest</p>
            <p className="mt-1 text-sm font-semibold">{a.interest ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Follow-up required</p>
            <p className="mt-1 text-sm font-semibold">{a.followup_required ? 'Yes' : 'No'}</p>
          </CardContent>
        </Card>
      </div>
      {a.lead_score != null && (
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-muted-foreground">Lead score</span>
            <span className="font-semibold tabular-nums">{a.lead_score}/100</span>
          </div>
          <Progress value={a.lead_score} />
        </div>
      )}
      {a.summary && (
        <div>
          <p className="mb-1 text-sm font-medium text-muted-foreground">Summary</p>
          <p className="whitespace-pre-wrap rounded-lg border bg-card p-4 text-sm">{a.summary}</p>
        </div>
      )}
    </div>
  )
}

export function CallDetail(): React.JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('overview')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['calls', id],
    queryFn: () => getCall(id!),
    enabled: !!id,
  })

  const hangup = useMutation({
    mutationFn: () => hangupCall(id!),
    onSuccess: () => {
      toast.success('Call ended')
      void queryClient.invalidateQueries({ queryKey: ['calls', id] })
      void queryClient.invalidateQueries({ queryKey: ['live-calls'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  if (!id) return <ErrorState error={new Error('Missing call id')} title="Invalid call" />

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (isError || !data) {
    return <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load call" />
  }

  const isLive = ['in_progress', 'ringing', 'queued'].includes(data.status.toLowerCase())

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate('/calls')} className="mb-4">
        <ArrowLeft className="size-4" /> Back to calls
      </Button>
      <PageHeader
        title={data.contact_name ?? data.phone ?? 'Call'}
        description={`Call ID ${data.id}`}
        actions={
          <>
            <StatusBadge status={data.status} />
            {isLive && (
              <Button variant="destructive" size="sm" onClick={() => hangup.mutate()} disabled={hangup.isPending}>
                <PhoneOff className="size-4" /> Hang up
              </Button>
            )}
            {data.campaign_id && (
              <Link to={`/campaigns/${data.campaign_id}`} className="text-sm font-medium text-primary hover:underline">
                View campaign
              </Link>
            )}
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="recording">Recording</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Call details</CardTitle></CardHeader>
            <CardContent><OverviewTab call={data} /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="transcript"><TranscriptTab callId={id} /></TabsContent>
        <TabsContent value="recording"><RecordingTab callId={id} /></TabsContent>
        <TabsContent value="events"><EventsTab callId={id} /></TabsContent>
        <TabsContent value="analysis">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">AI analysis</CardTitle></CardHeader>
            <CardContent><AnalysisTab call={data} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
