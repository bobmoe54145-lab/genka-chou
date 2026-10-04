import { createContext, useContext } from 'react'
import type { Ingredient, Ref } from '../domain/types'

export type Tab = 'ing' | 'prep' | 'menu' | 'set'

export type Screen =
  | { type: 'ing'; id: string | 'new' }
  | { type: 'prep'; id: string }
  | { type: 'menu'; id: string }

/** 材料を入れる先（メニューか仕込み品） */
export interface Holder {
  kind: 'menu' | 'prep'
  id: string
}

export type Sheet =
  | { type: 'pick'; holder: Holder }
  | { type: 'qty'; holder: Holder; ref: Ref; index: number | null }
  | { type: 'newIng'; holder: Holder; draft: Partial<Ingredient> }
  | { type: 'name'; kind: 'menu' | 'prep' }
  | { type: 'confirm'; title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => Promise<void> | void }

export interface Nav {
  tab: Tab
  setTab: (t: Tab) => void
  open: (s: Screen) => void
  /** 今の画面を差し替える（新規登録の直後など） */
  replace: (s: Screen) => void
  back: () => void
  openSheet: (s: Sheet) => void
  closeSheet: () => void
  toast: (msg: string) => void
}

export const NavContext = createContext<Nav | null>(null)

export function useNav(): Nav {
  const v = useContext(NavContext)
  if (!v) throw new Error('NavContext の外で useNav が呼ばれました')
  return v
}
