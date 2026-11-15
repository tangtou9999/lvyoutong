import {
  validateExperienceDraft,
  type ExperienceDraft,
} from '../domain/experience'

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
  return typeof draft.placeId === 'string'
    && typeof draft.experiencedAt === 'string'
    && (draft.body === undefined || typeof draft.body === 'string')
    && (draft.ratings === undefined || (
      typeof draft.ratings === 'object'
      && draft.ratings !== null
      && !Array.isArray(draft.ratings)
    ))
    && (draft.prices === undefined || Array.isArray(draft.prices))
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
      const user = await authenticate(request)
      if (!user) return json({ error: '请先登录后再提交体验' }, 401)

      const idempotencyKey = request.headers.get('idempotency-key')?.trim()
      if (!idempotencyKey || idempotencyKey.length > 160) {
        return json({ error: '缺少有效的 Idempotency-Key' }, 400)
      }

      let body: unknown
      try {
        body = await request.json()
      } catch {
        return json({ error: '请求内容不是有效 JSON' }, 400)
      }

      if (!isExperienceDraft(body)) {
        return json({ error: '体验记录格式无效' }, 400)
      }

      const errors = validateExperienceDraft(body)
      if (errors.length > 0) return json({ error: '体验记录未通过校验', details: errors }, 422)

      try {
        const result = await repository.createExperience({
          userId: user.id,
          idempotencyKey,
          draft: body,
        })
        return json({ id: result.id, replayed: result.replayed }, result.replayed ? 200 : 201)
      } catch {
        return json({ error: '体验记录暂时无法保存，请稍后重试' }, 503)
      }
    }

    return json({ error: '未找到该接口' }, 404)
  }
}
