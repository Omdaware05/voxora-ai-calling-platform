import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bot,
  Copy,
  ExternalLink,
  Loader2,
  Pencil,
  PhoneCall,
  Plus,
  Power,
  Trash2,
  X,
} from 'lucide-react'
import {
  createAgent,
  deleteAgent,
  duplicateAgent,
  listAgents,
  toggleAgent,
  updateAgent,
} from '../api/agents'
import { listBusinesses } from '../api/businesses'
import { listQuestionnaires } from '../api/questionnaires'
import type { Agent } from '../api/types'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Select } from '../components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { TableSkeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { Pagination } from '../components/ui/pagination'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { StatusBadge } from '../components/common/StatusBadge'
import { ErrorState } from '../components/common/ErrorState'
import { SearchInput } from '../components/common/SearchInput'
import { ActionsMenu } from '../components/common/ActionsMenu'
import { StartCallDialog } from '../components/common/StartCallDialog'
import { toast } from '../components/common/Toaster'
import { formatDateTime, formatPercent, getErrorMessage } from '../lib/utils'
import { useDebounce } from '../hooks/useDebounce'

/* ------------------------------------------------------------------ */
/* Agent form schema (RHF + Zod). Exported for tests.                   */
/* ------------------------------------------------------------------ */

/** Validated numeric text input: empty string means "not set". Convert with toNumber() on submit. */
const numField = (label: string, min: number, max: number, integer = false) =>
  z
    .string()
    .optional()
    .refine(
      (v) => {
        if (v === undefined || v === '') return true
        const n = Number(v)
        if (!Number.isFinite(n)) return false
        if (integer && !Number.isInteger(n)) return false
        return n >= min && n <= max
      },
      { message: `${label} must be a number between ${min} and ${max}` },
    )

const toNumber = (v: string | undefined): number | undefined =>
  v !== undefined && v !== '' ? Number(v) : undefined

export const agentFormSchema = z.object({
  name: z.string().trim().min(1, 'Agent name is required').max(120, 'Name is too long'),
  business_id: z.string().optional(),
  status: z.enum(['active', 'inactive', 'draft']),
  language: z.string().optional(),
  voice: z.string().optional(),
  concurrency: z
    .string()
    .min(1, 'Concurrency is required')
    .refine(
      (v) => {
        const n = Number(v)
        return Number.isInteger(n) && n >= 1 && n <= 100
      },
      { message: 'Concurrency must be a whole number between 1 and 100' },
    ),
  greeting: z.string().max(2000).optional(),
  closing: z.string().max(2000).optional(),
  system_prompt: z.string().max(30000).optional(),
  instructions: z.string().max(30000).optional(),
  behavior: z.string().max(30000).optional(),
  conversation_rules: z.string().max(30000).optional(),
  safety: z.string().max(30000).optional(),
  stt_provider: z.string().optional(),
  stt_model: z.string().optional(),
  stt_language: z.string().optional(),
  llm_provider: z.string().optional(),
  llm_model: z.string().optional(),
  llm_temperature: numField('Temperature', 0, 2),
  llm_max_tokens: numField('Max tokens', 1, 128000, true),
  tts_provider: z.string().optional(),
  tts_model: z.string().optional(),
  tts_voice: z.string().optional(),
  tts_speed: numField('Speed', 0.25, 4),
  questionnaire_id: z.string().optional(),
  advanced_json: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v || !v.trim()) return true
        try {
          JSON.parse(v)
          return true
        } catch {
          return false
        }
      },
      { message: 'Advanced config must be valid JSON' },
    ),
})

export type AgentFormValues = z.infer<typeof agentFormSchema>

const LANGUAGE_OPTIONS = ['en', 'es', 'fr', 'de', 'hi', 'ar', 'pt', 'zh']
const VOICE_OPTIONS = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']
const STT_PROVIDERS = ['openai', 'deepgram', 'assemblyai', 'whisper-local']
const LLM_PROVIDERS = ['openai', 'anthropic', 'google', 'azure', 'ollama', 'vllm']
const TTS_PROVIDERS = ['openai', 'elevenlabs', 'cartesia', 'azure']

function defaultsFor(agent?: Agent | null): AgentFormValues {
  const a = (agent ?? {}) as Record<string, unknown>
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
  const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)
  return {
    name: str(a.name) ?? '',
    business_id: str(a.business_id) ?? '',
    status: (['active', 'inactive', 'draft'] as const).includes(a.status as 'active') ? (a.status as 'active' | 'inactive' | 'draft') : 'active',
    language: str(a.language) ?? 'en',
    voice: str(a.voice) ?? '',
    concurrency: String(num(a.concurrency) ?? 1),
    greeting: str(a.greeting) ?? '',
    closing: str(a.closing) ?? '',
    system_prompt: str(a.system_prompt) ?? '',
    instructions: str(a.instructions) ?? '',
    behavior: str(a.behavior) ?? '',
    conversation_rules: str(a.conversation_rules) ?? '',
    safety: str(a.safety) ?? '',
    stt_provider: str(a.stt_provider) ?? '',
    stt_model: str(a.stt_model) ?? '',
    stt_language: str(a.stt_language) ?? '',
    llm_provider: str(a.llm_provider) ?? '',
    llm_model: str(a.llm_model) ?? '',
    llm_temperature: num(a.llm_temperature) !== undefined ? String(a.llm_temperature) : '',
    llm_max_tokens: num(a.llm_max_tokens) !== undefined ? String(a.llm_max_tokens) : '',
    tts_provider: str(a.tts_provider) ?? '',
    tts_model: str(a.tts_model) ?? '',
    tts_voice: str(a.tts_voice) ?? '',
    tts_speed: num(a.tts_speed) !== undefined ? String(a.tts_speed) : '',
    questionnaire_id: str(a.questionnaire_id) ?? '',
    advanced_json: a.advanced_config ? JSON.stringify(a.advanced_config, null, 2) : '',
  }
}

/* ------------------------------------------------------------------ */
/* Small form helpers                                                  */
/* ------------------------------------------------------------------ */

function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string
  error?: string
  children: React.ReactNode
  hint?: string
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

const sectionShell = 'space-y-4'

/* ------------------------------------------------------------------ */
/* AgentBuilder drawer                                                 */
/* ------------------------------------------------------------------ */

interface AgentBuilderProps {
  open: boolean
  agent: Agent | null // null = create
  onClose: () => void
}

function AgentBuilder({ open, agent, onClose }: AgentBuilderProps): React.JSX.Element | null {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('general')
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: businesses } = useQuery({
    queryKey: ['businesses'],
    queryFn: listBusinesses,
    enabled: open,
  })
  const { data: questionnaires } = useQuery({
    queryKey: ['questionnaires', 'all'],
    queryFn: () => listQuestionnaires({ page: 1, page_size: 200 }),
    enabled: open,
  })
  const questionnaireItems = useMemo(
    () => (Array.isArray(questionnaires) ? questionnaires : (questionnaires?.items ?? [])),
    [questionnaires],
  )

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: defaultsFor(agent),
  })

  // The drawer mounts fresh on every open (see parent), so defaultsFor(agent)
  // at mount time is always correct — no reset needed.

  const mutation = useMutation({
    mutationFn: (values: AgentFormValues) => {
      const { advanced_json, concurrency, llm_temperature, llm_max_tokens, tts_speed, ...rest } = values
      let advanced_config: Record<string, unknown> | null = null
      if (advanced_json?.trim()) {
        advanced_config = JSON.parse(advanced_json) as Record<string, unknown>
      }
      const payload: Partial<Agent> = {
        ...(agent ?? {}), // preserve fields the builder doesn't manage
        ...rest,
        business_id: rest.business_id || null,
        questionnaire_id: rest.questionnaire_id || null,
        concurrency: Number(concurrency),
        llm_temperature: toNumber(llm_temperature),
        llm_max_tokens: toNumber(llm_max_tokens),
        tts_speed: toNumber(tts_speed),
        advanced_config,
      }
      return agent ? updateAgent(agent.id, payload) : createAgent(payload)
    },
    onSuccess: (saved) => {
      toast.success(agent ? `Agent "${saved.name}" updated` : `Agent "${saved.name}" created`)
      void queryClient.invalidateQueries({ queryKey: ['agents'] })
      onClose()
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  })

  if (!open) return null

  const onSubmit = (values: AgentFormValues): void => {
    setServerError(null)
    mutation.mutate(values)
  }

  const err = (name: keyof AgentFormValues): string | undefined =>
    errors[name]?.message as string | undefined

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={agent ? 'Edit agent' : 'New agent'}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">{agent ? `Edit ${agent.name}` : 'New agent'}</h2>
            <p className="text-sm text-muted-foreground">
              Configure personality, voice, models and call behavior.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close builder"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1.5 hover:bg-accent"
          >
            <X className="size-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="flex min-h-0 flex-1 flex-col"
          noValidate
        >
          <div className="border-b px-6 pt-3">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto slim-scroll">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="prompt">System Prompt</TabsTrigger>
                <TabsTrigger value="voice">Voice</TabsTrigger>
                <TabsTrigger value="stt">STT</TabsTrigger>
                <TabsTrigger value="llm">LLM</TabsTrigger>
                <TabsTrigger value="tts">TTS</TabsTrigger>
                <TabsTrigger value="concurrency">Concurrency</TabsTrigger>
                <TabsTrigger value="questionnaire">Questionnaire</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 slim-scroll">
            {tab === 'general' && (
              <div className={sectionShell}>
                <Field label="Agent name" error={err('name')}>
                  <Input placeholder="e.g. Priya — Sales Qualifier" {...register('name')} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Business">
                    <Select {...register('business_id')}>
                      <option value="">No business</option>
                      {(businesses ?? []).map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Status">
                    <Select {...register('status')}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="draft">Draft</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Greeting" hint="First thing the agent says when a call connects.">
                  <Textarea rows={3} placeholder="Hi, this is Priya from Voxora…" {...register('greeting')} />
                </Field>
                <Field label="Closing" hint="What the agent says before hanging up.">
                  <Textarea rows={3} placeholder="Thanks for your time today…" {...register('closing')} />
                </Field>
              </div>
            )}

            {tab === 'prompt' && (
              <div className={sectionShell}>
                <Field label="System prompt" error={err('system_prompt')} hint="Core identity and objective of the agent.">
                  <Textarea rows={6} className="font-mono text-xs" placeholder="You are Priya, an AI sales development rep…" {...register('system_prompt')} />
                </Field>
                <Field label="Instructions" hint="Step-by-step guidance for the conversation flow.">
                  <Textarea rows={5} className="font-mono text-xs" {...register('instructions')} />
                </Field>
                <Field label="Behavior" hint="Tone, pace and personality traits.">
                  <Textarea rows={4} className="font-mono text-xs" {...register('behavior')} />
                </Field>
                <Field label="Conversation rules" hint="Hard rules the agent must always follow.">
                  <Textarea rows={4} className="font-mono text-xs" {...register('conversation_rules')} />
                </Field>
                <Field label="Safety & compliance" hint="DNC handling, consent, sensitive topics.">
                  <Textarea rows={4} className="font-mono text-xs" {...register('safety')} />
                </Field>
              </div>
            )}

            {tab === 'voice' && (
              <div className={sectionShell}>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Language">
                    <Select {...register('language')}>
                      {LANGUAGE_OPTIONS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Voice">
                    <Select {...register('voice')}>
                      <option value="">Default</option>
                      {VOICE_OPTIONS.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <p className="text-sm text-muted-foreground">
                  Voice synthesis is powered by the TTS provider configured in Model Lab. The voice
                  selected here overrides the global default for this agent.
                </p>
              </div>
            )}

            {tab === 'stt' && (
              <div className={sectionShell}>
                <Field label="STT provider" hint="Leave blank to use the global Model Lab default.">
                  <Select {...register('stt_provider')}>
                    <option value="">Use global default</option>
                    {STT_PROVIDERS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="STT model">
                    <Input placeholder="e.g. whisper-large-v3" {...register('stt_model')} />
                  </Field>
                  <Field label="STT language">
                    <Input placeholder="e.g. en" {...register('stt_language')} />
                  </Field>
                </div>
              </div>
            )}

            {tab === 'llm' && (
              <div className={sectionShell}>
                <Field label="LLM provider" hint="Leave blank to use the global Model Lab default.">
                  <Select {...register('llm_provider')}>
                    <option value="">Use global default</option>
                    {LLM_PROVIDERS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="LLM model">
                  <Input placeholder="e.g. gpt-4o-mini" {...register('llm_model')} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Temperature" error={err('llm_temperature')} hint="0 = deterministic, 2 = creative.">
                    <Input type="number" step="0.1" min={0} max={2} placeholder="0.7" {...register('llm_temperature')} />
                  </Field>
                  <Field label="Max tokens" error={err('llm_max_tokens')}>
                    <Input type="number" min={1} placeholder="1024" {...register('llm_max_tokens')} />
                  </Field>
                </div>
              </div>
            )}

            {tab === 'tts' && (
              <div className={sectionShell}>
                <Field label="TTS provider" hint="Leave blank to use the global Model Lab default.">
                  <Select {...register('tts_provider')}>
                    <option value="">Use global default</option>
                    {TTS_PROVIDERS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="TTS model">
                  <Input placeholder="e.g. tts-1-hd" {...register('tts_model')} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Voice">
                    <Input placeholder="e.g. nova" {...register('tts_voice')} />
                  </Field>
                  <Field label="Speed" error={err('tts_speed')} hint="0.25 – 4.0">
                    <Input type="number" step="0.05" min={0.25} max={4} placeholder="1.0" {...register('tts_speed')} />
                  </Field>
                </div>
              </div>
            )}

            {tab === 'concurrency' && (
              <div className={sectionShell}>
                <Field label="Max concurrent calls" error={err('concurrency')} hint="How many simultaneous calls this agent may handle.">
                  <Input type="number" min={1} max={100} {...register('concurrency')} />
                </Field>
                <p className="text-sm text-muted-foreground">
                  Campaigns dial contacts up to this limit per agent. Raise it only if your
                  telephony provider and model throughput can sustain it.
                </p>
              </div>
            )}

            {tab === 'questionnaire' && (
              <div className={sectionShell}>
                <Field label="Assigned questionnaire" hint="Questions the agent asks during the call.">
                  <Select {...register('questionnaire_id')}>
                    <option value="">None</option>
                    {questionnaireItems.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.name} ({q.status})
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}

            {tab === 'advanced' && (
              <div className={sectionShell}>
                <Field
                  label="Advanced JSON config"
                  error={err('advanced_json')}
                  hint="Merged with the fields above. Must be valid JSON — validated before save."
                >
                  <Textarea
                    rows={14}
                    className="font-mono text-xs"
                    spellCheck={false}
                    placeholder={'{\n  "vad": { "threshold": 0.5 },\n  "barge_in": true\n}'}
                    {...register('advanced_json')}
                  />
                </Field>
              </div>
            )}

            {serverError && (
              <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {(isSubmitting || mutation.isPending) && <Loader2 className="size-4 animate-spin" />}
              {agent ? 'Save changes' : 'Create agent'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Agents page                                                         */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 20

export function Agents(): React.JSX.Element {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editing, setEditing] = useState<Agent | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null)
  const [callAgent, setCallAgent] = useState<Agent | null>(null)

  const debouncedSearch = useDebounce(search)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['agents', page, debouncedSearch, statusFilter],
    queryFn: () =>
      listAgents({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
      }),
  })

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['agents'] })
  }

  const toggleMutation = useMutation({
    mutationFn: (id: string) => toggleAgent(id),
    onSuccess: (a) => {
      toast.success(`Agent "${a.name}" ${String(a.status).toLowerCase() === 'active' ? 'enabled' : 'disabled'}`)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => duplicateAgent(id),
    onSuccess: (a) => {
      toast.success(`Duplicated as "${a.name}"`)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAgent(id),
    onSuccess: () => {
      toast.success('Agent deleted')
      setDeleteTarget(null)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const agents = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <PageHeader
        title="Agents"
        description="AI voice agents — configure personality, voice and call behavior."
        actions={
          <Button onClick={() => { setEditing(null); setBuilderOpen(true) }}>
            <Plus className="size-4" /> New agent
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search agents…" />
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="w-40"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="draft">Draft</option>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load agents" />
      ) : agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          description="Create your first AI voice agent to start making calls."
          actionLabel="Create agent"
          onAction={() => { setEditing(null); setBuilderOpen(true) }}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Voice</TableHead>
                <TableHead>Language</TableHead>
                <TableHead className="text-right">Concurrency</TableHead>
                <TableHead className="text-right">Calls today</TableHead>
                <TableHead className="text-right">Interest rate</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link to={`/agents/${a.id}`} className="font-medium text-primary hover:underline">
                      {a.name}
                    </Link>
                  </TableCell>
                  <TableCell><StatusBadge status={String(a.status)} /></TableCell>
                  <TableCell className="text-muted-foreground">
                    {typeof a.business_name === 'string' ? a.business_name : '—'}
                  </TableCell>
                  <TableCell>{typeof a.voice === 'string' && a.voice ? a.voice : '—'}</TableCell>
                  <TableCell>{typeof a.language === 'string' && a.language ? a.language : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {typeof a.concurrency === 'number' ? a.concurrency : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {typeof a.calls_today === 'number' ? a.calls_today : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {typeof a.interest_rate === 'number' ? formatPercent(a.interest_rate) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {typeof a.last_active_at === 'string' ? formatDateTime(a.last_active_at) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <ActionsMenu
                      items={[
                        { label: 'Open workspace', icon: ExternalLink, onClick: () => navigate(`/agents/${a.id}`) },
                        { label: 'Edit', icon: Pencil, onClick: () => { setEditing(a); setBuilderOpen(true) } },
                        { label: 'Duplicate', icon: Copy, onClick: () => duplicateMutation.mutate(a.id) },
                        {
                          label: String(a.status).toLowerCase() === 'active' ? 'Disable' : 'Enable',
                          icon: Power,
                          onClick: () => toggleMutation.mutate(a.id),
                        },
                        { label: 'Start call', icon: PhoneCall, onClick: () => setCallAgent(a) },
                        { label: 'Delete', icon: Trash2, destructive: true, onClick: () => setDeleteTarget(a) },
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

      {builderOpen && (
        <AgentBuilder
          key={editing?.id ?? 'new'}
          open={builderOpen}
          agent={editing}
          onClose={() => { setBuilderOpen(false); setEditing(null) }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This permanently deletes the agent and its configuration. Call history is preserved."
        confirmLabel="Delete agent"
        loading={deleteMutation.isPending}
      />

      <StartCallDialog
        open={!!callAgent}
        onClose={() => setCallAgent(null)}
        agentId={callAgent?.id}
      />
    </div>
  )
}
