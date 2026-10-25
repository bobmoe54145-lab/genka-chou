import { today } from '../domain/history'
import { BASE_UNITS, PACK_UNITS } from '../domain/units'
import { DEFAULT_SETTINGS, type Ingredient, type Item, type Menu, type Photo, type Prep, type Settings } from '../domain/types'
import { db } from './db'

export interface BackupFile {
  app: 'genka-chou'
  /** 1：最初の版、2：作り方（steps）を追加、3：写真（photos）を追加 */
  version: 3
  exportedAt: string
  settings: Settings
  ingredients: Ingredient[]
  preps: Prep[]
  menus: Menu[]
  photos: Photo[]
}

export interface BackupData {
  settings: Settings
  ingredients: Ingredient[]
  preps: Prep[]
  menus: Menu[]
  photos: Photo[]
}

export function buildBackup(data: BackupData, now = new Date()): BackupFile {
  return { app: 'genka-chou', version: 3, exportedAt: now.toISOString(), ...data }
}

export const backupFileName = (now = new Date()) => `原価計算帳_バックアップ_${today(now)}.json`

/* ---------- 読み込み時の検証 ---------- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr)

function checkItems(v: unknown): v is Item[] {
  return Array.isArray(v) && v.every((it) =>
    isObj(it) && isStr(it.ref) && /^[ip]:./.test(it.ref) && isNum(it.qty) && (it.yieldPct === undefined || isNum(it.yieldPct)))
}

function checkIngredient(v: unknown): v is Ingredient {
  return isObj(v) && isStr(v.id) && isStr(v.name) && isStr(v.category) && isStr(v.supplier) && isNum(v.price) &&
    isNum(v.packAmount) && PACK_UNITS.includes(v.packUnit as never) && isNum(v.yieldPct) &&
    Array.isArray(v.history) && v.history.every((h) => isObj(h) && isStr(h.date) && isNum(h.price))
}

function checkPrep(v: unknown): v is Prep {
  return isObj(v) && isStr(v.id) && isStr(v.name) && isNum(v.yieldAmount) &&
    BASE_UNITS.includes(v.yieldUnit as never) && checkItems(v.items) && isStrList(v.steps)
}

function checkMenu(v: unknown): v is Menu {
  return isObj(v) && isStr(v.id) && isStr(v.name) && isNum(v.servings) && isNum(v.price) && checkItems(v.items) &&
    isStrList(v.steps) && Array.isArray(v.history) && v.history.every((h) => isObj(h) && isStr(h.date) && isNum(h.cost) && isNum(h.rate))
}

function checkPhoto(v: unknown): v is Photo {
  return isObj(v) && isStr(v.id) && /^(menu|prep):./.test(v.id) && isStr(v.dataUrl) && v.dataUrl.startsWith('data:image/')
}

/** バックアップファイルの中身を検証する。問題があれば理由つきで例外を投げる */
export function parseBackup(text: string): BackupFile {
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    throw new Error('ファイルを読み取れませんでした。原価計算帳で書き出したファイルを選んでください')
  }
  if (!isObj(v) || v.app !== 'genka-chou') throw new Error('原価計算帳のバックアップファイルではありません')
  if (v.version !== 1 && v.version !== 2 && v.version !== 3) throw new Error('このバージョンのバックアップには対応していません')
  if (v.version === 1) {
    // 版1には作り方がないので、空の手順を足してから確かめる
    for (const key of ['preps', 'menus'] as const) {
      const list = v[key]
      if (Array.isArray(list)) v[key] = list.map((x) => (isObj(x) ? { ...x, steps: [] } : x))
    }
  }
  // 版2までは写真がない
  if (v.version !== 3) v.photos = []
  const bad = (what: string) => new Error(`バックアップの${what}が壊れているため読み込めません`)
  if (!Array.isArray(v.ingredients) || !v.ingredients.every(checkIngredient)) throw bad('食材データ')
  if (!Array.isArray(v.preps) || !v.preps.every(checkPrep)) throw bad('仕込み品データ')
  if (!Array.isArray(v.menus) || !v.menus.every(checkMenu)) throw bad('メニューデータ')
  if (!Array.isArray(v.photos) || !v.photos.every(checkPhoto)) throw bad('写真データ')
  const s = isObj(v.settings) ? v.settings : {}
  const settings: Settings = {
    targetRate: isNum(s.targetRate) ? s.targetRate : DEFAULT_SETTINGS.targetRate,
    lastBackupAt: isStr(s.lastBackupAt) ? s.lastBackupAt : null,
  }
  return {
    app: 'genka-chou', version: 3, exportedAt: isStr(v.exportedAt) ? v.exportedAt : '', settings,
    ingredients: v.ingredients, preps: v.preps, menus: v.menus, photos: v.photos,
  }
}

/** 今のデータをすべて消して、バックアップの内容に置き換える */
export function restoreBackup(b: BackupFile): Promise<void> {
  return db.transaction('rw', [db.ingredients, db.preps, db.menus, db.photos, db.kv], async () => {
    await Promise.all([db.ingredients.clear(), db.preps.clear(), db.menus.clear(), db.photos.clear()])
    await db.ingredients.bulkAdd(b.ingredients)
    await db.preps.bulkAdd(b.preps)
    await db.menus.bulkAdd(b.menus)
    await db.photos.bulkAdd(b.photos)
    // 読み込んだファイル自体がバックアップなので、その書き出し日時を最終バックアップとする
    await db.kv.put({ key: 'settings', value: { ...b.settings, lastBackupAt: b.exportedAt || b.settings.lastBackupAt } })
  })
}

/** 最終書き出しから30日以上たっていれば true */
export function backupOverdue(lastBackupAt: string | null, hasData: boolean, now = new Date()): boolean {
  if (!hasData) return false
  if (!lastBackupAt) return true
  return now.getTime() - new Date(lastBackupAt).getTime() >= 30 * 24 * 60 * 60 * 1000
}
