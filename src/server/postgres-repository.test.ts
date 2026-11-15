import { describe, expect, it, vi } from 'vitest'
import {
  IdempotencyConflictError,
  PostgresTravelRepository,
  type SqlClient,
  type SqlPool,
} from './postgres-repository'

function createPool(responses: Array<{ rows: Record<string, unknown>[] }> = []): {
  pool: SqlPool
  queries: string[]
  release: ReturnType<typeof vi.fn>
} {
  const queries: string[] = []
  let index = 0
  const query = vi.fn(async (sql: string) => {
    queries.push(sql.trim().replace(/\s+/g, ' '))
    return responses[index++] ?? { rows: [] }
  })
  const release = vi.fn()
  const client = { query, release } as unknown as SqlClient
  const pool = { query, connect: vi.fn().mockResolvedValue(client) } as unknown as SqlPool
  return { pool, queries, release }
}

const draft = {
  placeId: 'place-1',
  experiencedAt: '2026-11-15T08:00:00.000Z',
  body: '现场记录',
}

describe('PostgresTravelRepository', () => {
  it('lists only approved and active places', async () => {
    const { pool } = createPool([{
      rows: [{ id: 'p1', name: '热干面', category: '小吃', kind: 'fixed_shop' }],
    }])
    const repository = new PostgresTravelRepository(pool)
    const result = await repository.listPublishedPlaces({ category: '小吃', limit: 10 })
    expect(result).toEqual([{ id: 'p1', name: '热干面', category: '小吃', kind: 'fixed_shop' }])
  })

  it('writes contribution, prices and idempotency result in one transaction', async () => {
    const { pool, queries, release } = createPool([
      { rows: [{ id: 'claim-1' }] },
      { rows: [{ id: 'contribution-1' }] },
      { rows: [{ id: 'product-1' }] },
      { rows: [] },
      { rows: [] },
    ])
    const repository = new PostgresTravelRepository(pool)
    const result = await repository.createExperience({
      userId: 'user-1',
      idempotencyKey: 'key-1',
      draft: {
        ...draft,
        prices: [{
          productName: '热干面',
          specification: '标准碗',
          unit: '碗',
          amountMinor: 1200,
          currency: 'CNY',
          kind: 'paid_price',
        }],
      },
    })
    expect(result).toEqual({ id: 'contribution-1', replayed: false })
    expect(queries[0]).toBe('BEGIN')
    expect(queries.some((sql) => sql.startsWith('INSERT INTO contributions'))).toBe(true)
    expect(queries.some((sql) => sql.startsWith('INSERT INTO price_observations'))).toBe(true)
    expect(queries.at(-1)).toBe('COMMIT')
    expect(release).toHaveBeenCalledOnce()
  })

  it('rejects reuse of an idempotency key with different content', async () => {
    const { pool, queries } = createPool([
      { rows: [] },
      { rows: [{ request_hash: 'deliberately-not-matching', contribution_id: 'contribution-1' }] },
    ])
    const repository = new PostgresTravelRepository(pool)
    await expect(repository.createExperience({
      userId: 'user-1',
      idempotencyKey: 'key-1',
      draft,
    })).rejects.toBeInstanceOf(IdempotencyConflictError)
    expect(queries.some((sql) => sql.startsWith('INSERT INTO contributions'))).toBe(false)
    expect(queries).toContain('ROLLBACK')
  })

  it('rolls back and releases the connection on failure', async () => {
    const { pool, queries, release } = createPool([
      { rows: [{ id: 'claim-1' }] },
      { rows: [] },
    ])
    const repository = new PostgresTravelRepository(pool)
    await expect(repository.createExperience({
      userId: 'user-1',
      idempotencyKey: 'key-1',
      draft,
    })).rejects.toThrow('数据库未返回体验记录 ID')
    expect(queries).toContain('ROLLBACK')
    expect(release).toHaveBeenCalledOnce()
  })
})
