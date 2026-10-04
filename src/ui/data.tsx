import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { makeCatalog, type Catalog } from '../domain/cost'
import type { Ingredient, Menu, Prep, Settings } from '../domain/types'
import { db } from '../db/db'
import { loadSettings } from '../db/repo'

export interface AppData {
  ings: Ingredient[]
  preps: Prep[]
  menus: Menu[]
  settings: Settings
  cat: Catalog
}

const DataContext = createContext<AppData | null>(null)

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'ja')

export function DataProvider({ children }: { children: ReactNode }) {
  const ings = useLiveQuery(() => db.ingredients.toArray())
  const preps = useLiveQuery(() => db.preps.toArray())
  const menus = useLiveQuery(() => db.menus.toArray())
  const settings = useLiveQuery(loadSettings)

  const value = useMemo<AppData | null>(() => {
    if (!ings || !preps || !menus || !settings) return null
    return {
      ings: [...ings].sort(byName),
      preps: [...preps].sort(byName),
      menus,
      settings,
      cat: makeCatalog(ings, preps),
    }
  }, [ings, preps, menus, settings])

  if (!value) return <p className="loading">読み込み中…</p>
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): AppData {
  const v = useContext(DataContext)
  if (!v) throw new Error('DataProvider の外で useData が呼ばれました')
  return v
}
