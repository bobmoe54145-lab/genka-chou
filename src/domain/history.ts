import { menuCost, rateOf, type Catalog } from './cost'
import type { Ingredient, Menu } from './types'

/** 端末のローカル日付を YYYY-MM-DD で返す */
export function today(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * メニューの現在の原価と原価率を履歴に記録した新しいメニューを返す。
 * 前回と同じ値なら null。同じ日の記録は上書きする。売価か材料が未設定なら記録しない。
 */
export function recordMenuCost(m: Menu, cat: Catalog, date: string): Menu | null {
  if (!(m.price > 0) || m.items.length === 0) return null
  const cost = Math.round(menuCost(m, cat))
  const rate = Math.round(rateOf(m, cat) * 10) / 10
  const last = m.history[m.history.length - 1]
  if (last && last.cost === cost && last.rate === rate) return null
  const base = last && last.date === date ? m.history.slice(0, -1) : m.history
  return { ...m, history: [...base, { date, cost, rate }] }
}

/** 値が変わったメニューだけを記録し直して返す */
export function recordChangedMenus(menus: Menu[], cat: Catalog, date: string): Menu[] {
  return menus.map((m) => recordMenuCost(m, cat, date)).filter((m): m is Menu => m !== null)
}

/** 価格が変わっていれば価格履歴を追加した食材を返す。同じ日の記録は上書きする */
export function withPriceHistory(prev: Ingredient | undefined, next: Ingredient, date: string): Ingredient {
  if (!prev) return { ...next, history: [{ date, price: next.price }] }
  if (prev.price === next.price) return { ...next, history: prev.history }
  const last = prev.history[prev.history.length - 1]
  const base = last && last.date === date ? prev.history.slice(0, -1) : prev.history
  return { ...next, history: [...base, { date, price: next.price }] }
}
