import { today } from '../domain/history'
import { BASE_UNITS, PACK_UNITS } from '../domain/units'
import { DEFAULT_SETTINGS, type Ingredient, type Item, type Menu, type Prep, type Settings } from '../domain/types'
import { db } from './db'

export interface BackupFile {
  app: 'genka-chou'
  version: 1
  exportedAt: string
  settings: Settings
  ingredients: Ingredient[]
  preps: Prep[]
  menus: Menu[]
}

export interface BackupData {
  settings: Settings
  ingredients: Ingredient[]
  preps: Prep[]
  menus: Menu[]
}

export function buildBackup(data: BackupData, now = new Date()): BackupFile {
  return { app: 'genka-chou', version: 1, exportedAt: now.toISOString(), ...data }
}

export const backupFileName = (now = new Date()) => `原価計算帳_バックアップ_${today(now)}.json`

/* ---------- 読み込み時の検証 ---------- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

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
    BASE_UNITS.includes(v.yieldUnit as never) && checkItems(v.items)
}

function checkMenu(v: unknown): v is Menu {
  return isObj(v) && isStr(v.id) && isStr(v.name) && isNum(v.servings) && isNum(v.price) && checkItems(v.items) &&
    Array.isArray(v.history) && v.history.every((h) => isObj(h) && isStr(h.date) && isNum(h.cost) && isNum(h.rate))
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
  if (v.version !== 1) throw new Error('このバージョンのバックアップには対応していません')
  const bad = (what: string) => new Error(`バックアップの${what}が壊れているため読み込めません`)
  if (!Array.isArray(v.ingredients) || !v.ingredients.every(checkIngredient)) throw bad('食材データ')
  if (!Array.isArray(v.preps) || !v.preps.every(checkPrep)) throw bad('仕込み品データ')
  if (!Array.isArray(v.menus) || !v.menus.every(checkMenu)) throw bad('メニューデータ')
  const s = isObj(v.settings) ? v.settings : {}
  const settings: Settings = {
    targetRate: isNum(s.targetRate) ? s.targetRate : DEFAULT_SETTINGS.targetRate,
    lastBackupAt: isStr(s.lastBackupAt) ? s.lastBackupAt : null,
  }
  return {
    app: 'genka-chou', version: 1, exportedAt: isStr(v.exportedAt) ? v.exportedAt : '', settings,
    ingredients: v.ingredients, preps: v.preps, menus: v.menus,
  }
}

/** 今のデータをすべて消して、バックアップの内容に置き換える */
export function restoreBackup(b: BackupFile): Promise<void> {
  return db.transaction('rw', [db.ingredients, db.preps, db.menus, db.kv], async () => {
    await Promise.all([db.ingredients.clear(), db.preps.clear(), db.menus.clear()])
    await db.ingredients.bulkAdd(b.ingredients)
    await db.preps.bulkAdd(b.preps)
    await db.menus.bulkAdd(b.menus)
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
