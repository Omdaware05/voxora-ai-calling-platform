import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select } from '../ui/select'
import { toast } from './Toaster'
import { getErrorMessage } from '../../lib/utils'
import { createCall } from '../../api/calls'
import { listAgents } from '../../api/agents'

const startCallSchema = z.object({
  agent_id: z.string().min(1, 'Select an agent'),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^[+\d][\d\s\-().]{5,}$/, 'Enter a valid phone number'),
})

type StartCallValues = z.infer<typeof startCallSchema>

interface StartCallDialogProps {
  open: boolean
  onClose: () => void
  agentId?: string
  defaultPhone?: string
}

export function StartCallDialog({ open, onClose, agentId, defaultPhone }: StartCallDialogProps): React.JSX.Element {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: agents } = useQueryListAgents(open)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StartCallValues>({
    resolver: zodResolver(startCallSchema),
    defaultValues: { agent_id: agentId ?? '', phone: defaultPhone ?? '' },
  })

  const mutation = useMutation({
    mutationFn: (values: StartCallValues) => createCall(values),
    onSuccess: () => {
      toast.success('Call initiated')
      void queryClient.invalidateQueries({ queryKey: ['calls'] })
      void queryClient.invalidateQueries({ queryKey: ['live-calls'] })
      reset()
      onClose()
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  })

  const onSubmit = (values: StartCallValues): void => {
    setServerError(null)
    mutation.mutate(values)
  }

  return (
    <Dialog open={open} onClose={onClose} labelledBy="dialog-title">
      <DialogTitle>Start a call</DialogTitle>
      <DialogDescription>Place an outbound call through the selected AI agent.</DialogDescription>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="startcall-agent">Agent</Label>
          <Select id="startcall-agent" {...register('agent_id')} disabled={!!agentId}>
            <option value="">Select an agent…</option>
            {(agents ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          {errors.agent_id && <p className="text-xs text-destructive">{errors.agent_id.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="startcall-phone">Phone number</Label>
          <Input
            id="startcall-phone"
            placeholder="+1 555 010 2030"
            autoComplete="tel"
            {...register('phone')}
          />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>
        {serverError && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {(isSubmitting || mutation.isPending) && <Loader2 className="size-4 animate-spin" />}
            Call now
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

// Agent options only load when the dialog is open
function useQueryListAgents(enabled: boolean) {
  return useQuery({
    queryKey: ['agents', 'all-for-call'],
    queryFn: () => listAgents({ page: 1, page_size: 100, status: 'active' }),
    enabled,
    select: (d) => d.items,
  })
}
