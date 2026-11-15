import { describe, expect, it, vi } from 'vitest'
import { createApi, type TravelRepository } from './api'

function makeRepository(): TravelRepository {
  return {
    listPublishedPlaces: vi.fn().mockResolvedValue([
      { id: 'place-1', name: '测试小吃店', category: '小吃', kind: 'fixed_shop' },
    ]),
    createExperience: vi.fn().mockResolvedValue({ id: 'experience-1', replayed: false }),
  }
}

const validDraft = {
  placeId: 'place-1',
  experiencedAt: '2026-11-15T08:00:00.000Z',
  body: '现场体验记录。',
  ratings: { taste: 4 },
}

describe('HTTP API handler', () => {
  it('provides a health response without touching private data', async () => {
    const repository = makeRepository()
    const handle = createApi({ repository, authenticate: vi.fn() })
    const response = await handle(new Request('https://example.test/api/v1/health'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok', service: 'lvyoutong-api' })
    expect(repository.listPublishedPlaces).not.toHaveBeenCalled()
  })

  it('lists only repository-provided published places with bounded limits', async () => {
    const repository = makeRepository()
    const handle = createApi({ repository, authenticate: vi.fn() })
    const response = await handle(new Request(
      'https://example.test/api/v1/places?category=小吃&keyword=热干面&limit=500',
    ))
    expect(response.status).toBe(200)
    expect(repository.listPublishedPlaces).toHaveBeenCalledWith({
      category: '小吃',
      keyword: '热干面',
      limit: 20,
    })
  })

  it('rejects unauthenticated experience submissions', async () => {
    const repository = makeRepository()
    const handle = createApi({ repository, authenticate: vi.fn().mockResolvedValue(null) })
    const response = await handle(new Request('https://example.test/api/v1/experiences', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'try-1' },
      body: JSON.stringify(validDraft),
    }))
    expect(response.status).toBe(401)
    expect(repository.createExperience).not.toHaveBeenCalled()
  })

  it('requires an idempotency key before creating an experience', async () => {
    const repository = makeRepository()
    const handle = createApi({
      repository,
      authenticate: vi.fn().mockResolvedValue({ id: 'trusted-user-1' }),
    })
    const response = await handle(new Request('https://example.test/api/v1/experiences', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validDraft),
    }))
    expect(response.status).toBe(400)
    expect(repository.createExperience).not.toHaveBeenCalled()
  })

  it('uses authenticated identity, never a client-supplied userId', async () => {
    const repository = makeRepository()
    const handle = createApi({
      repository,
      authenticate: vi.fn().mockResolvedValue({ id: 'trusted-user-1' }),
    })
    const response = await handle(new Request('https://example.test/api/v1/experiences', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'try-2' },
      body: JSON.stringify({ ...validDraft, userId: 'attacker-user' }),
    }))
    expect(response.status).toBe(201)
    expect(repository.createExperience).toHaveBeenCalledWith({
      userId: 'trusted-user-1',
      idempotencyKey: 'try-2',
      draft: validDraft,
    })
  })

  it('strips untrusted fields and rejects malformed nested price objects', async () => {
    const repository = makeRepository()
    const handle = createApi({ repository, authenticate: vi.fn().mockResolvedValue({ id: 'trusted-user-1' }) })
    const response = await handle(new Request('https://example.test/api/v1/experiences', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'try-5' },
      body: JSON.stringify({ ...validDraft, role: 'admin', prices: [{ productName: 9 }] }),
    }))
    expect(response.status).toBe(400)
    expect(repository.createExperience).not.toHaveBeenCalled()
  })

  it('rejects invalid ratings and malformed JSON', async () => {
    const repository = makeRepository()
    const handle = createApi({
      repository,
      authenticate: vi.fn().mockResolvedValue({ id: 'trusted-user-1' }),
    })
    const invalid = await handle(new Request('https://example.test/api/v1/experiences', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'try-3' },
      body: JSON.stringify({ ...validDraft, ratings: { taste: 8 } }),
    }))
    const malformed = await handle(new Request('https://example.test/api/v1/experiences', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'try-4' },
      body: '{bad json',
    }))
    expect(invalid.status).toBe(422)
    expect(malformed.status).toBe(400)
    expect(repository.createExperience).not.toHaveBeenCalled()
  })


  it('returns a controlled service error when authentication infrastructure fails', async () => {
    const repository = makeRepository()
    const handle = createApi({ repository, authenticate: vi.fn().mockRejectedValue(new Error('auth unavailable')) })
    const response = await handle(new Request('https://example.test/api/v1/experiences', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'try-auth-down' },
      body: JSON.stringify(validDraft),
    }))
    expect(response.status).toBe(503)
    expect(repository.createExperience).not.toHaveBeenCalled()
  })

  it('rejects oversized request bodies before parsing or persistence', async () => {
    const repository = makeRepository()
    const handle = createApi({ repository, authenticate: vi.fn().mockResolvedValue({ id: 'trusted-user-1' }) })
    const response = await handle(new Request('https://example.test/api/v1/experiences', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'try-too-large' },
      body: JSON.stringify({ ...validDraft, body: 'a'.repeat(70 * 1024) }),
    }))
    expect(response.status).toBe(413)
    expect(repository.createExperience).not.toHaveBeenCalled()
  })

  it('returns a safe not-found response for unknown routes', async () => {
    const handle = createApi({ repository: makeRepository(), authenticate: vi.fn() })
    const response = await handle(new Request('https://example.test/api/v1/private'))
    expect(response.status).toBe(404)
  })
})
