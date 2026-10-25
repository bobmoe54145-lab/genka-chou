import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Ingredient, Menu, Prep } from '../domain/types'
import { backupOverdue, buildBackup, parseBackup, restoreBackup } from './backup'
import Dexie from 'dexie'
import { db, GenkaDB } from './db'
import { deleteIngredient, deleteMenu, deletePrep, InUseError, loadSettings, saveIngredient, saveMenu, savePrep, savePhoto, saveSettings } from './repo'

const ginger: Ingredient = {
  id: 'g', name: '生姜', category: '野菜', supplier: '西原商会', price: 1200, packAmount: 1, packUnit: 'kg', yieldPct: 80, history: [],
}
const tare: Prep = { id: 't', name: 'タレ', yieldAmount: 100, yieldUnit: 'ml', steps: [], items: [{ ref: 'i:g', qty: 50 }] }
const menu: Menu = { id: 'm', name: '生姜焼き', servings: 1, price: 1000, items: [{ ref: 'p:t', qty: 40 }], steps: [], history: [] }

beforeEach(async () => {
  await Promise.all([db.ingredients.clear(), db.preps.clear(), db.menus.clear(), db.photos.clear(), db.kv.clear()])
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
    const file = buildBackup({ settings: { targetRate: 32, lastBackupAt: null }, ingredients: [ginger], preps: [tare], menus: [menu], photos: [] },
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

describe('作り方（版2）', () => {
  it('作り方もバックアップで書き出して戻せる', async () => {
    const withSteps: Menu = { ...menu, steps: ['豚肉に下味をつける', 'タレを絡めて焼く'] }
    const file = buildBackup({ settings: { targetRate: 30, lastBackupAt: null }, ingredients: [ginger], preps: [{ ...tare, steps: ['全部混ぜる'] }], menus: [withSteps], photos: [] })
    expect(file.version).toBe(3)
    await restoreBackup(parseBackup(JSON.stringify(file)))
    expect((await db.menus.get('m'))!.steps).toEqual(['豚肉に下味をつける', 'タレを絡めて焼く'])
    expect((await db.preps.get('t'))!.steps).toEqual(['全部混ぜる'])
  })

  it('作り方のない版1のバックアップも読み込める', () => {
    const { steps: _a, ...oldPrep } = tare
    const { steps: _b, ...oldMenu } = menu
    const v1 = { app: 'genka-chou', version: 1, exportedAt: '', settings: {}, ingredients: [ginger], preps: [oldPrep], menus: [oldMenu] }
    const parsed = parseBackup(JSON.stringify(v1))
    expect(parsed.preps[0].steps).toEqual([])
    expect(parsed.menus[0].steps).toEqual([])
  })

  it('手順が文字でなければ読み込まない', () => {
    const file = buildBackup({ settings: { targetRate: 30, lastBackupAt: null }, ingredients: [], preps: [], menus: [{ ...menu, steps: [1 as never] }], photos: [] })
    expect(() => parseBackup(JSON.stringify(file))).toThrow('メニューデータ')
  })

  it('版1のデータベースを開くと、既存の仕込み品とメニューに空の手順が入る', async () => {
    const name = 'upgrade-test'
    const old = new Dexie(name)
    old.version(1).stores({ ingredients: 'id, name', preps: 'id, name', menus: 'id, name', kv: 'key' })
    const { steps: _a, ...oldPrep } = tare
    const { steps: _b, ...oldMenu } = menu
    await old.table('preps').add(oldPrep)
    await old.table('menus').add(oldMenu)
    old.close()

    const next = new GenkaDB(name)
    expect((await next.preps.get('t'))!.steps).toEqual([])
    expect((await next.menus.get('m'))!.steps).toEqual([])
    expect((await next.menus.get('m'))!.price).toBe(1000)
    next.close()
    await Dexie.delete(name)
  })
})

describe('写真（版3）', () => {
  const jpeg = 'data:image/jpeg;base64,/9j/AAAA'

  it('写真もバックアップで書き出して戻せる', async () => {
    const file = buildBackup({ settings: { targetRate: 30, lastBackupAt: null }, ingredients: [ginger], preps: [tare], menus: [menu],
      photos: [{ id: 'menu:m', dataUrl: jpeg }, { id: 'prep:t', dataUrl: jpeg }] })
    await restoreBackup(parseBackup(JSON.stringify(file)))
    expect((await db.photos.get('menu:m'))!.dataUrl).toBe(jpeg)
    expect(await db.photos.count()).toBe(2)
  })

  it('読み込むと前の写真は消えて入れ替わる', async () => {
    await savePhoto('menu:old', jpeg)
    const file = buildBackup({ settings: { targetRate: 30, lastBackupAt: null }, ingredients: [], preps: [], menus: [], photos: [] })
    await restoreBackup(parseBackup(JSON.stringify(file)))
    expect(await db.photos.count()).toBe(0)
  })

  it('写真のない版2のバックアップも読み込める', () => {
    const v2 = { app: 'genka-chou', version: 2, exportedAt: '', settings: {}, ingredients: [ginger], preps: [tare], menus: [menu] }
    expect(parseBackup(JSON.stringify(v2)).photos).toEqual([])
  })

  it('画像でない写真データは読み込まない', () => {
    const file = buildBackup({ settings: { targetRate: 30, lastBackupAt: null }, ingredients: [], preps: [], menus: [],
      photos: [{ id: 'menu:m', dataUrl: 'javascript:alert(1)' }] })
    expect(() => parseBackup(JSON.stringify(file))).toThrow('写真データ')
  })

  it('メニューや仕込み品を消すと写真も消える', async () => {
    await saveIngredient(ginger)
    await savePrep(tare)
    await saveMenu(menu)
    await savePhoto('menu:m', jpeg)
    await savePhoto('prep:t', jpeg)
    await deleteMenu('m')
    expect(await db.photos.get('menu:m')).toBeUndefined()
    await deletePrep('t')
    expect(await db.photos.count()).toBe(0)
  })

  it('版2のデータベースを開くと、データはそのままで写真のテーブルが増える', async () => {
    const name = 'upgrade-test-3'
    const old = new Dexie(name)
    old.version(2).stores({ ingredients: 'id, name', preps: 'id, name', menus: 'id, name', kv: 'key' })
    await old.table('menus').add(menu)
    old.close()

    const next = new GenkaDB(name)
    expect((await next.menus.get('m'))!.steps).toEqual([])
    await next.photos.put({ id: 'menu:m', dataUrl: jpeg })
    expect(await next.photos.count()).toBe(1)
    next.close()
    await Dexie.delete(name)
  })
})

describe('バックアップの書き漏れ', () => {
  it('データベースのすべてのテーブルがバックアップに入っている', () => {
    const file = buildBackup({ settings: { targetRate: 30, lastBackupAt: null }, ingredients: [], preps: [], menus: [], photos: [] })
    // kv は設定（settings）として入る
    const covered = Object.keys(file).map((k) => (k === 'settings' ? 'kv' : k))
    for (const t of db.tables) expect(covered).toContain(t.name)
  })
})
