import { describe, expect, it } from 'vitest'
import {
  deriveEvidenceLevel,
  validateExperienceDraft,
  type ExperienceDraft,
} from './experience'

const validDraft: ExperienceDraft = {
  placeId: 'place-123',
  experiencedAt: '2026-11-15T08:00:00.000Z',
  body: '汤底鲜，排队约十分钟。',
  ratings: { taste: 4, value: 5 },
}

describe('体验记录校验', () => {
  it('接受包含地点、时间和有效体验内容的记录', () => {
    expect(validateExperienceDraft(validDraft)).toEqual([])
  })

  it('拒绝缺少地点或无效时间的记录', () => {
    const errors = validateExperienceDraft({
      ...validDraft,
      placeId: ' ',
      experiencedAt: 'not-a-date',
    })
    expect(errors).toContain('请选择或匹配一个地点')
    expect(errors).toContain('体验时间格式无效')
  })

  it('评分必须是 1 到 5 的整数', () => {
    const errors = validateExperienceDraft({
      ...validDraft,
      ratings: { taste: 6, value: 3.5 },
    })
    expect(errors).toContain('taste评分必须是 1 到 5 的整数')
    expect(errors).toContain('value评分必须是 1 到 5 的整数')
  })

  it('没有体验内容时不能提交空记录', () => {
    expect(validateExperienceDraft({
      placeId: 'place-123',
      experiencedAt: '2026-11-15T08:00:00.000Z',
    })).toContain('至少记录一项体验文字、评分或价格信息')
  })

  it('价格必须包含规格、单位、非负金额和币种代码', () => {
    const errors = validateExperienceDraft({
      ...validDraft,
      prices: [{
        productName: '牛肉粉',
        specification: '',
        unit: '碗',
        amountMinor: -1,
        currency: 'cny',
        kind: 'paid_price',
      }],
    })
    expect(errors).toContain('第 1 条价格记录缺少商品规格')
    expect(errors).toContain('第 1 条价格记录金额无效')
    expect(errors).toContain('第 1 条价格记录币种必须使用三位大写代码')
  })

  it('证据等级不把现场照片冒充消费凭证', () => {
    expect(deriveEvidenceLevel([{ kind: 'on_site_photo', verified: true }])).toBe('on_site')
    expect(deriveEvidenceLevel([{ kind: 'purchase_proof', verified: true }])).toBe('verified_consumption')
    expect(deriveEvidenceLevel([{ kind: 'purchase_proof', verified: false }])).toBe('self_reported')
  })
})
