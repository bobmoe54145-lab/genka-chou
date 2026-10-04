import type { BaseUnit, Ingredient, Item, Menu, Prep, Ref } from './types'
import { baseUnitOf, toBase } from './units'

/** 食材と仕込み品をIDで引くための入れ物 */
export interface Catalog {
  ings: Map<string, Ingredient>
  preps: Map<string, Prep>
}

export const makeCatalog = (ings: Ingredient[], preps: Prep[]): Catalog => ({
  ings: new Map(ings.map((i) => [i.id, i])),
  preps: new Map(preps.map((p) => [p.id, p])),
})

export const parseRef = (r: Ref): ['i' | 'p', string] => [r[0] as 'i' | 'p', r.slice(2)]

/** 歩留まりを考慮した、使える分1単位あたりの単価 */
export function ingUnitCost(i: Ingredient, yieldPct?: number): number {
  const base = toBase(i.packAmount, i.packUnit)
  const y = (yieldPct ?? i.yieldPct) || 100
  if (!(base > 0)) return 0
  return i.price / base / (y / 100)
}

/** 仕込み品の出来上がり1単位あたりの原価。循環していたら0として打ち切る */
export function prepUnitCost(p: Prep, cat: Catalog, seen: Set<string> = new Set()): number {
  if (seen.has(p.id)) return 0
  const next = new Set(seen).add(p.id)
  const total = p.items.reduce((a, it) => a + itemCost(it, cat, next), 0)
  return p.yieldAmount > 0 ? total / p.yieldAmount : 0
}

export function itemCost(it: Item, cat: Catalog, seen: Set<string> = new Set()): number {
  const [t, id] = parseRef(it.ref)
  if (t === 'i') {
    const i = cat.ings.get(id)
    return i ? ingUnitCost(i, it.yieldPct) * it.qty : 0
  }
  const p = cat.preps.get(id)
  return p ? prepUnitCost(p, cat, seen) * it.qty : 0
}

export interface RefInfo {
  kind: 'i' | 'p'
  name: string
  unit: BaseUnit
  ing?: Ingredient
  prep?: Prep
}

export function refInfo(r: Ref, cat: Catalog): RefInfo | null {
  const [t, id] = parseRef(r)
  if (t === 'i') {
    const i = cat.ings.get(id)
    return i ? { kind: 'i', name: i.name, unit: baseUnitOf(i.packUnit), ing: i } : null
  }
  const p = cat.preps.get(id)
  return p ? { kind: 'p', name: p.name, unit: p.yieldUnit, prep: p } : null
}

/** 1皿の原価 */
export const menuCost = (m: Menu, cat: Catalog): number =>
  m.items.reduce((a, it) => a + itemCost(it, cat), 0) / (m.servings || 1)

/** 原価率（%） */
export const rateOf = (m: Menu, cat: Catalog): number => (m.price > 0 ? (menuCost(m, cat) / m.price) * 100 : 0)

export type Level = 'ok' | 'warn' | 'bad'
export const level = (rate: number, target: number): Level =>
  rate <= target ? 'ok' : rate <= target + 5 ? 'warn' : 'bad'
export const LEVEL_TEXT: Record<Level, string> = { ok: '目標内', warn: 'やや高め', bad: '目標超え' }

/** items が ref を直接、または仕込み品を通して使っているか */
export function uses(items: Item[], ref: Ref, cat: Catalog, seen: Set<string> = new Set()): boolean {
  return items.some((it) => {
    if (it.ref === ref) return true
    const [t, id] = parseRef(it.ref)
    if (t !== 'p' || seen.has(id)) return false
    seen.add(id)
    const p = cat.preps.get(id)
    return !!p && uses(p.items, ref, cat, seen)
  })
}
