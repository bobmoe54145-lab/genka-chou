/** 仕入れ時の単位 */
export type PackUnit = 'kg' | 'g' | 'L' | 'ml' | '個'
/** 計算に使う最小単位 */
export type BaseUnit = 'g' | 'ml' | '個'

/** 材料の参照。i: が食材、p: が仕込み品 */
export type Ref = `i:${string}` | `p:${string}`

export interface Item {
  ref: Ref
  qty: number
  /** このメニュー（仕込み品）だけの歩留まり%。未設定なら食材の標準値 */
  yieldPct?: number
}

/** 日付は YYYY-MM-DD */
export interface PricePoint {
  date: string
  price: number
}

export interface CostPoint {
  date: string
  cost: number
  rate: number
}

export interface Ingredient {
  id: string
  name: string
  category: string
  supplier: string
  /** 税別の仕入れ価格 */
  price: number
  packAmount: number
  packUnit: PackUnit
  yieldPct: number
  history: PricePoint[]
}

export interface Prep {
  id: string
  name: string
  yieldAmount: number
  yieldUnit: BaseUnit
  items: Item[]
  /** 作り方の手順（1行目から順に） */
  steps: string[]
}

export interface Menu {
  id: string
  name: string
  servings: number
  /** 税別の売価 */
  price: number
  items: Item[]
  /** 作り方の手順（1行目から順に） */
  steps: string[]
  history: CostPoint[]
}

/** 写真の持ち主。メニューか仕込み品 */
export type PhotoOwner = `menu:${string}` | `prep:${string}`

/** 1品につき1枚の写真。縮めたJPEGを data URL の文字で持つ */
export interface Photo {
  id: PhotoOwner
  dataUrl: string
}

export interface Settings {
  targetRate: number
  /** 最後にバックアップを書き出した日時（ISO文字列） */
  lastBackupAt: string | null
}

export const DEFAULT_SETTINGS: Settings = { targetRate: 30, lastBackupAt: null }

export const CATEGORIES = ['肉', '魚', '野菜', '調味料', '加工品', '米・乾物', 'その他'] as const
