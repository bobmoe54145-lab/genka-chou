import Dexie, { type EntityTable } from 'dexie'
import type { Ingredient, Menu, Prep, Settings } from '../domain/types'

interface SettingsRow {
  key: 'settings'
  value: Settings
}

export class GenkaDB extends Dexie {
  ingredients!: EntityTable<Ingredient, 'id'>
  preps!: EntityTable<Prep, 'id'>
  menus!: EntityTable<Menu, 'id'>
  kv!: EntityTable<SettingsRow, 'key'>

  constructor(name = 'genka-chou') {
    super(name)
    this.version(1).stores({
      ingredients: 'id, name',
      preps: 'id, name',
      menus: 'id, name',
      kv: 'key',
    })
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
