import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Download,
  Loader2,
  Pencil,
  PhoneCall,
  Plus,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  bulkDeleteContacts,
  createContact,
  deleteContact,
  exportContacts,
  importContacts,
  listContacts,
  setDoNotCall,
  updateContact,
} from '../api/contacts'
import { listCampaigns, addContactsToCampaign } from '../api/campaigns'
import type { Campaign, Contact } from '../api/types'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Select } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from '../components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Skeleton, TableSkeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { Pagination } from '../components/ui/pagination'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { ErrorState } from '../components/common/ErrorState'
import { SearchInput } from '../components/common/SearchInput'
import { ActionsMenu } from '../components/common/ActionsMenu'
import { StartCallDialog } from '../components/common/StartCallDialog'
import { toast } from '../components/common/Toaster'
import { cn, downloadBlob, formatDateTime, getErrorMessage } from '../lib/utils'
import { useDebounce } from '../hooks/useDebounce'

const PAGE_SIZE = 20

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  phone: z.string().trim().min(1, 'Phone is required').regex(/^[+\d][\d\s\-().]{5,}$/, 'Enter a valid phone number'),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  status: z.string().optional(),
  tags: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

type ContactFormValues = z.infer<typeof contactSchema>

function ContactDialog({
  open,
  contact,
  onClose,
}: {
  open: boolean
  contact: Contact | null
  onClose: () => void
}): React.JSX.Element | null {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: contact?.name ?? '',
      phone: contact?.phone ?? '',
      email: contact?.email ?? '',
      status: contact?.status ?? '',
      tags: (contact?.tags ?? []).join(', '),
      notes: contact?.notes ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: (values: ContactFormValues) => {
      const payload: Partial<Contact> = {
        name: values.name,
        phone: values.phone,
        email: values.email || null,
        status: values.status || null,
        tags: values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        notes: values.notes || null,
      }
      return contact ? updateContact(contact.id, payload) : createContact(payload)
    },
    onSuccess: () => {
      toast.success(contact ? 'Contact updated' : 'Contact created')
      void queryClient.invalidateQueries({ queryKey: ['contacts'] })
      onClose()
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  })

  if (!open) return null

  return (
    <Dialog open={open} onClose={onClose} labelledBy="dialog-title">
      <DialogTitle>{contact ? 'Edit contact' : 'New contact'}</DialogTitle>
      <form onSubmit={(e) => void handleSubmit((v) => mutation.mutate(v))(e)} className="mt-4 space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Name</Label>
            <Input id="c-name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-phone">Phone</Label>
            <Input id="c-phone" placeholder="+1 555 010 2030" {...register('phone')} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-email">Email</Label>
            <Input id="c-email" type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-status">Status</Label>
            <Input id="c-status" placeholder="e.g. new, contacted" {...register('status')} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-tags">Tags (comma separated)</Label>
          <Input id="c-tags" placeholder="vip, q4-campaign" {...register('tags')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-notes">Notes</Label>
          <Textarea id="c-notes" rows={3} {...register('notes')} />
        </div>
        {serverError && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>
        )}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting || mutation.isPending}>
            {(isSubmitting || mutation.isPending) && <Loader2 className="size-4 animate-spin" />}
            {contact ? 'Save changes' : 'Create contact'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

function AddToCampaignDialog({
  contactIds,
  onClose,
}: {
  contactIds: string[]
  onClose: () => void
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const [campaignId, setCampaignId] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', 'all-for-add'],
    queryFn: listCampaigns,
  })
  const campaigns: Campaign[] = Array.isArray(data) ? data : (data?.items ?? [])

  const mutation = useMutation({
    mutationFn: () => addContactsToCampaign(campaignId, contactIds),
    onSuccess: (res) => {
      toast.success(`Added ${res.added} contact${res.added === 1 ? '' : 's'} to campaign`)
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      onClose()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return (
    <Dialog open onClose={onClose} labelledBy="dialog-title">
      <DialogTitle>Add to campaign</DialogTitle>
      <DialogDescription>
        Add {contactIds.length} contact{contactIds.length === 1 ? '' : 's'} to a campaign.
      </DialogDescription>
      <div className="mt-4 space-y-2">
        <Label>Campaign</Label>
        {isLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">No campaigns exist yet. Create one first.</p>
        ) : (
          <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">Select a campaign…</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
            ))}
          </Select>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!campaignId || mutation.isPending || campaigns.length === 0} onClick={() => mutation.mutate()}>
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          Add contacts
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

export function Contacts(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [addToCampaignIds, setAddToCampaignIds] = useState<string[] | null>(null)
  const [callContact, setCallContact] = useState<Contact | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const debouncedSearch = useDebounce(search)
  const debouncedTag = useDebounce(tagFilter)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['contacts', page, debouncedSearch, statusFilter, debouncedTag],
    queryFn: () =>
      listContacts({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        tag: debouncedTag || undefined,
      }),
  })

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['contacts'] })
  }

  const contacts = data?.items ?? []
  const total = data?.total ?? 0
  const allSelected = contacts.length > 0 && contacts.every((c) => selected.has(c.id))

  const toggleSelect = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteContact(id),
    onSuccess: () => {
      toast.success('Contact deleted')
      setDeleteTarget(null)
      setSelected((prev) => {
        const next = new Set(prev)
        return next
      })
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteContacts(ids),
    onSuccess: () => {
      toast.success('Selected contacts deleted')
      setSelected(new Set())
      setBulkDeleteOpen(false)
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const dncMutation = useMutation({
    mutationFn: ({ id, do_not_call }: { id: string; do_not_call: boolean }) =>
      setDoNotCall(id, do_not_call),
    onSuccess: (c) => {
      toast.success(c.do_not_call ? 'Added to do-not-call list' : 'Removed from do-not-call list')
      invalidate()
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const handleImport = async (file: File): Promise<void> => {
    setImporting(true)
    try {
      const res = await importContacts(file)
      toast.success(`Imported ${res.imported} contact${res.imported === 1 ? '' : 's'}`)
      if (res.errors?.length) toast.error(`${res.errors.length} row(s) failed: ${res.errors[0]}`)
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setImporting(false)
    }
  }

  const handleExport = async (): Promise<void> => {
    setExporting(true)
    try {
      const blob = await exportContacts({
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        tag: debouncedTag || undefined,
      })
      downloadBlob(blob, `contacts-export-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success('Contacts exported')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Your calling list — import, segment and call contacts."
        actions={
          <>
            <Button variant="outline" onClick={() => void handleExport()} disabled={exporting}>
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Export CSV
            </Button>
            <label
              className={cn(
                'inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground',
                importing && 'pointer-events-none opacity-50',
              )}
            >
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleImport(f)
                  e.target.value = ''
                }}
              />
              {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Import
            </label>
            <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
              <Plus className="size-4" /> Add contact
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search name, phone, email…" />
        <Input
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          placeholder="Status filter"
          className="w-36"
          aria-label="Filter by status"
        />
        <Input
          value={tagFilter}
          onChange={(e) => { setTagFilter(e.target.value); setPage(1) }}
          placeholder="Tag filter"
          className="w-36"
          aria-label="Filter by tag"
        />
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{selected.size} selected</Badge>
            <Button variant="outline" size="sm" onClick={() => setAddToCampaignIds([...selected])}>
              <UserPlus className="size-4" /> Add to campaign
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="size-4" /> Delete
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load contacts" />
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Add contacts manually or import them from CSV/Excel."
          actionLabel="Add contact"
          onAction={() => { setEditing(null); setDialogOpen(true) }}
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(contacts.map((c) => c.id)))
                      else setSelected(new Set())
                    }}
                    className="size-4 accent-primary"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow key={c.id} data-state={selected.has(c.id) ? 'selected' : undefined}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select ${c.name}`}
                      checked={selected.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="size-4 accent-primary"
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {c.name}
                    {c.do_not_call && (
                      <Badge variant="destructive" className="ml-2">DNC</Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{c.phone}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? '—'}</TableCell>
                  <TableCell>
                    {c.status ? <Badge variant="secondary">{c.status}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-48 flex-wrap gap-1">
                      {(c.tags ?? []).slice(0, 3).map((t) => (
                        <Badge key={t} variant="outline">{t}</Badge>
                      ))}
                      {(c.tags ?? []).length > 3 && (
                        <Badge variant="muted">+{(c.tags ?? []).length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(c.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <ActionsMenu
                      items={[
                        { label: 'Call now', icon: PhoneCall, onClick: () => setCallContact(c), disabled: !!c.do_not_call },
                        { label: 'Edit', icon: Pencil, onClick: () => { setEditing(c); setDialogOpen(true) } },
                        { label: 'Add to campaign', icon: UserPlus, onClick: () => setAddToCampaignIds([c.id]) },
                        {
                          label: c.do_not_call ? 'Remove from DNC' : 'Mark do-not-call',
                          icon: Trash2,
                          onClick: () => dncMutation.mutate({ id: c.id, do_not_call: !c.do_not_call }),
                        },
                        { label: 'Delete', icon: Trash2, destructive: true, onClick: () => setDeleteTarget(c) },
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

      {dialogOpen && (
        <ContactDialog
          key={editing?.id ?? 'new'}
          open={dialogOpen}
          contact={editing}
          onClose={() => { setDialogOpen(false); setEditing(null) }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This permanently deletes the contact."
        confirmLabel="Delete contact"
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate([...selected])}
        title={`Delete ${selected.size} contacts?`}
        description="This permanently deletes the selected contacts."
        confirmLabel="Delete selected"
        loading={bulkDeleteMutation.isPending}
      />

      {addToCampaignIds && (
        <AddToCampaignDialog contactIds={addToCampaignIds} onClose={() => setAddToCampaignIds(null)} />
      )}

      <StartCallDialog
        open={!!callContact}
        onClose={() => setCallContact(null)}
        defaultPhone={callContact?.phone}
      />
    </div>
  )
}
