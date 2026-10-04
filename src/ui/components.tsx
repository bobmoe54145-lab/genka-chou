import { useState, type ReactNode } from 'react'
import { level, LEVEL_TEXT, type Level } from '../domain/cost'
import { dateLabel, parseNum } from './format'
import { useNav, type Tab } from './nav'

export function RatePill({ rate, target }: { rate: number; target: number }) {
  return <span className={`pill ${level(rate, target)}`}>{rate.toFixed(1)}%</span>
}

export function StatusBadge({ lv }: { lv: Level }) {
  return <span className={`status ${lv}`}>{LEVEL_TEXT[lv]}</span>
}

/** 履歴の1行。diff は前回からの差（null なら初回） */
export interface HistRow {
  date: string
  value: ReactNode
  diff: number | null
  diffText: string
}

export function HistoryList({ rows }: { rows: HistRow[] }) {
  if (!rows.length) return <ul className="hist"><li className="empty">まだ記録がありません</li></ul>
  return (
    <ul className="hist">
      {rows.map((r, k) => (
        <li key={k}>
          <span className="d">{dateLabel(r.date)}</span>
          <span className="v">{r.value}</span>
          <span className={`x ${r.diff == null ? 'same' : r.diff > 0 ? 'up' : r.diff < 0 ? 'down' : 'same'}`}>
            {r.diff == null ? '登録' : r.diffText}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** 数値入力。入力中は文字のまま持ち、確定（フォーカスが外れる）ときに onCommit を呼ぶ */
export function NumInput({ id, value, onCommit, min = 0, placeholder, label }: {
  id: string
  value: number
  onCommit: (n: number) => void
  min?: number
  placeholder?: string
  label?: string
}) {
  // 未入力（0）で例が出せるときは空欄にして、例を薄く見せる
  const show = (v: number) => (v === 0 && placeholder ? '' : String(v))
  const [text, setText] = useState(show(value))
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    setText(show(value))
  }
  const commit = () => {
    const n = parseNum(text)
    if (Number.isFinite(n) && n >= min && n !== value) onCommit(n)
    else setText(show(value))
  }
  return (
    <input id={id} type="text" inputMode="decimal" value={text} placeholder={placeholder} aria-label={label}
      onChange={(e) => setText(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
  )
}

/** 文字入力。確定時に onCommit を呼ぶ */
export function TextInput({ id, value, onCommit, placeholder }: {
  id: string
  value: string
  onCommit: (s: string) => void
  placeholder?: string
}) {
  const [text, setText] = useState(value)
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    setText(value)
  }
  const commit = () => {
    const t = text.trim()
    if (t && t !== value) onCommit(t)
    else setText(value)
  }
  return (
    <input id={id} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
  )
}

const TABS: [Tab, string, ReactNode][] = [
  ['ing', '食材', <><path d="M5 20c0-6 3-11 7-14 4 3 7 8 7 14z" /><path d="M12 6v14" /></>],
  ['prep', '仕込み品', <><path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M2 10h20M9 6c0-1 1-2 1-3M14 6c0-1 1-2 1-3" /></>],
  ['menu', 'メニュー', <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>],
  ['set', '設定', <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" /></>],
]

export function TabBar() {
  const nav = useNav()
  return (
    <nav className="tabs">
      <div className="tabs-in">
        {TABS.map(([k, label, svg]) => (
          <button key={k} className={`tab ${nav.tab === k ? 'on' : ''}`} onClick={() => nav.setTab(k)} aria-current={nav.tab === k ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{svg}</svg>
            {label}
          </button>
        ))}
      </div>
    </nav>
  )
}

export function Header({ title, brand, onBack, right }: { title: string; brand?: boolean; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="top">
      {onBack && <button className="icon-btn" onClick={onBack}>‹ 戻る</button>}
      <h1 className={brand ? 'brand' : undefined}>{title}</h1>
      {right}
    </header>
  )
}
