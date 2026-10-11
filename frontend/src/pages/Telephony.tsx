import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FlaskConical, Loader2, Phone, Star, XCircle } from 'lucide-react'
import {
  getTelephony,
  saveVobizConfig,
  setDefaultProvider,
  testVobizConfig,
} from '../api/telephony'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ErrorState } from '../components/common/ErrorState'
import { StatusBadge } from '../components/common/StatusBadge'
import { toast } from '../components/common/Toaster'
import { formatDateTime, getErrorMessage } from '../lib/utils'

interface VobizFormValues {
  auth_id: string
  auth_token: string
  from_number: string
}

function VobizCard({ hasConfig }: { hasConfig: boolean }): React.JSX.Element {
  const queryClient = useQueryClient()
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null)

  const { register, handleSubmit, formState: { isDirty } } = useForm<VobizFormValues>({
    defaultValues: { auth_id: '', auth_token: '', from_number: '' },
  })

  const saveMutation = useMutation({
    mutationFn: (v: VobizFormValues) =>
      saveVobizConfig({
        auth_id: v.auth_id,
        ...(v.auth_token ? { auth_token: v.auth_token } : {}),
        from_number: v.from_number,
      }),
    onSuccess: () => {
      toast.success('VoBiz configuration saved')
      void queryClient.invalidateQueries({ queryKey: ['telephony'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const testMutation = useMutation({
    mutationFn: testVobizConfig,
    onSuccess: (res) => setTestResult(res),
    onError: (err) => setTestResult({ ok: false, message: getErrorMessage(err) }),
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="size-4" /> VoBiz
          </CardTitle>
          {hasConfig ? <Badge variant="success">Configured</Badge> : <Badge variant="muted">Not configured</Badge>}
        </div>
        <CardDescription>Primary SIP trunk provider for outbound calls.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSubmit((v) => saveMutation.mutate(v))(e)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vobiz-auth-id">Auth ID</Label>
              <Input id="vobiz-auth-id" autoComplete="off" {...register('auth_id', { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vobiz-from">From number</Label>
              <Input id="vobiz-from" placeholder="+91 98765 43210" {...register('from_number', { required: true })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vobiz-token">Auth token</Label>
            <Input
              id="vobiz-token"
              type="password"
              autoComplete="new-password"
              placeholder={hasConfig ? '•••••••• (leave blank to keep)' : 'Enter auth token'}
              {...register('auth_token')}
            />
            <p className="text-xs text-muted-foreground">Tokens are never displayed back.</p>
          </div>

          {testResult && (
            <div
              role="status"
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                testResult.ok ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'
              }`}
            >
              {testResult.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
              <span>{testResult.message ?? (testResult.ok ? 'Connection successful' : 'Connection failed')}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saveMutation.isPending || !isDirty}>
              {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
            <Button type="button" variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
              {testMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
              Test connection
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function PlaceholderProviderCard({ name, description }: { name: string; description: string }): React.JSX.Element {
  return (
    <Card className="opacity-90">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="size-4" /> {name}
          </CardTitle>
          <Badge variant="muted">Ready for configuration</Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4" aria-disabled="true">
          <div className="space-y-1.5 opacity-50">
            <Label>Account SID / Auth ID</Label>
            <Input disabled placeholder="Not yet available" />
          </div>
          <div className="space-y-1.5 opacity-50">
            <Label>Auth token</Label>
            <Input disabled type="password" placeholder="Not yet available" />
          </div>
          <p className="text-sm text-muted-foreground">
            {name} integration is on the roadmap. Configure VoBiz above to start calling today.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function Telephony(): React.JSX.Element {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['telephony'],
    queryFn: getTelephony,
  })

  const setDefault = useMutation({
    mutationFn: (provider: string) => setDefaultProvider(provider),
    onSuccess: () => {
      toast.success('Default provider updated')
      void queryClient.invalidateQueries({ queryKey: ['telephony'] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const configs = data?.configs ?? []
  const vobiz = configs.find((c) => c.provider.toLowerCase() === 'vobiz')

  return (
    <div>
      <PageHeader
        title="Telephony"
        description="Connect the phone providers that place your calls."
      />

      {isLoading ? (
        <div className="space-y-4"><Skeleton className="h-80 w-full" /><Skeleton className="h-60 w-full" /></div>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load telephony configuration" />
      ) : (
        <div className="space-y-4">
          {configs.length === 0 && (
            <EmptyState
              icon={Phone}
              title="No telephony provider configured"
              description="Add your VoBiz credentials below to enable outbound calling."
            />
          )}

          {configs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Providers</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {configs.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="flex items-center gap-3">
                        <span className="font-medium capitalize">{c.provider}</span>
                        <StatusBadge status={c.status} />
                        {c.has_credentials ? (
                          <Badge variant="success">Credentials stored</Badge>
                        ) : (
                          <Badge variant="warning">Missing credentials</Badge>
                        )}
                        {data?.default_provider === c.provider && (
                          <Badge variant="info"><Star className="size-3" /> Default</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="tabular-nums">{c.from_number ?? '—'}</span>
                        <span>{formatDateTime(c.created_at)}</span>
                        {data?.default_provider !== c.provider && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDefault.mutate(c.provider)}
                            disabled={setDefault.isPending}
                          >
                            Set default
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <VobizCard hasConfig={!!vobiz?.has_credentials} />
          <PlaceholderProviderCard
            name="Twilio"
            description="Global SMS and voice provider with elastic SIP trunking."
          />
          <PlaceholderProviderCard
            name="Plivo"
            description="Cloud communications platform for voice and messaging."
          />
        </div>
      )}
    </div>
  )
}
