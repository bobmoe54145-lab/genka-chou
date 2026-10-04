import { useState } from 'react'
import { ingUnitCost, prepUnitCost, rateOf, uses } from '../../domain/cost'
import { CATEGORIES, type Ingredient } from '../../domain/types'
import { baseUnitOf } from '../../domain/units'
import { deleteIngredient, newId, saveIngredient } from '../../db/repo'
import { HistoryList, RatePill } from '../components'
import { useData } from '../data'
import { qtyFmt, unitYen, yen } from '../format'
import { fromDraft, IngredientForm, toDraft } from '../IngredientForm'
import { useNav } from '../nav'

export function IngredientList() {
  const { ings } = useData()
  const nav = useNav()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('全て')
  const query = q.trim()
  const rows = ings.filter((i) => (cat === '全て' || i.category === cat) && (!query || i.name.includes(query) || i.supplier.includes(query)))

  if (!ings.length) {
    return (
      <div className="list"><div className="empty">
        <p>まだ食材がありません。</p>
        <button className="btn primary" onClick={() => nav.open({ type: 'ing', id: 'new' })}>最初の食材を登録する</button>
      </div></div>
    )
  }
  return (
    <>
      <div className="search"><input id="ing-q" type="search" placeholder="食材名・取引先で検索" value={q} aria-label="食材を検索" onChange={(e) => setQ(e.target.value)} /></div>
      <div className="chips">
        {['全て', ...CATEGORIES].map((c) => <button key={c} className={`chip ${c === cat ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <p className="meta"><span>{rows.length}件</span></p>
      <ul className="list">
        {rows.map((i) => (
          <li key={i.id}>
            <button className="row" onClick={() => nav.open({ type: 'ing', id: i.id })}>
              <span className="row-main">
                <span className="row-title">{i.name}</span>
                <span className="row-sub">{[i.supplier, i.category, i.yieldPct < 100 ? `歩留まり${i.yieldPct}%` : ''].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="row-num">
                <b>{yen(i.price)}円</b>
                <small>/ {qtyFmt(i.packAmount)}{i.packUnit}</small>
                <small>{unitYen(ingUnitCost(i))}円/{baseUnitOf(i.packUnit)}</small>
              </span>
            </button>
          </li>
        ))}
        {!rows.length && <li className="empty">該当する食材がありません</li>}
      </ul>
    </>
  )
}

export function IngredientDetail({ id }: { id: string | 'new' }) {
  const { ings, preps, menus, cat, settings } = useData()
  const nav = useNav()
  const ing = id === 'new' ? undefined : ings.find((i) => i.id === id)
  const [draft, setDraft] = useState(() => toDraft(ing))
  const [saving, setSaving] = useState(false)

  if (id !== 'new' && !ing) return <p className="empty">この食材は削除されました</p>

  const ref = `i:${id}` as const
  const usedM = ing ? menus.filter((m) => uses(m.items, ref, cat)) : []
  const usedP = ing ? preps.filter((p) => uses(p.items, ref, cat)) : []

  const save = async () => {
    const next = fromDraft(draft, ing?.id ?? newId(), ing?.history ?? [])
    if (typeof next === 'string') return nav.toast(next)
    if (ing && baseUnitOf(ing.packUnit) !== baseUnitOf(next.packUnit) && (usedM.length || usedP.length)) {
      return nav.toast(`使用中の食材は、量の種類（${baseUnitOf(ing.packUnit)}）を変えられません`)
    }
    setSaving(true)
    try {
      const n = await saveIngredient(next)
      if (!ing) {
        nav.toast(`「${next.name}」を登録しました`)
        nav.back()
      } else {
        nav.toast(n ? `保存しました。${n}品のメニュー原価を更新しました` : '保存しました')
      }
    } finally {
      setSaving(false)
    }
  }

  const remove = () => nav.openSheet({
    type: 'confirm', title: '食材を削除', message: `「${ing!.name}」を削除します。元に戻せません。`, confirmLabel: '削除する', danger: true,
    onConfirm: async () => {
      try {
        await deleteIngredient(ing!.id)
        nav.toast('削除しました')
        nav.back()
      } catch (e) {
        nav.toast((e as Error).message)
      }
    },
  })

  return (
    <>
      <IngredientForm draft={draft} onChange={setDraft} />
      <button className="btn primary" disabled={saving} onClick={save}>{ing ? '保存する' : '登録する'}</button>
      {ing && (
        <>
          <section className="sec">
            <h2>仕入れ価格の履歴<small>価格を変えて保存すると記録されます</small></h2>
            <HistoryList rows={priceRows(ing)} />
          </section>
          <section className="sec">
            <h2>この食材を使っているもの<small>{usedM.length + usedP.length}件</small></h2>
            <ul className="list">
              {usedP.map((p) => (
                <li key={p.id}><button className="row" onClick={() => nav.open({ type: 'prep', id: p.id })}>
                  <span className="row-main"><span className="row-title"><span className="tag">仕込み</span>{p.name}</span></span>
                  <span className="row-num"><small>{unitYen(prepUnitCost(p, cat))}円/{p.yieldUnit}</small></span>
                </button></li>
              ))}
              {usedM.map((m) => (
                <li key={m.id}><button className="row" onClick={() => nav.open({ type: 'menu', id: m.id })}>
                  <span className="row-main"><span className="row-title">{m.name}</span></span>
                  <RatePill rate={rateOf(m, cat)} target={settings.targetRate} />
                </button></li>
              ))}
              {!usedM.length && !usedP.length && <li className="empty">まだ使われていません</li>}
            </ul>
          </section>
          <button className="btn danger" onClick={remove}>この食材を削除</button>
        </>
      )}
    </>
  )
}

function priceRows(i: Ingredient) {
  return i.history.map((h, k) => {
    const diff = k ? h.price - i.history[k - 1].price : null
    return { date: h.date, value: `${yen(h.price)}円`, diff, diffText: diff == null ? '' : diff > 0 ? `▲ ${yen(diff)}` : diff < 0 ? `▼ ${yen(-diff)}` : '±0' }
  }).reverse()
}
