/* Shared API types for the Voxora frontend. All payloads live under /api/v1. */

export interface PagedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

/* ---------- Auth ---------- */

export type UserRole = 'admin' | 'manager' | 'agent' | string

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  tenant_id?: string | null
  tenant_name?: string | null
  avatar_url?: string | null
  created_at?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface LoginPayload {
  email: string
  password: string
}

/* ---------- Businesses ---------- */

export interface Business {
  id: string
  name: string
  industry?: string | null
  timezone?: string | null
  phone?: string | null
  email?: string | null
  agent_count?: number
  created_at?: string
}

/* ---------- Agents ---------- */

export type AgentStatus = 'active' | 'inactive' | 'draft' | string

export interface Agent {
  id: string
  name: string
  business_id?: string | null
  business_name?: string | null
  status: AgentStatus
  voice?: string | null
  language?: string | null
  concurrency?: number | null
  greeting?: string | null
  closing?: string | null
  system_prompt?: string | null
  instructions?: string | null
  behavior?: string | null
  conversation_rules?: string | null
  safety?: string | null
  questionnaire_id?: string | null
  questionnaire_name?: string | null
  advanced_config?: Record<string, unknown> | null
  calls_today?: number
  interest_rate?: number | null
  last_active_at?: string | null
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export interface AgentWorkspace {
  agent: Agent
  active_calls: number
  calls_today: number
  recent_calls: CallSummary[]
}

export interface AgentVersion {
  id: string
  version: number
  created_at: string
  created_by?: string | null
  summary?: string | null
}

export interface AgentQueryParams {
  business_id?: string
  status?: string
  search?: string
  page?: number
  page_size?: number
}

/* ---------- Model config ---------- */

export interface ModelSlotConfig {
  provider?: string | null
  model?: string | null
  base_url?: string | null
  has_api_key: boolean
  language?: string | null
  voice?: string | null
  speed?: number | null
  temperature?: number | null
  max_tokens?: number | null
}

export interface ModelConfigResponse {
  stt: ModelSlotConfig
  llm: ModelSlotConfig
  tts: ModelSlotConfig
}

export type ModelSlotType = 'stt' | 'llm' | 'tts'

export interface ModelTestResult {
  ok: boolean
  latency_ms?: number | null
  message?: string | null
  mode?: string | null
}

/* ---------- Questionnaires ---------- */

export type QuestionType =
  | 'text'
  | 'long_text'
  | 'yes_no'
  | 'multiple_choice'
  | 'number'
  | 'date'
  | 'phone'

export interface QuestionnaireQuestion {
  id?: string
  type: QuestionType
  text: string
  required: boolean
  order: number
  options?: string[]
  conditional?: Record<string, unknown> | null
}

export interface Questionnaire {
  id: string
  name: string
  description?: string | null
  status: 'draft' | 'published' | 'archived' | string
  questions: QuestionnaireQuestion[]
  version?: number
  created_at?: string
  updated_at?: string
}

export interface QuestionnaireVersion {
  id: string
  version: number
  created_at: string
  created_by?: string | null
  summary?: string | null
}

/* ---------- Contacts ---------- */

export interface Contact {
  id: string
  name: string
  phone: string
  email?: string | null
  status?: string | null
  tags?: string[]
  do_not_call?: boolean
  business_id?: string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export interface ContactQueryParams {
  search?: string
  status?: string
  tag?: string
  page?: number
  page_size?: number
}

/* ---------- Campaigns ---------- */

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'stopped'
  | string

export interface Campaign {
  id: string
  name: string
  status: CampaignStatus
  agent_id?: string | null
  agent_name?: string | null
  questionnaire_id?: string | null
  questionnaire_name?: string | null
  concurrency?: number | null
  caller_id?: string | null
  scheduled_at?: string | null
  total_contacts?: number
  progress?: number | null
  created_at?: string
  updated_at?: string
}

export interface CampaignStats {
  total: number
  attempted: number
  answered: number
  completed: number
  failed: number
  busy: number
  no_answer: number
  interested: number
  qualified: number
  avg_duration_sec?: number | null
}

/* ---------- Calls ---------- */

export type CallStatus =
  | 'queued'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'busy'
  | 'no_answer'
  | 'cancelled'
  | string

export interface CallSummary {
  id: string
  contact_name?: string | null
  phone?: string | null
  agent_id?: string | null
  agent_name?: string | null
  campaign_id?: string | null
  campaign_name?: string | null
  status: CallStatus
  direction?: string | null
  disposition?: string | null
  termination_reason?: string | null
  duration_sec?: number | null
  started_at?: string | null
  ended_at?: string | null
  created_at?: string
}

export interface TranscriptSegment {
  speaker: 'agent' | 'customer' | string
  text: string
  offset_sec?: number | null
  created_at?: string
}

export interface CallTranscript {
  segments: TranscriptSegment[]
  full_text?: string | null
}

export interface CallEvent {
  id?: string
  type: string
  message?: string | null
  created_at?: string
  data?: Record<string, unknown> | null
}

export interface CallAnalysis {
  intent?: string | null
  lead_score?: number | null
  interest?: string | null
  followup_required?: boolean | null
  summary?: string | null
}

export interface CallDetail extends CallSummary {
  analysis?: CallAnalysis | null
  recording_url?: string | null
}

export interface CallQueryParams {
  status?: string
  agent_id?: string
  campaign_id?: string
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  page_size?: number
}

export interface CreateCallPayload {
  agent_id: string
  contact_id?: string
  phone?: string
  campaign_id?: string
}

/* ---------- Leads ---------- */

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'interested'
  | 'qualified'
  | 'converted'
  | 'lost'
  | string

export interface Lead {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  status: LeadStatus
  score?: number | null
  interest?: string | null
  call_id?: string | null
  agent_id?: string | null
  agent_name?: string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

/* ---------- Follow-ups ---------- */

export type FollowUpStatus = 'pending' | 'completed' | 'cancelled' | 'overdue' | string

export interface FollowUp {
  id: string
  title: string
  description?: string | null
  status: FollowUpStatus
  scheduled_at: string
  completed_at?: string | null
  contact_id?: string | null
  contact_name?: string | null
  lead_id?: string | null
  call_id?: string | null
  assigned_to?: string | null
  created_at?: string
}

/* ---------- Telephony ---------- */

export interface TelephonyConfig {
  id: string
  provider: string
  from_number?: string | null
  is_default: boolean
  status: string
  has_credentials: boolean
  created_at?: string
}

export interface TelephonyOverview {
  configs: TelephonyConfig[]
  default_provider?: string | null
}

/* ---------- Analytics ---------- */

export interface AnalyticsOverview {
  calls_today: number
  completed_calls: number
  active_calls: number
  answer_rate: number
  avg_duration_sec: number
  interested_leads: number
  qualified_leads: number
  followups_due: number
  ai_usage_minutes: number
  est_cost: number
}

export interface CallsOverTimePoint {
  date: string
  calls: number
  completed?: number
  answered?: number
}

export interface OutcomeSlice {
  name: string
  value: number
}

export interface DurationBucket {
  range: string
  calls: number
}

export interface AgentPerformance {
  agent_id: string
  agent_name: string
  calls: number
  answer_rate: number
  avg_duration_sec: number
  interested: number
  qualified: number
}

export interface CampaignPerformance {
  campaign_id: string
  campaign_name: string
  status: string
  total: number
  attempted: number
  answered: number
  interested: number
  qualified: number
}

export interface FunnelStage {
  stage: string
  count: number
}

export interface UsageSummary {
  ai_usage_minutes: number
  est_cost: number
  calls: number
  period?: string | null
}

/* ---------- Dograh ---------- */

export interface DograhHealth {
  ok: boolean
  message?: string | null
  configured?: boolean
}

export interface DograhWorkflow {
  id: string
  name: string
  status: string
  published?: boolean
  updated_at?: string
}
