import { makeCatalog } from '../domain/cost'
import { recordChangedMenus, recordMenuCost, today, withPriceHistory } from '../domain/history'
import { DEFAULT_SETTINGS, type Ingredient, type Menu, type PhotoOwner, type Prep, type Ref, type Settings } from '../domain/types'
import { db } from './db'

/** 削除しようとしたものが、まだどこかで使われている */
export class InUseError extends Error {
  readonly usedBy: string[]
  constructor(usedBy: string[]) {
    super(`${usedBy.join('、')}で使われているため削除できません`)
    this.usedBy = usedBy
  }
}

const tables = () => [db.ingredients, db.preps, db.menus, db.photos]

/** 原価が変わったメニューの履歴を記録し、記録した品数を返す。トランザクション内で呼ぶ */
async function recalcMenus(date: string): Promise<number> {
  const [ings, preps, menus] = await Promise.all([db.ingredients.toArray(), db.preps.toArray(), db.menus.toArray()])
  const changed = recordChangedMenus(menus, makeCatalog(ings, preps), date)
  await db.menus.bulkPut(changed)
  return changed.length
}

/** 食材を保存する。価格が変われば価格履歴に追加し、影響するメニューの原価推移も記録する */
export function saveIngredient(next: Ingredient, date = today()): Promise<number> {
  return db.transaction('rw', tables(), async () => {
    const prev = await db.ingredients.get(next.id)
    await db.ingredients.put(withPriceHistory(prev, next, date))
    return recalcMenus(date)
  })
}

export function savePrep(p: Prep, date = today()): Promise<number> {
  return db.transaction('rw', tables(), async () => {
    await db.preps.put(p)
    return recalcMenus(date)
  })
}

export function saveMenu(m: Menu, date = today()): Promise<void> {
  return db.transaction('rw', tables(), async () => {
    const [ings, preps] = await Promise.all([db.ingredients.toArray(), db.preps.toArray()])
    await db.menus.put(recordMenuCost(m, makeCatalog(ings, preps), date) ?? m)
  })
}

/** ref を材料に直接入れている仕込み品とメニューの名前 */
async function usersOf(ref: Ref): Promise<string[]> {
  const [preps, menus] = await Promise.all([db.preps.toArray(), db.menus.toArray()])
  return [...preps, ...menus].filter((x) => x.items.some((it) => it.ref === ref)).map((x) => `「${x.name}」`)
}

export function deleteIngredient(id: string): Promise<void> {
  return db.transaction('rw', tables(), async () => {
    const users = await usersOf(`i:${id}`)
    if (users.length) throw new InUseError(users)
    await db.ingredients.delete(id)
  })
}

export function deletePrep(id: string): Promise<void> {
  return db.transaction('rw', tables(), async () => {
    const users = await usersOf(`p:${id}`)
    if (users.length) throw new InUseError(users)
    await db.preps.delete(id)
    await db.photos.delete(`prep:${id}`)
  })
}

export function deleteMenu(id: string): Promise<void> {
  return db.transaction('rw', db.menus, db.photos, async () => {
    await db.menus.delete(id)
    await db.photos.delete(`menu:${id}`)
  })
}

export const savePhoto = (id: PhotoOwner, dataUrl: string): Promise<unknown> => db.photos.put({ id, dataUrl })
export const deletePhoto = (id: PhotoOwner): Promise<void> => db.photos.delete(id)

export async function loadSettings(): Promise<Settings> {
  const row = await db.kv.get('settings')
  return { ...DEFAULT_SETTINGS, ...row?.value }
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await db.transaction('rw', db.kv, async () => {
    const cur = await loadSettings()
    await db.kv.put({ key: 'settings', value: { ...cur, ...patch } })
  })
}

export const newId = (): string => crypto.randomUUID()
