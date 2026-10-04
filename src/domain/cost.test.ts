import { describe, expect, it } from 'vitest'
import { ingUnitCost, itemCost, level, makeCatalog, menuCost, prepUnitCost, rateOf, uses } from './cost'
import { recordChangedMenus, recordMenuCost, withPriceHistory } from './history'
import type { Ingredient, Menu, Prep } from './types'

const ing = (id: string, price: number, packAmount: number, packUnit: Ingredient['packUnit'], yieldPct = 100): Ingredient => ({
  id, name: id, category: 'その他', supplier: '', price, packAmount, packUnit, yieldPct, history: [],
})

// モックアップのサンプルデータ（豚の生姜焼き定食）
const ings = [
  ing('pork', 2080, 1, 'kg'),
  ing('onion', 2000, 10, 'kg', 90),
  ing('cabbage', 180, 1, 'kg', 85),
  ing('ginger', 1200, 1, 'kg', 80),
  ing('shoyu', 510, 1.8, 'L'),
  ing('mirin', 620, 1.8, 'L'),
  ing('sugar', 260, 1, 'kg'),
  ing('rice', 4800, 10, 'kg'),
  ing('egg', 280, 10, '個'),
]
const tare: Prep = {
  id: 'tare', name: '生姜焼きのタレ', yieldAmount: 450, yieldUnit: 'ml',
  items: [{ ref: 'i:shoyu', qty: 200 }, { ref: 'i:mirin', qty: 200 }, { ref: 'i:sugar', qty: 60 }, { ref: 'i:ginger', qty: 50 }],
}
const gohan: Prep = { id: 'gohan', name: 'ご飯', yieldAmount: 2300, yieldUnit: 'g', items: [{ ref: 'i:rice', qty: 1000 }] }
const butadonTare: Prep = {
  id: 'dtare', name: '豚丼のタレ', yieldAmount: 320, yieldUnit: 'ml',
  items: [{ ref: 'p:tare', qty: 300 }, { ref: 'i:sugar', qty: 30 }],
}
const teishoku: Menu = {
  id: 'm1', name: '豚の生姜焼き定食', servings: 1, price: 1280, history: [],
  items: [{ ref: 'i:pork', qty: 150 }, { ref: 'i:onion', qty: 50 }, { ref: 'p:tare', qty: 40 }, { ref: 'i:cabbage', qty: 60 }, { ref: 'p:gohan', qty: 230 }],
}
const cat = makeCatalog(ings, [tare, gohan, butadonTare])

describe('単価', () => {
  it('kg・Lを g・ml に換算する', () => {
    expect(ingUnitCost(ings[0])).toBeCloseTo(2.08)
    expect(ingUnitCost(ings[4])).toBeCloseTo(510 / 1800)
  })
  it('個はそのまま割る', () => {
    expect(ingUnitCost(ings[8])).toBeCloseTo(28)
  })
  it('歩留まりで割る', () => {
    expect(ingUnitCost(ings[1])).toBeCloseTo(2000 / 10000 / 0.9)
  })
  it('メニュー側の歩留まりを優先する', () => {
    expect(itemCost({ ref: 'i:onion', qty: 100, yieldPct: 50 }, cat)).toBeCloseTo(40)
  })
  it('量が0なら0円', () => {
    expect(ingUnitCost(ing('x', 100, 0, 'kg'))).toBe(0)
  })
})

describe('仕込み品', () => {
  it('材料合計を出来上がり量で割る', () => {
    expect(prepUnitCost(tare, cat)).toBeCloseTo(216.1556 / 450, 4)
  })
  it('仕込み品の中の仕込み品も計算する', () => {
    const expected = (prepUnitCost(tare, cat) * 300 + 0.26 * 30) / 320
    expect(prepUnitCost(butadonTare, cat)).toBeCloseTo(expected)
  })
  it('循環していても止まる', () => {
    const a: Prep = { id: 'a', name: 'a', yieldAmount: 100, yieldUnit: 'g', items: [{ ref: 'p:b', qty: 10 }, { ref: 'i:sugar', qty: 100 }] }
    const b: Prep = { id: 'b', name: 'b', yieldAmount: 100, yieldUnit: 'g', items: [{ ref: 'p:a', qty: 10 }] }
    const c = makeCatalog(ings, [a, b])
    expect(Number.isFinite(prepUnitCost(a, c))).toBe(true)
  })
})

describe('メニュー', () => {
  it('生姜焼き定食は約403円・31.5%', () => {
    expect(menuCost(teishoku, cat)).toBeCloseTo(403.03, 1)
    expect(rateOf(teishoku, cat)).toBeCloseTo(31.49, 1)
  })
  it('何人前で割る', () => {
    const m: Menu = { ...teishoku, servings: 2 }
    expect(menuCost(m, cat)).toBeCloseTo(menuCost(teishoku, cat) / 2)
  })
  it('売価0なら原価率0', () => {
    expect(rateOf({ ...teishoku, price: 0 }, cat)).toBe(0)
  })
  it('色分け', () => {
    expect(level(30, 30)).toBe('ok')
    expect(level(35, 30)).toBe('warn')
    expect(level(35.1, 30)).toBe('bad')
  })
  it('仕込み品を通した使用も見つける', () => {
    const m: Menu = { ...teishoku, items: [{ ref: 'p:dtare', qty: 35 }] }
    expect(uses(m.items, 'i:ginger', cat)).toBe(true)
    expect(uses(m.items, 'i:egg', cat)).toBe(false)
  })
})

describe('履歴', () => {
  it('変化がなければ記録しない', () => {
    const first = recordMenuCost(teishoku, cat, '2026-10-01')!
    expect(first.history).toEqual([{ date: '2026-10-01', cost: 403, rate: 31.5 }])
    expect(recordMenuCost(first, cat, '2026-10-02')).toBeNull()
  })
  it('同じ日は上書きする', () => {
    const first = recordMenuCost(teishoku, cat, '2026-10-01')!
    const second = recordMenuCost({ ...first, price: 1000 }, cat, '2026-10-01')!
    expect(second.history).toHaveLength(1)
    expect(second.history[0].rate).toBeCloseTo(40.3)
  })
  it('売価や材料がないメニューは記録しない', () => {
    expect(recordMenuCost({ ...teishoku, price: 0 }, cat, '2026-10-01')).toBeNull()
    expect(recordMenuCost({ ...teishoku, items: [] }, cat, '2026-10-01')).toBeNull()
  })
  it('仕込み品経由で値上がりしたメニューを記録する', () => {
    const base = recordMenuCost(teishoku, cat, '2026-10-01')!
    const pricier = makeCatalog(ings.map((i) => (i.id === 'ginger' ? { ...i, price: 2400 } : i)), [tare, gohan, butadonTare])
    const changed = recordChangedMenus([base], pricier, '2026-10-02')
    expect(changed).toHaveLength(1)
    expect(changed[0].history[1].cost).toBeGreaterThan(403)
  })
  it('価格が変わったときだけ価格履歴を追加する', () => {
    const v1 = withPriceHistory(undefined, ings[0], '2026-10-01')
    expect(v1.history).toEqual([{ date: '2026-10-01', price: 2080 }])
    expect(withPriceHistory(v1, { ...v1, name: '改名' }, '2026-10-02').history).toHaveLength(1)
    const v2 = withPriceHistory(v1, { ...v1, price: 2200 }, '2026-10-02')
    expect(v2.history.map((h) => h.price)).toEqual([2080, 2200])
    const v3 = withPriceHistory(v2, { ...v2, price: 2250 }, '2026-10-02')
    expect(v3.history.map((h) => h.price)).toEqual([2080, 2250])
  })
})
