import type { ExperienceDraft } from '../domain/experience'
import type { CreateExperienceResult, PublicPlaceSummary, TravelRepository } from './api'

export interface SqlResult<Row> {
  rows: Row[]
  rowCount?: number | null
}

export interface SqlExecutor {
  query<Row = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<SqlResult<Row>>
}

export interface SqlClient extends SqlExecutor {
  release(): void
}

export interface SqlPool extends SqlExecutor {
  connect(): Promise<SqlClient>
}

interface PlaceRow {
  id: string
  name: string
  category: string
  kind: 'fixed_shop' | 'mobile_stall'
}

interface IdempotencyRow {
  request_hash: string
  contribution_id: string | null
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super('同一幂等键不能用于不同的体验内容')
    this.name = 'IdempotencyConflictError'
  }
}

async function hashDraft(draft: ExperienceDraft): Promise<string> {
  const canonical = JSON.stringify({
    placeId: draft.placeId,
    experiencedAt: draft.experiencedAt,
    body: draft.body ?? null,
    ratings: Object.fromEntries(Object.entries(draft.ratings ?? {}).sort(([a], [b]) => a.localeCompare(b))),
    worthATrip: draft.worthATrip ?? null,
    wouldReturn: draft.wouldReturn ?? null,
    prices: (draft.prices ?? []).map((price) => ({
      productName: price.productName,
      specification: price.specification,
      unit: price.unit,
      amountMinor: price.amountMinor,
      currency: price.currency,
      kind: price.kind,
    })),
  })
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export class PostgresTravelRepository implements TravelRepository {
  constructor(private readonly pool: SqlPool) {}

  async listPublishedPlaces(input: {
    category?: string
    keyword?: string
    limit: number
  }): Promise<PublicPlaceSummary[]> {
    const result = await this.pool.query<PlaceRow>(
      `SELECT id, name, category, kind
       FROM places
       WHERE status = 'active'
         AND moderation_status = 'approved'
         AND ($1::text IS NULL OR category = $1)
         AND ($2::text IS NULL OR name ILIKE '%' || $2 || '%')
       ORDER BY name ASC
       LIMIT $3`,
      [input.category ?? null, input.keyword ?? null, input.limit],
    )
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      kind: row.kind,
    }))
  }

  async createExperience(input: {
    userId: string
    idempotencyKey: string
    draft: ExperienceDraft
  }): Promise<CreateExperienceResult> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const requestHash = await hashDraft(input.draft)
      const claimed = await client.query<{ id: string }>(
        `INSERT INTO api_idempotency_keys (user_id, idempotency_key, request_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, idempotency_key) DO NOTHING
         RETURNING id`,
        [input.userId, input.idempotencyKey, requestHash],
      )

      if (claimed.rows.length === 0) {
        const previous = await client.query<IdempotencyRow>(
          `SELECT request_hash, contribution_id
           FROM api_idempotency_keys
           WHERE user_id = $1 AND idempotency_key = $2
           FOR UPDATE`,
          [input.userId, input.idempotencyKey],
        )
        const row = previous.rows[0]
        if (!row || row.request_hash.trim() !== requestHash || !row.contribution_id) {
          throw new IdempotencyConflictError()
        }
        await client.query('COMMIT')
        return { id: row.contribution_id, replayed: true }
      }

      const ratings = input.draft.ratings ?? {}
      const contribution = await client.query<{ id: string }>(
        `INSERT INTO contributions (
           user_id, place_id, experienced_at, taste_score, value_score,
           portion_score, service_score, hygiene_score, worth_a_trip,
           would_return, body, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'submitted')
         RETURNING id`,
        [
          input.userId,
          input.draft.placeId,
          input.draft.experiencedAt,
          ratings.taste ?? null,
          ratings.value ?? null,
          ratings.portion ?? null,
          ratings.service ?? null,
          ratings.hygiene ?? null,
          input.draft.worthATrip ?? null,
          input.draft.wouldReturn ?? null,
          input.draft.body?.trim() || null,
        ],
      )
      const contributionId = contribution.rows[0]?.id
      if (!contributionId) throw new Error('数据库未返回体验记录 ID')

      for (const price of input.draft.prices ?? []) {
        const product = await client.query<{ id: string }>(
          `INSERT INTO products (place_id, name, specification, unit)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (place_id, name, specification, unit)
           DO UPDATE SET is_active = true
           RETURNING id`,
          [input.draft.placeId, price.productName.trim(), price.specification.trim(), price.unit.trim()],
        )
        const productId = product.rows[0]?.id
        if (!productId) throw new Error('数据库未返回商品 ID')
        await client.query(
          `INSERT INTO price_observations (
             product_id, contribution_id, amount_minor, currency, price_kind, observed_at
           ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [productId, contributionId, price.amountMinor, price.currency, price.kind, input.draft.experiencedAt],
        )
      }

      await client.query(
        `UPDATE api_idempotency_keys
         SET contribution_id = $1
         WHERE user_id = $2 AND idempotency_key = $3`,
        [contributionId, input.userId, input.idempotencyKey],
      )
      await client.query('COMMIT')
      return { id: contributionId, replayed: false }
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // Preserve the original transaction error.
      }
      throw error
    } finally {
      client.release()
    }
  }
}
