import { describe, expect, it } from 'vitest'
import { agentFormSchema } from '../pages/Agents'

const validAgent = {
  name: 'Priya — Sales Qualifier',
  business_id: '',
  status: 'active' as const,
  language: 'en',
  voice: 'nova',
  concurrency: '3',
  greeting: 'Hi, this is Priya.',
  closing: 'Thanks for your time.',
  system_prompt: 'You are a helpful sales agent.',
  instructions: 'Qualify the lead.',
  behavior: 'Friendly and concise.',
  conversation_rules: 'Never hang up first.',
  safety: 'Respect DNC requests.',
  stt_provider: 'deepgram',
  stt_model: 'nova-2',
  stt_language: 'en',
  llm_provider: 'openai',
  llm_model: 'gpt-4o-mini',
  llm_temperature: '0.7',
  llm_max_tokens: '1024',
  tts_provider: 'elevenlabs',
  tts_model: 'eleven_turbo_v2',
  tts_voice: 'Rachel',
  tts_speed: '1.0',
  questionnaire_id: '',
  advanced_json: '{"barge_in": true}',
}

describe('agentFormSchema', () => {
  it('accepts a fully valid agent', () => {
    const result = agentFormSchema.safeParse(validAgent)
    expect(result.success).toBe(true)
  })

  it('accepts a minimal agent (only name)', () => {
    const result = agentFormSchema.safeParse({ name: 'Minimal', status: 'draft', concurrency: '1' })
    expect(result.success).toBe(true)
  })

  it('rejects a missing name', () => {
    const result = agentFormSchema.safeParse({ ...validAgent, name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'name')).toBe(true)
    }
  })

  it('rejects invalid advanced JSON', () => {
    const result = agentFormSchema.safeParse({ ...validAgent, advanced_json: '{not json' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.join('.') === 'advanced_json'),
      ).toBe(true)
    }
  })

  it('rejects out-of-range concurrency and temperature', () => {
    const badConcurrency = agentFormSchema.safeParse({ ...validAgent, concurrency: '0' })
    expect(badConcurrency.success).toBe(false)

    const badTemp = agentFormSchema.safeParse({ ...validAgent, llm_temperature: '5' })
    expect(badTemp.success).toBe(false)
  })

  it('accepts numeric strings for optional number fields', () => {
    const result = agentFormSchema.safeParse({
      ...validAgent,
      concurrency: '5',
      llm_temperature: '0.5',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.concurrency).toBe('5')
      expect(result.data.llm_temperature).toBe('0.5')
    }
  })
})
