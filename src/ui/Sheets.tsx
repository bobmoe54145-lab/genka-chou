import { useEffect, useState, type ReactNode } from 'react'
import { ingUnitCost, itemCost, prepUnitCost, refInfo, uses } from '../domain/cost'
import type { Item, Ref } from '../domain/types'
import { baseUnitOf } from '../domain/units'
import { newId, saveIngredient, saveMenu, savePrep } from '../db/repo'
import { useData, type AppData } from './data'
import { parseNum, qtyFmt, unitYen, yen } from './format'
import { fromDraft, IngredientForm, toDraft } from './IngredientForm'
import { useNav, type Holder, type Sheet } from './nav'

function SheetFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet-in" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" />
        <div className="sheet-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose}>閉じる</button></div>
        {children}
      </div>
    </div>
  )
}

export function SheetHost({ sheet }: { sheet: Sheet | null }) {
  const nav = useNav()
  if (!sheet) return null
  const close = nav.closeSheet
  switch (sheet.type) {
    case 'pick': return <SheetFrame title="材料を追加" onClose={close}><PickItem holder={sheet.holder} /></SheetFrame>
    case 'qty': return <QtySheet sheet={sheet} onClose={close} />
    case 'newIng': return <SheetFrame title="新しい食材を登録" onClose={close}><NewIngredient holder={sheet.holder} initial={sheet.draft} /></SheetFrame>
    case 'name': return <SheetFrame title={sheet.kind === 'menu' ? 'メニューを追加' : '仕込み品を追加'} onClose={close}><NameForm kind={sheet.kind} /></SheetFrame>
    case 'confirm': return <SheetFrame title={sheet.title} onClose={close}><Confirm sheet={sheet} /></SheetFrame>
  }
}

function itemsOf(holder: Holder, d: AppData): Item[] {
  return (holder.kind === 'menu' ? d.menus.find((m) => m.id === holder.id) : d.preps.find((p) => p.id === holder.id))?.items ?? []
}

/** メニューか仕込み品の材料を保存する。仕込み品なら影響したメニューの数を返す */
async function saveItems(holder: Holder, items: Item[], d: AppData): Promise<number> {
  if (holder.kind === 'menu') {
    const m = d.menus.find((x) => x.id === holder.id)
    if (m) await saveMenu({ ...m, items })
    return 0
  }
  const p = d.preps.find((x) => x.id === holder.id)
  return p ? savePrep({ ...p, items }) : 0
}

function PickItem({ holder }: { holder: Holder }) {
  const data = useData()
  const nav = useNav()
  const [tab, setTab] = useState<'i' | 'p'>('i')
  const [q, setQ] = useState('')
  const query = q.trim()
  const self: Ref = `p:${holder.id}`
  const rows = tab === 'i'
    ? data.ings.map((i) => ({ ref: `i:${i.id}` as Ref, name: i.name, sub: `${i.supplier ? i.supplier + ' · ' : ''}${unitYen(ingUnitCost(i))}円/${baseUnitOf(i.packUnit)}` }))
    : data.preps
      // 仕込み品に入れるときは、自分自身と自分を使っている仕込み品を除く（循環を防ぐ）
      .filter((p) => !(holder.kind === 'prep' && (p.id === holder.id || uses(p.items, self, data.cat))))
      .map((p) => ({ ref: `p:${p.id}` as Ref, name: p.name, sub: `${unitYen(prepUnitCost(p, data.cat))}円/${p.yieldUnit}` }))
  const shown = rows.filter((x) => !query || x.name.includes(query))

  return (
    <>
      <div className="seg">
        <button className={tab === 'i' ? 'on' : ''} onClick={() => setTab('i')}>食材</button>
        <button className={tab === 'p' ? 'on' : ''} onClick={() => setTab('p')}>仕込み品</button>
      </div>
      <div className="search"><input id="pick-q" type="search" placeholder="名前で検索" value={q} aria-label="材料を検索" onChange={(e) => setQ(e.target.value)} /></div>
      <ul className="list">
        {tab === 'i' && (
          <li><button className="add-row" onClick={() => nav.openSheet({ type: 'newIng', holder, draft: { name: query } })}>＋ 新しい食材を登録する</button></li>
        )}
        {shown.map((x) => (
          <li key={x.ref}>
            <button className="row" onClick={() => nav.openSheet({ type: 'qty', holder, ref: x.ref, index: null })}>
              <span className="row-main"><span className="row-title">{x.name}</span><span className="row-sub">{x.sub}</span></span>
              <span className="row-num"><b className="plus">＋</b></span>
            </button>
          </li>
        ))}
        {!shown.length && <li className="empty">{tab === 'i' ? '見つかりません。上から新しく登録できます' : '仕込み品がありません'}</li>}
      </ul>
    </>
  )
}

function QtySheet({ sheet, onClose }: { sheet: Extract<Sheet, { type: 'qty' }>; onClose: () => void }) {
  const data = useData()
  const nav = useNav()
  const items = itemsOf(sheet.holder, data)
  const existing = sheet.index != null ? items[sheet.index] : undefined
  const [qty, setQty] = useState(existing ? String(existing.qty) : '')
  const [yld, setYld] = useState(existing?.yieldPct != null ? String(existing.yieldPct) : '')

  const inf = refInfo(sheet.ref, data.cat)
  if (!inf) return null
  const q = parseNum(qty)
  const y = yld.trim() === '' ? undefined : parseNum(yld)
  const preview = itemCost({ ref: sheet.ref, qty: Number.isFinite(q) ? q : 0, yieldPct: y }, data.cat)
  const menu = sheet.holder.kind === 'menu' ? data.menus.find((m) => m.id === sheet.holder.id) : undefined

  const commit = async (next: Item[]) => {
    const n = await saveItems(sheet.holder, next, data)
    if (n) nav.toast(`${n}品のメニュー原価を更新しました`)
    onClose()
  }
  const save = () => {
    if (!(q > 0)) return nav.toast('分量を入れてください')
    if (y !== undefined && !(y > 0 && y <= 100)) return nav.toast('歩留まりは1〜100%で入れてください')
    const it: Item = { ref: sheet.ref, qty: q, ...(y !== undefined ? { yieldPct: y } : {}) }
    const next = sheet.index != null ? items.map((x, k) => (k === sheet.index ? it : x)) : [...items, it]
    return commit(next)
  }

  return (
    <SheetFrame title={inf.name} onClose={onClose}>
      <section className="card">
        <label className="field"><span>分量</span>
          <div className="affix">
            <input id="s-q" autoFocus={!existing} type="text" inputMode="decimal" placeholder="0" value={qty} onChange={(e) => setQty(e.target.value)} />
            <span>{inf.unit}</span>
          </div>
        </label>
        {inf.ing && (
          <label className="field"><span>ここでの歩留まり（空欄なら食材の標準 {inf.ing.yieldPct}%）</span>
            <div className="affix">
              <input id="s-y" type="text" inputMode="decimal" placeholder={String(inf.ing.yieldPct)} value={yld} onChange={(e) => setYld(e.target.value)} />
              <span>%</span>
            </div>
            <small>例：長ねぎを白髪ねぎにするとロスが増える、など</small>
          </label>
        )}
        <div className="calc">
          <span>この材料の原価</span>
          <b>{yen(preview)}円</b>
          <small>
            {Number.isFinite(q) && q > 0 ? `${unitYen(preview / q)}円/${inf.unit} × ${qtyFmt(q)}${inf.unit}` : '分量を入れると計算します'}
            {menu && menu.servings > 1 && q > 0 ? ` ÷ ${menu.servings}人前 = 1皿 ${yen(preview / menu.servings)}円` : ''}
          </small>
        </div>
      </section>
      <button className="btn primary" onClick={save}>{existing ? '保存する' : '追加する'}</button>
      {existing && <button className="btn danger" onClick={() => commit(items.filter((_, k) => k !== sheet.index))}>この材料を外す</button>}
    </SheetFrame>
  )
}

function NewIngredient({ holder, initial }: { holder: Holder; initial: Parameters<typeof toDraft>[0] }) {
  const nav = useNav()
  const [draft, setDraft] = useState(() => toDraft(initial))
  const save = async () => {
    const ing = fromDraft(draft, newId(), [])
    if (typeof ing === 'string') return nav.toast(ing)
    await saveIngredient(ing)
    nav.toast(`「${ing.name}」を食材に登録しました`)
    nav.openSheet({ type: 'qty', holder, ref: `i:${ing.id}`, index: null })
  }
  return (
    <>
      <p className="note">登録すると食材一覧にも追加され、そのまま分量の入力に進みます。</p>
      <IngredientForm draft={draft} onChange={setDraft} />
      <button className="btn primary" onClick={save}>登録して分量を入れる</button>
    </>
  )
}

function NameForm({ kind }: { kind: 'menu' | 'prep' }) {
  const nav = useNav()
  const [name, setName] = useState('')
  const create = async () => {
    const n = name.trim()
    if (!n) return nav.toast(kind === 'menu' ? '料理名を入れてください' : '名前を入れてください')
    const id = newId()
    if (kind === 'menu') await saveMenu({ id, name: n, servings: 1, price: 0, items: [], history: [] })
    else await savePrep({ id, name: n, yieldAmount: 1000, yieldUnit: 'ml', items: [] })
    nav.closeSheet()
    nav.setTab(kind)
    nav.open({ type: kind, id })
  }
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); void create() }}>
      <label className="field"><span>{kind === 'menu' ? '料理名' : '仕込み品の名前'}</span>
        <input id="new-name" autoFocus value={name} placeholder={kind === 'menu' ? '例：豚の生姜焼き定食' : '例：デミグラスソース'} onChange={(e) => setName(e.target.value)} />
      </label>
      <button className="btn primary" type="submit">作成して材料を入れる</button>
    </form>
  )
}

function Confirm({ sheet }: { sheet: Extract<Sheet, { type: 'confirm' }> }) {
  const nav = useNav()
  const [busy, setBusy] = useState(false)
  return (
    <>
      <p className="confirm-msg">{sheet.message}</p>
      <button className={`btn ${sheet.danger ? 'danger-solid' : 'primary'}`} disabled={busy} onClick={async () => {
        setBusy(true)
        nav.closeSheet()
        await sheet.onConfirm()
      }}>{sheet.confirmLabel}</button>
      <button className="btn ghost" onClick={nav.closeSheet}>やめる</button>
    </>
  )
}
