import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FlaskConical, Loader2, RotateCcw, XCircle } from 'lucide-react'
import { getModelConfig, resetModelConfig, testModelSlot, updateModelSlot } from '../api/models'
import type { ModelSlotConfig, ModelSlotType } from '../api/types'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { ErrorState } from '../components/common/ErrorState'
import { toast } from '../components/common/Toaster'
import { getErrorMessage } from '../lib/utils'

interface SlotForm {
  provider: string
  model: string
  base_url: string
  language: string
  voice: string
  speed: string
  temperature: string
  max_tokens: string
  api_key: string
}

function toForm(c: ModelSlotConfig): SlotForm {
  return {
    provider: c.provider ?? '',
    model: c.model ?? '',
    base_url: c.base_url ?? '',
    language: c.language ?? '',
    voice: c.voice ?? '',
    speed: c.speed != null ? String(c.speed) : '',
    temperature: c.temperature != null ? String(c.temperature) : '',
    max_tokens: c.max_tokens != null ? String(c.max_tokens) : '',
    api_key: '',
  }
}

function ModelSlotCard({
  type,
  title,
  description,
  config,
  show,
}: {
  type: ModelSlotType
  title: string
  description: string
  config: ModelSlotConfig
  show: { language: boolean; voice: boolean; speed: boolean; temperature: boolean; maxTokens: boolean }
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const [testResult, setTestResult] = useState<{ ok: boolean; latency_ms?: number | null; message?: string | null } | null>(null)

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<SlotForm>({
    defaultValues: toForm(config),
  })

  useEffect(() => {
    reset(toForm(config))
    setTestResult(null)
  }, [config, reset])

  const saveMutation = useMutation({
    mutationFn: (values: SlotForm) => {
      const num = (v: string): number | undefined => (v.trim() === '' ? undefined : Number(v))
      return updateModelSlot(type, {
        provider: values.provider || undefined,
        model: values.model || undefined,
        base_url: values.base_url || undefined,
        language: values.language || undefined,
        voice: values.voice || undefined,
        speed: num(values.speed),
        temperature: num(values.temperature),
        max_tokens: values.max_tokens.trim() === '' ? undefined : Math.trunc(Number(values.max_tokens)),
        ...(values.api_key ? { api_key: values.api_key } : {}),
      })
    },
    onSuccess: () => {
      toast.success(`${title} configuration saved`)
      void queryClient.invalidateQueries({ queryKey: ['model-config'] })
      reset(undefined, { keepValues: true })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const testMutation = useMutation({
    mutationFn: () => testModelSlot(type),
    onSuccess: (res) => setTestResult(res),
    onError: (err) => setTestResult({ ok: false, message: getErrorMessage(err) }),
  })

  const field = (label: string, name: keyof SlotForm, placeholder?: string, inputType = 'text'): React.JSX.Element => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={inputType} placeholder={placeholder} {...register(name)} />
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {config.has_api_key ? (
            <Badge variant="success">API key configured</Badge>
          ) : (
            <Badge variant="muted">No API key</Badge>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSubmit((v) => saveMutation.mutate(v))(e)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {field('Provider', 'provider', 'e.g. openai')}
            {field('Model', 'model', 'e.g. gpt-4o-mini')}
          </div>
          {field('Base URL', 'base_url', 'https://api.example.com/v1 (optional)')}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {show.language && field('Language', 'language', 'e.g. en')}
            {show.voice && field('Voice', 'voice', 'e.g. nova')}
            {show.speed && field('Speed', 'speed', '1.0', 'number')}
            {show.temperature && field('Temperature', 'temperature', '0.7', 'number')}
            {show.maxTokens && field('Max tokens', 'max_tokens', '1024', 'number')}
          </div>
          <div className="space-y-1.5">
            <Label>API key</Label>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={config.has_api_key ? '•••••••• (leave blank to keep)' : 'Enter API key'}
              {...register('api_key')}
            />
            <p className="text-xs text-muted-foreground">
              Keys are never displayed back. Saving a new key replaces the stored one.
            </p>
          </div>

          {testResult && (
            <div
              role="status"
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                testResult.ok ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'
              }`}
            >
              {testResult.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
              <span>
                {testResult.message ?? (testResult.ok ? 'Connection successful' : 'Connection failed')}
                {testResult.latency_ms != null && ` (${testResult.latency_ms} ms)`}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saveMutation.isPending || !isDirty}>
              {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
              Test connection
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function ModelLab(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [resetOpen, setResetOpen] = useState(false)
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['model-config'],
    queryFn: getModelConfig,
  })

  const resetMutation = useMutation({
    mutationFn: resetModelConfig,
    onSuccess: () => {
      toast.success('Model configuration reset to defaults')
      setResetOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['model-config'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <div>
      <PageHeader
        title="Model Lab"
        description="Global speech, language and voice model configuration used by all agents."
        actions={
          <Button variant="outline" onClick={() => setResetOpen(true)}>
            <RotateCcw className="size-4" /> Reset to defaults
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load model configuration" />
      ) : data ? (
        <div className="space-y-4">
          <ModelSlotCard
            type="stt"
            title="Speech-to-Text (STT)"
            description="Transcribes caller audio into text in real time."
            config={data.stt}
            show={{ language: true, voice: false, speed: false, temperature: false, maxTokens: false }}
          />
          <ModelSlotCard
            type="llm"
            title="Language Model (LLM)"
            description="The conversational brain behind every agent."
            config={data.llm}
            show={{ language: false, voice: false, speed: false, temperature: true, maxTokens: true }}
          />
          <ModelSlotCard
            type="tts"
            title="Text-to-Speech (TTS)"
            description="Converts agent responses into natural-sounding voice."
            config={data.tts}
            show={{ language: true, voice: true, speed: true, temperature: false, maxTokens: false }}
          />
        </div>
      ) : null}

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => resetMutation.mutate()}
        title="Reset model configuration?"
        description="All STT, LLM and TTS settings return to platform defaults. Stored API keys are removed."
        confirmLabel="Reset"
        loading={resetMutation.isPending}
      />
    </div>
  )
}
