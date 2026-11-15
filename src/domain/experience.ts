export const ratingDimensions = [
  'taste',
  'value',
  'portion',
  'service',
  'hygiene',
] as const

export type RatingDimension = (typeof ratingDimensions)[number]
export type RatingScores = Partial<Record<RatingDimension, number>>

export interface PriceObservationDraft {
  productName: string
  specification: string
  unit: string
  amountMinor: number
  currency: string
  kind: 'menu_price' | 'paid_price'
}

export interface ExperienceDraft {
  placeId: string
  experiencedAt: string
  body?: string
  ratings?: RatingScores
  worthATrip?: boolean
  wouldReturn?: boolean
  prices?: PriceObservationDraft[]
}

export type EvidenceKind =
  | 'on_site_photo'
  | 'purchase_proof'
  | 'menu_or_price'
  | 'user_statement'

export interface EvidenceCheck {
  kind: EvidenceKind
  verified: boolean
}

export type EvidenceLevel =
  | 'verified_consumption'
  | 'on_site'
  | 'self_reported'

const ratingSet = new Set<string>(ratingDimensions)

export function validateExperienceDraft(draft: ExperienceDraft): string[] {
  const errors: string[] = []

  if (!draft.placeId.trim()) errors.push('请选择或匹配一个地点')

  if (!Number.isFinite(Date.parse(draft.experiencedAt))) {
    errors.push('体验时间格式无效')
  }

  const body = draft.body?.trim() ?? ''
  if (body.length > 2000) errors.push('体验文字不能超过 2000 个字符')

  const ratings = draft.ratings ?? {}
  for (const [dimension, score] of Object.entries(ratings)) {
    if (!ratingSet.has(dimension)) {
      errors.push(`未知评价维度：${dimension}`)
    } else if (!Number.isInteger(score) || (score as number) < 1 || (score as number) > 5) {
      errors.push(`${dimension}评分必须是 1 到 5 的整数`)
    }
  }

  const prices = draft.prices ?? []
  prices.forEach((price, index) => {
    const prefix = `第 ${index + 1} 条价格记录`
    if (!price.productName.trim()) errors.push(`${prefix}缺少商品名称`)
    if (!price.specification.trim()) errors.push(`${prefix}缺少商品规格`)
    if (!price.unit.trim()) errors.push(`${prefix}缺少计价单位`)
    if (!Number.isSafeInteger(price.amountMinor) || price.amountMinor < 0) {
      errors.push(`${prefix}金额无效`)
    }
    if (!/^[A-Z]{3}$/.test(price.currency)) {
      errors.push(`${prefix}币种必须使用三位大写代码`)
    }
  })

  const hasRating = Object.values(ratings).some((score) => score !== undefined)
  if (!body && !hasRating && prices.length === 0) {
    errors.push('至少记录一项体验文字、评分或价格信息')
  }

  return errors
}

/**
 * Evidence describes the level of supporting material, not whether an opinion is correct.
 * A verified receipt is stronger purchase evidence; verified photos only support on-site presence.
 */
export function deriveEvidenceLevel(evidence: EvidenceCheck[]): EvidenceLevel {
  if (evidence.some((item) => item.kind === 'purchase_proof' && item.verified)) {
    return 'verified_consumption'
  }
  if (evidence.some((item) => item.kind === 'on_site_photo' && item.verified)) {
    return 'on_site'
  }
  return 'self_reported'
}
