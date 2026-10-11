import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PhoneCall, Radio } from 'lucide-react'
import { listCalls } from '../api/calls'
import { listAgents } from '../api/agents'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { TableSkeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { Pagination } from '../components/ui/pagination'
import { StatusBadge } from '../components/common/StatusBadge'
import { ErrorState } from '../components/common/ErrorState'
import { SearchInput } from '../components/common/SearchInput'
import { formatDateTime, formatSeconds } from '../lib/utils'
import { useDebounce } from '../hooks/useDebounce'

const PAGE_SIZE = 20

export function Calls(): React.JSX.Element {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [agentId, setAgentId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const debouncedSearch = useDebounce(search)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['calls', page, debouncedSearch, status, agentId, dateFrom, dateTo],
    queryFn: () =>
      listCalls({
        page,
        page_size: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: status || undefined,
        agent_id: agentId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
  })

  const { data: agentsData } = useQuery({
    queryKey: ['agents', 'filter-list'],
    queryFn: () => listAgents({ page: 1, page_size: 100 }),
  })

  const calls = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div>
      <PageHeader
        title="Calls"
        description="Every call placed by your agents."
        actions={
          <Link to="/live-calls">
            <Button variant="outline">
              <Radio className="size-4" /> Live calls
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search contact, phone…" />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="w-40" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="busy">Busy</option>
          <option value="no_answer">No answer</option>
          <option value="queued">Queued</option>
          <option value="ringing">Ringing</option>
        </Select>
        <Select value={agentId} onChange={(e) => { setAgentId(e.target.value); setPage(1) }} className="w-44" aria-label="Filter by agent">
          <option value="">All agents</option>
          {(agentsData?.items ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
        <div className="flex items-center gap-2">
          <Label htmlFor="date-from" className="text-xs text-muted-foreground">From</Label>
          <Input id="date-from" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="date-to" className="text-xs text-muted-foreground">To</Label>
          <Input id="date-to" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="w-40" />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={8} />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Failed to load calls" />
      ) : calls.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title="No calls yet"
          description="Calls will appear here once your agents start dialing."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Disposition</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to={`/calls/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.contact_name ?? 'Unknown'}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">{c.phone ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.agent_name ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{c.campaign_name ?? '—'}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{formatSeconds(c.duration_sec)}</TableCell>
                  <TableCell className="text-muted-foreground">{c.disposition ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(c.started_at ?? c.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
