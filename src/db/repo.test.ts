import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Ingredient, Menu, Prep } from '../domain/types'
import { backupOverdue, buildBackup, parseBackup, restoreBackup } from './backup'
import { db } from './db'
import { deleteIngredient, deletePrep, InUseError, loadSettings, saveIngredient, saveMenu, savePrep, saveSettings } from './repo'

const ginger: Ingredient = {
  id: 'g', name: '生姜', category: '野菜', supplier: '西原商会', price: 1200, packAmount: 1, packUnit: 'kg', yieldPct: 80, history: [],
}
const tare: Prep = { id: 't', name: 'タレ', yieldAmount: 100, yieldUnit: 'ml', items: [{ ref: 'i:g', qty: 50 }] }
const menu: Menu = { id: 'm', name: '生姜焼き', servings: 1, price: 1000, items: [{ ref: 'p:t', qty: 40 }], history: [] }

beforeEach(async () => {
  await Promise.all([db.ingredients.clear(), db.preps.clear(), db.menus.clear(), db.kv.clear()])
})

describe('保存', () => {
  it('価格変更で価格履歴とメニューの原価推移を記録する', async () => {
    await saveIngredient(ginger, '2026-10-01')
    await savePrep(tare, '2026-10-01')
    await saveMenu(menu, '2026-10-01')
    expect((await db.menus.get('m'))!.history).toHaveLength(1)

    const n = await saveIngredient({ ...ginger, price: 2400 }, '2026-10-02')
    expect(n).toBe(1)
    expect((await db.ingredients.get('g'))!.history.map((h) => h.price)).toEqual([1200, 2400])
    const hist = (await db.menus.get('m'))!.history
    expect(hist).toHaveLength(2)
    expect(hist[1].cost).toBe(60)
  })

  it('価格以外の変更ではメニューを更新しない', async () => {
    await saveIngredient(ginger, '2026-10-01')
    await savePrep(tare, '2026-10-01')
    await saveMenu(menu, '2026-10-01')
    expect(await saveIngredient({ ...ginger, supplier: '協和物産' }, '2026-10-02')).toBe(0)
  })

  it('使われている食材と仕込み品は削除できない', async () => {
    await saveIngredient(ginger)
    await savePrep(tare)
    await expect(deleteIngredient('g')).rejects.toBeInstanceOf(InUseError)
    await saveMenu(menu)
    await expect(deletePrep('t')).rejects.toThrow('「生姜焼き」')
  })

  it('設定は初期値に上書きして保存する', async () => {
    expect((await loadSettings()).targetRate).toBe(30)
    await saveSettings({ targetRate: 28 })
    expect(await loadSettings()).toEqual({ targetRate: 28, lastBackupAt: null })
  })
})

describe('バックアップ', () => {
  it('書き出したものを読み込むと元に戻る', async () => {
    const file = buildBackup({ settings: { targetRate: 32, lastBackupAt: null }, ingredients: [ginger], preps: [tare], menus: [menu] },
      new Date('2026-10-04T10:00:00Z'))
    const parsed = parseBackup(JSON.stringify(file))
    await restoreBackup(parsed)
    expect(await db.ingredients.toArray()).toEqual([ginger])
    expect(await db.menus.toArray()).toEqual([menu])
    expect(await loadSettings()).toEqual({ targetRate: 32, lastBackupAt: '2026-10-04T10:00:00.000Z' })
  })

  it('別のファイルや壊れたファイルは読み込まない', () => {
    expect(() => parseBackup('not json')).toThrow('読み取れません')
    expect(() => parseBackup('{"app":"other"}')).toThrow('バックアップファイルではありません')
    const broken = { app: 'genka-chou', version: 1, ingredients: [{ id: 1 }], preps: [], menus: [] }
    expect(() => parseBackup(JSON.stringify(broken))).toThrow('食材データ')
  })

  it('30日たつか、一度も書き出していなければ催促する', () => {
    const now = new Date('2026-10-31T00:00:00Z')
    expect(backupOverdue(null, false, now)).toBe(false)
    expect(backupOverdue(null, true, now)).toBe(true)
    expect(backupOverdue('2026-10-02T00:00:00Z', true, now)).toBe(false)
    expect(backupOverdue('2026-10-01T00:00:00Z', true, now)).toBe(true)
  })
})
