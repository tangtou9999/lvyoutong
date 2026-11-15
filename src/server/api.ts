import {
  validateExperienceDraft,
  type ExperienceDraft,
} from '../domain/experience'
import { IdempotencyConflictError } from './postgres-repository'

export interface AuthenticatedUser {
  id: string
}

export interface PublicPlaceSummary {
  id: string
  name: string
  category: string
  kind: 'fixed_shop' | 'mobile_stall'
}

export interface CreateExperienceResult {
  id: string
  replayed: boolean
}

export interface TravelRepository {
  listPublishedPlaces(input: {
    category?: string
    keyword?: string
    limit: number
  }): Promise<PublicPlaceSummary[]>
  createExperience(input: {
    userId: string
    idempotencyKey: string
    draft: ExperienceDraft
  }): Promise<CreateExperienceResult>
}

export interface ApiDependencies {
  repository: TravelRepository
  authenticate(request: Request): Promise<AuthenticatedUser | null>
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function parseLimit(value: string | null): number {
  if (!value) return 20
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 50 ? parsed : 20
}

function isExperienceDraft(value: unknown): value is ExperienceDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const draft = value as Record<string, unknown>
  if (typeof draft.placeId !== 'string' || typeof draft.experiencedAt !== 'string') return false
  if (draft.body !== undefined && typeof draft.body !== 'string') return false
  if (draft.worthATrip !== undefined && typeof draft.worthATrip !== 'boolean') return false
  if (draft.wouldReturn !== undefined && typeof draft.wouldReturn !== 'boolean') return false

  if (draft.ratings !== undefined) {
    if (!draft.ratings || typeof draft.ratings !== 'object' || Array.isArray(draft.ratings)) return false
    if (Object.values(draft.ratings).some((score) => typeof score !== 'number')) return false
  }

  if (draft.prices !== undefined) {
    if (!Array.isArray(draft.prices)) return false
    const validPrices = draft.prices.every((price) => {
      if (!price || typeof price !== 'object' || Array.isArray(price)) return false
      const item = price as Record<string, unknown>
      return typeof item.productName === 'string'
        && typeof item.specification === 'string'
        && typeof item.unit === 'string'
        && typeof item.amountMinor === 'number'
        && typeof item.currency === 'string'
        && (item.kind === 'menu_price' || item.kind === 'paid_price')
    })
    if (!validPrices) return false
  }

  return true
}

function pickExperienceDraft(value: ExperienceDraft): ExperienceDraft {
  return {
    placeId: value.placeId,
    experiencedAt: value.experiencedAt,
    ...(value.body !== undefined ? { body: value.body } : {}),
    ...(value.ratings !== undefined ? { ratings: value.ratings } : {}),
    ...(value.worthATrip !== undefined ? { worthATrip: value.worthATrip } : {}),
    ...(value.wouldReturn !== undefined ? { wouldReturn: value.wouldReturn } : {}),
    ...(value.prices !== undefined ? { prices: value.prices } : {}),
  }
}

export function createApi({ repository, authenticate }: ApiDependencies) {
  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname.replace(/\/$/, '') || '/'

    if (request.method === 'GET' && path === '/api/v1/health') {
      return json({ status: 'ok', service: 'lvyoutong-api' })
    }

    if (request.method === 'GET' && path === '/api/v1/places') {
      try {
        const places = await repository.listPublishedPlaces({
          category: url.searchParams.get('category') || undefined,
          keyword: url.searchParams.get('keyword')?.trim() || undefined,
          limit: parseLimit(url.searchParams.get('limit')),
        })
        return json({ items: places })
      } catch {
        return json({ error: '暂时无法读取地点，请稍后重试' }, 503)
      }
    }

    if (request.method === 'POST' && path === '/api/v1/experiences') {
      let user: AuthenticatedUser | null
      try {
        user = await authenticate(request)
      } catch {
        return json({ error: '身份验证服务暂时不可用，请稍后重试' }, 503)
      }
      if (!user) return json({ error: '请先登录后再提交体验' }, 401)

      const idempotencyKey = request.headers.get('idempotency-key')?.trim()
      if (!idempotencyKey || idempotencyKey.length > 160) {
        return json({ error: '缺少有效的 Idempotency-Key' }, 400)
      }

      let body: unknown
      try {
        const reader = request.body?.getReader()
        const chunks: Uint8Array[] = []
        let totalBytes = 0
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            totalBytes += value.byteLength
            if (totalBytes > 64 * 1024) {
              await reader.cancel()
              return json({ error: '请求内容过大，单次最多 64 KB' }, 413)
            }
            chunks.push(value)
          }
        }
        const bytes = new Uint8Array(totalBytes)
        let offset = 0
        for (const chunk of chunks) {
          bytes.set(chunk, offset)
          offset += chunk.byteLength
        }
        body = JSON.parse(new TextDecoder().decode(bytes))
      } catch {
        return json({ error: '请求内容不是有效 JSON' }, 400)
      }

      if (!isExperienceDraft(body)) {
        return json({ error: '体验记录格式无效' }, 400)
      }

      const draft = pickExperienceDraft(body)
      const errors = validateExperienceDraft(draft)
      if (errors.length > 0) return json({ error: '体验记录未通过校验', details: errors }, 422)

      try {
        const result = await repository.createExperience({
          userId: user.id,
          idempotencyKey,
          draft,
        })
        return json({ id: result.id, replayed: result.replayed }, result.replayed ? 200 : 201)
      } catch (error) {
        if (error instanceof IdempotencyConflictError) {
          return json({ error: error.message }, 409)
        }
        return json({ error: '体验记录暂时无法保存，请稍后重试' }, 503)
      }
    }

    return json({ error: '未找到该接口' }, 404)
  }
}
