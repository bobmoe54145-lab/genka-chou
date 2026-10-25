import Dexie, { type EntityTable } from 'dexie'
import type { Ingredient, Menu, Photo, Prep, Settings } from '../domain/types'

interface SettingsRow {
  key: 'settings'
  value: Settings
}

export class GenkaDB extends Dexie {
  ingredients!: EntityTable<Ingredient, 'id'>
  preps!: EntityTable<Prep, 'id'>
  menus!: EntityTable<Menu, 'id'>
  kv!: EntityTable<SettingsRow, 'key'>
  /** 写真はメニューや仕込み品とは別に置く（一覧を読むたびに写真まで読まないため） */
  photos!: EntityTable<Photo, 'id'>

  constructor(name = 'genka-chou') {
    super(name)
    this.version(1).stores({
      ingredients: 'id, name',
      preps: 'id, name',
      menus: 'id, name',
      kv: 'key',
    })
    // 版2：仕込み品とメニューに作り方（steps）を追加。既存のデータには空の手順を入れる
    this.version(2).stores({}).upgrade(async (tx) => {
      await tx.table('preps').toCollection().modify((p) => { p.steps ??= [] })
      await tx.table('menus').toCollection().modify((m) => { m.steps ??= [] })
    })
    // 版3：写真のテーブルを追加
    this.version(3).stores({ photos: 'id' })
  }
}

export const db = new GenkaDB()

/** iPhoneが容量不足のときにデータを消さないよう、永続保存を依頼する */
export async function requestPersistence(): Promise<void> {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist?.()
    }
  } catch {
    // 対応していないブラウザでは何もしない
  }
}
