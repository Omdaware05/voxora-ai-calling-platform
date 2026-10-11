import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  History,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react'
import {
  archiveQuestionnaire,
  createQuestionnaire,
  deleteQuestionnaire,
  downloadQuestionnaireTemplate,
  duplicateQuestionnaire,
  importQuestionnaires,
  listQuestionnaireVersions,
  listQuestionnaires,
  publishQuestionnaire,
  updateQuestionnaire,
} from '../api/questionnaires'
import { listAgents, updateAgent } from '../api/agents'
import type { Questionnaire, QuestionnaireQuestion, QuestionType } from '../api/types'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Select } from '../components/ui/select'
import { Switch } from '../components/ui/switch'
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '../components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Skeleton, TableSkeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { StatusBadge } from '../components/common/StatusBadge'
import { ErrorState } from '../components/common/ErrorState'
import { SearchInput } from '../components/common/SearchInput'
import { ActionsMenu } from '../components/common/ActionsMenu'
import { toast } from '../components/common/Toaster'
import { cn, downloadBlob, formatDateTime, getErrorMessage } from '../lib/utils'
import { useDebounce } from '../hooks/useDebounce'

const QUESTION_TYPES: QuestionType[] = [
  'text',
  'long_text',
  'yes_no',
  'multiple_choice',
  'number',
  'date',
  'phone',
]

const questionSchema = z.object({
  type: z.enum(['text', 'long_text', 'yes_no', 'multiple_choice', 'number', 'date', 'phone']),
  text: z.string().trim().min(1, 'Question text is required'),
  required: z.boolean(),
  options_text: z.string().optional(),
  conditional: z.string().optional(),
})

const questionnaireFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160),
  description: z.string().max(2000).optional(),
  questions: z.array(questionSchema).min(1, 'Add at least one question'),
})

type QuestionnaireFormValues = z.infer<typeof questionnaireFormSchema>

function formFrom(q: Questionnaire | null): QuestionnaireFormValues {
  return {
    name: q?.name ?? '',
    description: q?.description ?? '',
    questions: (q?.questions ?? []).map((qq) => ({
      type: QUESTION_TYPES.includes(qq.type) ? qq.type : 'text',
      text: qq.text ?? '',
      required: qq.required ?? false,
      options_text: (qq.options ?? []).join('\n'),
      conditional:
        qq.conditional && typeof qq.conditional === 'object' && 'expression' in qq.conditional
          ? String((qq.conditional as Record<string, unknown>).expression ?? '')
          : '',
    })),
  }
}

function toPayload(values: QuestionnaireFormValues): Partial<Questionnaire> {
  const questions: QuestionnaireQuestion[] = values.questions.map((q, i) => ({
    type: q.type,
    text: q.text,
    required: q.required,
    order: i + 1,
    options:
      q.type === 'multiple_choice'
        ? (q.options_text ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
        : undefined,
    conditional: q.conditional?.trim() ? { expression: q.conditional.trim() } : null,
  }))
  return { name: values.name, description: values.description || undefined, questions }
}

/* ------------------------------------------------------------------ */

function QuestionnaireBuilder({
  open,
  questionnaire,
  onClose,
}: {
  open: boolean
  questionnaire: Questionnaire | null
  onClose: () => void
}): React.JSX.Element | null {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<QuestionnaireFormValues>({
    resolver: zodResolver(questionnaireFormSchema),
    defaultValues: formFrom(questionnaire),
  })

  const { fields, append, remove, move } = useFieldArray({ control, name: 'questions' })
  const watchedQuestions = watch('questions')
  const questionsArrayError = (errors.questions as unknown as { message?: string } | undefined)?.message

  const mutation = useMutation({
    mutationFn: (values: QuestionnaireFormValues) =>
      questionnaire
        ? updateQuestionnaire(questionnaire.id, toPayload(values))
        : createQuestionnaire(toPayload(values)),
    onSuccess: (q) => {
      toast.success(questionnaire ? `Questionnaire "${q.name}" updated` : `Questionnaire "${q.name}" created`)
      void queryClient.invalidateQueries({ queryKey: ['questionnaires'] })
      onClose()
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Questionnaire builder">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">{questionnaire ? 'Edit questionnaire' : 'New questionnaire'}</h2>
            <p className="text-sm text-muted-foreground">Design the questions agents ask on calls.</p>
          </div>
          <button type="button" aria-label="Close builder" onClick={onClose} className="cursor-pointer rounded-md p-1.5 hover:bg-accent">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit((v) => mutation.mutate(v))(e)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 slim-scroll">
            <div className="space-y-1.5">
              <Label htmlFor="q-name">Name</Label>
              <Input id="q-name" placeholder="e.g. Sales qualification" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-desc">Description</Label>
              <Textarea id="q-desc" rows={2} placeholder="What this questionnaire is for…" {...register('description')} />
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Questions ({fields.length})</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ type: 'text', text: '', required: false, options_text: '', conditional: '' })}
              >
                <Plus className="size-4" /> Add question
              </Button>
            </div>
            {questionsArrayError && (
              <p className="text-xs text-destructive">{questionsArrayError}</p>
            )}

            <div className="space-y-3">
              {fields.map((f, i) => {
                const qType = watchedQuestions[i]?.type
                const qError = errors.questions?.[i]
                return (
                  <div key={f.id} className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Question {i + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)} className="cursor-pointer rounded p-1 hover:bg-accent disabled:opacity-30">
                          <ArrowUp className="size-4" />
                        </button>
                        <button type="button" aria-label="Move down" disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} className="cursor-pointer rounded p-1 hover:bg-accent disabled:opacity-30">
                          <ArrowDown className="size-4" />
                        </button>
                        <button type="button" aria-label="Remove question" onClick={() => remove(i)} className="cursor-pointer rounded p-1 text-destructive hover:bg-destructive/10">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
                      <div className="space-y-1.5">
                        <Label>Type</Label>
                        <Select {...register(`questions.${i}.type`)}>
                          {QUESTION_TYPES.map((t) => (
                            <option key={t} value={t}>{t.replace('_', ' ')}</option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Question text</Label>
                        <Input placeholder="What is your…" {...register(`questions.${i}.text`)} />
                        {qError?.text && <p className="text-xs text-destructive">{qError.text.message}</p>}
                      </div>
                    </div>
                    {qType === 'multiple_choice' && (
                      <div className="mt-3 space-y-1.5">
                        <Label>Options (one per line)</Label>
                        <Textarea rows={3} placeholder={'Yes\nNo\nMaybe'} {...register(`questions.${i}.options_text`)} />
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Conditional (optional)</Label>
                        <Input placeholder="e.g. q1 == yes" {...register(`questions.${i}.conditional`)} />
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <Switch
                          checked={!!watchedQuestions[i]?.required}
                          onCheckedChange={(checked) =>
                            setValue(`questions.${i}.required`, checked, { shouldDirty: true })
                          }
                          label="Required"
                        />
                        <Label>Required</Label>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {serverError && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {(isSubmitting || mutation.isPending) && <Loader2 className="size-4 animate-spin" />}
              {questionnaire ? 'Save changes' : 'Create questionnaire'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function VersionsDialog({ questionnaire, onClose }: { questionnaire: Questionnaire; onClose: () => void }): React.JSX.Element {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['questionnaires', questionnaire.id, 'versions'],
    queryFn: () => listQuestionnaireVersions(questionnaire.id),
  })
  return (
    <Dialog open onClose={onClose} labelledBy="dialog-title">
      <DialogTitle>Versions — {questionnaire.name}</DialogTitle>
      <DialogDescription>Snapshot history of this questionnaire.</DialogDescription>
      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load versions" />
        ) : (data ?? []).length === 0 ? (
          <EmptyState icon={History} title="No versions yet" description="Saving changes creates version snapshots." />
        ) : (
          <ul className="space-y-2">
            {(data ?? []).map((v) => (
              <li key={v.id} className="rounded-md border px-3 py-2">
                <p className="text-sm font-medium">v{v.version}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(v.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  )
}

function AssignAgentDialog({ questionnaire, onClose }: { questionnaire: Questionnaire; onClose: () => void }): React.JSX.Element {
  const queryClient = useQueryClient()
  const [agentId, setAgentId] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['agents', 'all-assign'],
    queryFn: () => listAgents({ page: 1, page_size: 100 }),
  })
  const mutation = useMutation({
    mutationFn: () => updateAgent(agentId, { questionnaire_id: questionnaire.id }),
    onSuccess: () => {
      toast.success('Questionnaire assigned to agent')
      void queryClient.invalidateQueries({ queryKey: ['agents'] })
      onClose()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
  return (
    <Dialog open onClose={onClose} labelledBy="dialog-title">
      <DialogTitle>Assign to agent</DialogTitle>
      <DialogDescription>
        Attach “{questionnaire.name}” to an agent so it asks these questions on calls.
      </DialogDescription>
      <div className="mt-4 space-y-2">
        <Label>Agent</Label>
        {isLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <Select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">Select an agent…</option>
            {(data?.items ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!agentId || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Assign
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */

export function Questionnaires(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editing, setEditing] = useState<Questionnaire | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Questionnaire | null>(null)
  const [versionsTarget, setVersionsTarget] = useState<Questionnaire | null>(null)
  const [assignTarget, setAssignTarget] = useState<Questionnaire | null>(null)
  const [importing, setImporting] = useState(false)

  const debouncedSearch = useDebounce(search)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['questionnaires', debouncedSearch, statusFilter],
    queryFn: () => listQuestionnaires({ status: statusFilter || undefined, page: 1, page_size: 100 }),
  })

  const items = (Array.isArray(data) ? data : (data?.items ?? [])).filter((q) =>
    debouncedSearch
      ? q.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      : true,
  )

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['questionnaires'] })
  }

  const action = (
    fn: (id: string) => Promise<unknown>,
    success: string,
  ): ((id: string) => void) => {
    return (id: string) => {
      fn(id)
        .then(() => { toast.success(success); invalidate() })
        .catch((err: unknown) => toast.error(getErrorMessage(err)))
    }
  }

  const doDuplicate = action((id) => duplicateQuestionnaire(id), 'Questionnaire duplicated')
  const doPublish = action((id) => publishQuestionnaire(id), 'Questionnaire published')
  const doArchive = action((id) => archiveQuestionnaire(id), 'Questionnaire archived')

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteQuestionnaire(id),
    onSuccess: () => { toast.success('Questionnaire deleted'); setDeleteTarget(null); invalidate() },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const handleImportFile = async (file: File): Promise<void> => {
    setImporting(true)
    try {
      // Client-side validation with xlsx before upload
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      if (!sheet) throw new Error('The workbook has no sheets.')
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
      if (rows.length === 0) throw new Error('No rows found in the first sheet.')
      const cols = Object.keys(rows[0] ?? {}).map((c) => c.toLowerCase())
      const hasQuestionCol = cols.some((c) => ['question', 'text', 'question_text'].includes(c))
      if (!hasQuestionCol) {
        throw new Error('Expected a "question" (or "text") column in the first sheet.')
      }
      const res = await importQuestionnaires(file)
      toast.success(`Imported ${res.imported} questionnaire${res.imported === 1 ? '' : 's'} (${rows.length} rows parsed)`)
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setImporting(false)
    }
  }

  const handleDownloadTemplate = async (): Promise<void> => {
    try {
      const blob = await downloadQuestionnaireTemplate()
      downloadBlob(blob, 'questionnaire-template.xlsx')
      toast.success('Template downloaded')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div>
      <PageHeader
        title="Questionnaires"
        description="Question sets your agents ask during calls."
        actions={
          <>
            <Button variant="outline" onClick={() => void handleDownloadTemplate()}>
              <Download className="size-4" /> Template
            </Button>
            <label
              className={cn(
                'inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground',
                importing && 'pointer-events-none opacity-50',
              )}
            >
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleImportFile(f)
                  e.target.value = ''
                }}
              />
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Import Excel
            </label>
            <Button onClick={() => { setEditing(null); setBuilderOpen(true) }}>
              <Plus className="size-4" /> New questionnaire
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search questionnaires…" />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load questionnaires" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No questionnaires yet"
          description="Build a question set or import one from Excel to get started."
          actionLabel="New questionnaire"
          onAction={() => { setEditing(null); setBuilderOpen(true) }}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Questions</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((q) => (
              <TableRow key={q.id}>
                <TableCell>
                  <button
                    type="button"
                    className="cursor-pointer font-medium text-primary hover:underline"
                    onClick={() => { setEditing(q); setBuilderOpen(true) }}
                  >
                    {q.name}
                  </button>
                  {q.description && (
                    <p className="max-w-xs truncate text-xs text-muted-foreground">{q.description}</p>
                  )}
                </TableCell>
                <TableCell><StatusBadge status={q.status} /></TableCell>
                <TableCell className="text-right tabular-nums">{q.questions?.length ?? 0}</TableCell>
                <TableCell className="text-muted-foreground">{formatDateTime(q.updated_at)}</TableCell>
                <TableCell className="text-right">
                  <ActionsMenu
                    items={[
                      { label: 'Edit', icon: Pencil, onClick: () => { setEditing(q); setBuilderOpen(true) } },
                      { label: 'Duplicate', icon: Copy, onClick: () => doDuplicate(q.id) },
                      ...(q.status !== 'published'
                        ? [{ label: 'Publish', icon: CheckCircle2, onClick: () => doPublish(q.id) }]
                        : [{ label: 'Archive', icon: Archive, onClick: () => doArchive(q.id) }]),
                      { label: 'Assign to agent', icon: UserPlus, onClick: () => setAssignTarget(q) },
                      { label: 'Versions', icon: History, onClick: () => setVersionsTarget(q) },
                      { label: 'Delete', icon: Trash2, destructive: true, onClick: () => setDeleteTarget(q) },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {builderOpen && (
        <QuestionnaireBuilder
          key={editing?.id ?? 'new'}
          open={builderOpen}
          questionnaire={editing}
          onClose={() => { setBuilderOpen(false); setEditing(null) }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This permanently deletes the questionnaire."
        confirmLabel="Delete questionnaire"
        loading={deleteMutation.isPending}
      />

      {versionsTarget && (
        <VersionsDialog questionnaire={versionsTarget} onClose={() => setVersionsTarget(null)} />
      )}
      {assignTarget && (
        <AssignAgentDialog questionnaire={assignTarget} onClose={() => setAssignTarget(null)} />
      )}
    </div>
  )
}
