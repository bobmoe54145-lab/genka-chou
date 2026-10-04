import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Header, TabBar } from './ui/components'
import { DataProvider, useData } from './ui/data'
import { NavContext, useNav, type Nav, type Screen, type Sheet, type Tab } from './ui/nav'
import { IngredientDetail, IngredientList } from './ui/screens/Ingredients'
import { MenuDetail, MenuList } from './ui/screens/Menus'
import { PrepDetail, PrepList } from './ui/screens/Preps'
import { SettingsScreen } from './ui/screens/Settings'
import { SheetHost } from './ui/Sheets'

export default function App() {
  const [tab, setTabState] = useState<Tab>('menu')
  const [stack, setStack] = useState<Screen[]>([])
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToastMsg(null), 2800)
  }, [])

  const nav = useMemo<Nav>(() => ({
    tab,
    setTab: (t) => { setTabState(t); setStack([]); window.scrollTo(0, 0) },
    open: (s) => { setStack((st) => [...st, s]); window.scrollTo(0, 0) },
    replace: (s) => setStack((st) => [...st.slice(0, -1), s]),
    back: () => { setStack((st) => st.slice(0, -1)); window.scrollTo(0, 0) },
    openSheet: setSheet,
    closeSheet: () => setSheet(null),
    toast,
  }), [tab, toast])

  // シートを開いている間は後ろの画面をスクロールさせない
  useEffect(() => {
    document.body.style.overflow = sheet ? 'hidden' : ''
  }, [sheet])

  return (
    <NavContext.Provider value={nav}>
      <DataProvider>
        <div className="app">
          <Current tab={tab} screen={stack[stack.length - 1]} />
        </div>
        <TabBar />
        <SheetHost sheet={sheet} />
      </DataProvider>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </NavContext.Provider>
  )
}

function Current({ tab, screen }: { tab: Tab; screen: Screen | undefined }) {
  const nav = useNav()
  const { ings, preps, menus } = useData()

  if (screen) {
    let title = ''
    let body
    if (screen.type === 'ing') {
      title = screen.id === 'new' ? '食材を登録' : '食材の編集'
      body = <IngredientDetail key={screen.id} id={screen.id} />
    } else if (screen.type === 'prep') {
      title = preps.find((p) => p.id === screen.id)?.name ?? '仕込み品'
      body = <PrepDetail id={screen.id} />
    } else {
      title = menus.find((m) => m.id === screen.id)?.name ?? 'メニュー'
      body = <MenuDetail id={screen.id} />
    }
    return (
      <>
        <Header title={title} onBack={nav.back} />
        <main>{body}</main>
      </>
    )
  }

  const add = (label: string, onClick: () => void) => <button className="icon-btn solid" onClick={onClick}>＋ {label}</button>
  if (tab === 'ing') {
    return (
      <>
        <Header title="食材" right={ings.length > 0 && add('追加', () => nav.open({ type: 'ing', id: 'new' }))} />
        <main><IngredientList /></main>
      </>
    )
  }
  if (tab === 'prep') {
    return (
      <>
        <Header title="仕込み品" right={add('追加', () => nav.openSheet({ type: 'name', kind: 'prep' }))} />
        <main><PrepList /></main>
      </>
    )
  }
  if (tab === 'menu') {
    return (
      <>
        <Header title="原価計算帳" brand right={add('追加', () => nav.openSheet({ type: 'name', kind: 'menu' }))} />
        <main><MenuList /></main>
      </>
    )
  }
  return (
    <>
      <Header title="設定" />
      <main><SettingsScreen /></main>
    </>
  )
}
