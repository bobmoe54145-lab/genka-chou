import { useState } from 'react'
import { level, menuCost, rateOf } from '../../domain/cost'
import type { Menu } from '../../domain/types'
import { deleteMenu, saveMenu } from '../../db/repo'
import { HistoryList, NumInput, RatePill, StatusBadge, TextInput } from '../components'
import { useData } from '../data'
import { yen } from '../format'
import { useNav } from '../nav'
import { ItemRows } from './ItemRows'
import { Banners } from './Settings'

export function MenuList() {
  const { menus, cat, settings } = useData()
  const nav = useNav()
  const [sort, setSort] = useState<'rate' | 'name'>('rate')
  const target = settings.targetRate
  const rows = menus.map((m) => ({ m, r: rateOf(m, cat) }))
  const priced = rows.filter(({ m }) => m.price > 0 && m.items.length)
  const avg = priced.length ? priced.reduce((a, { r }) => a + r, 0) / priced.length : 0
  const over = priced.filter(({ r }) => r > target).length
  rows.sort(sort === 'rate' ? (a, b) => b.r - a.r : (a, b) => a.m.name.localeCompare(b.m.name, 'ja'))

  return (
    <>
      <Banners />
      <div className="summary">
        <div><span>目標原価率</span><b>{target}%</b></div>
        <div><span>平均原価率</span><b>{priced.length ? `${avg.toFixed(1)}%` : '—'}</b></div>
        <div><span>目標超え</span><b className={over ? 'bad' : ''}>{over}品</b></div>
      </div>
      <div className="sec">
        <p className="meta">
          <span>{rows.length}品</span>
          <button onClick={() => setSort(sort === 'rate' ? 'name' : 'rate')}>{sort === 'rate' ? '原価率の高い順 ⇅' : '名前順 ⇅'}</button>
        </p>
        <ul className="list">
          {rows.map(({ m, r }) => (
            <li key={m.id}>
              <button className="row" onClick={() => nav.open({ type: 'menu', id: m.id })}>
                <span className="row-main">
                  <span className="row-title">{m.name}</span>
                  <span className="row-sub num">売価 {m.price > 0 ? `${yen(m.price)}円` : '未設定'} · 原価 {yen(menuCost(m, cat))}円</span>
                </span>
                {m.price > 0 ? <RatePill rate={r} target={target} /> : <span className="pill none">—</span>}
              </button>
            </li>
          ))}
          {!rows.length && (
            <li className="empty">
              <p>まだメニューがありません。</p>
              <button className="btn primary" onClick={() => nav.openSheet({ type: 'name', kind: 'menu' })}>最初のメニューを登録する</button>
            </li>
          )}
        </ul>
      </div>
    </>
  )
}

export function MenuDetail({ id }: { id: string }) {
  const { menus, cat, settings } = useData()
  const nav = useNav()
  const m = menus.find((x) => x.id === id)
  if (!m) return <p className="empty">このメニューは削除されました</p>

  const target = settings.targetRate
  const c = menuCost(m, cat), r = rateOf(m, cat), lv = level(r, target)
  const scale = Math.max(60, Math.ceil((r + 5) / 10) * 10)
  const update = (patch: Partial<Menu>) => saveMenu({ ...m, ...patch })

  const remove = () => nav.openSheet({
    type: 'confirm', title: 'メニューを削除', message: `「${m.name}」を削除します。原価の推移も消え、元に戻せません。`, confirmLabel: '削除する', danger: true,
    onConfirm: async () => {
      await deleteMenu(m.id)
      nav.toast('削除しました')
      nav.back()
    },
  })

  const histRows = m.history.map((h, k) => {
    const diff = k ? Math.round((h.rate - m.history[k - 1].rate) * 10) / 10 : null
    return {
      date: h.date, value: `${yen(h.cost)}円 · ${h.rate.toFixed(1)}%`, diff,
      diffText: diff == null ? '' : diff > 0 ? `▲ ${diff.toFixed(1)}pt` : diff < 0 ? `▼ ${(-diff).toFixed(1)}pt` : '±0',
    }
  }).reverse()

  return (
    <>
      <section className="hero">
        {m.price > 0 ? (
          <>
            <div className="hero-top">
              <div className="hero-rate"><span>原価率</span><b className={lv}>{r.toFixed(1)}<small>%</small></b></div>
              <StatusBadge lv={lv} />
            </div>
            <div>
              <div className="bar">
                <i className={lv} style={{ width: `${Math.min(100, (r / scale) * 100)}%` }} />
                <em style={{ left: `${(target / scale) * 100}%` }} title="目標" />
              </div>
              <div className="bar-legend"><span>0%</span><span>目標 {target}%</span><span>{scale}%</span></div>
            </div>
          </>
        ) : (
          <div className="hero-rate"><span>原価率</span><b>—</b><small className="hint">売価を入れると原価率を計算します</small></div>
        )}
        <div className="figs">
          <div><span>1皿の原価</span><b>{yen(c)}円</b></div>
          <div><span>売価</span><b>{m.price > 0 ? `${yen(m.price)}円` : '—'}</b></div>
          <div><span>粗利</span><b>{m.price > 0 ? `${yen(m.price - c)}円` : '—'}</b></div>
        </div>
      </section>
      <section className="card">
        <label className="field"><span>料理名</span>
          <TextInput id="m-name" value={m.name} onCommit={(name) => update({ name })} />
        </label>
        <div className="two">
          <label className="field"><span>売価<em>税別</em></span>
            <div className="affix"><NumInput id="m-price" value={m.price} placeholder="980" onCommit={(price) => update({ price })} /><span>円</span></div>
          </label>
          <label className="field"><span>レシピの分量</span>
            <div className="affix"><NumInput id="m-serv" value={m.servings} min={1} onCommit={(servings) => update({ servings })} /><span>人前</span></div>
          </label>
        </div>
      </section>
      <section className="sec">
        <h2>材料<small>{m.servings > 1 ? `${m.servings}人前の分量 → 1皿に換算` : '1皿分の分量'}</small></h2>
        <ItemRows items={m.items} holder={{ kind: 'menu', id: m.id }} />
      </section>
      <section className="sec">
        <h2>原価の推移<small>食材の値段や売価が変わると記録</small></h2>
        <HistoryList rows={histRows} />
      </section>
      <button className="btn danger" onClick={remove}>このメニューを削除</button>
    </>
  )
}
