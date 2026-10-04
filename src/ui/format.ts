export const yen = (n: number): string => Math.round(n).toLocaleString('ja-JP')

/** 1gあたりなど小さい単価を見やすい桁数で */
export const unitYen = (n: number): string =>
  n < 1 ? n.toFixed(3) : n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : yen(n)

export const qtyFmt = (n: number): string => n.toLocaleString('ja-JP', { maximumFractionDigits: 2 })

/** 2026-10-01 → 2026/10/01 */
export const dateLabel = (d: string): string => d.replaceAll('-', '/')

/** 全角数字やカンマを含む入力も数値にする。数値でなければ NaN */
export function parseNum(s: string): number {
  const t = s.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,，\s円%]/g, '')
  return t === '' ? NaN : Number(t)
}
