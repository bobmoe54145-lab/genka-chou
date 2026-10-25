import { itemCost, prepUnitCost, uses } from '../../domain/cost'
import type { BaseUnit, Prep } from '../../domain/types'
import { BASE_UNITS } from '../../domain/units'
import { deletePrep, savePrep } from '../../db/repo'
import { NumInput, TextInput } from '../components'
import { useData } from '../data'
import { qtyFmt, unitYen, yen } from '../format'
import { useNav } from '../nav'
import { ItemRows } from './ItemRows'
import { PhotoBlock } from './PhotoBlock'
import { StepsEditor } from './Steps'

export function PrepList() {
  const { preps, menus, cat } = useData()
  const nav = useNav()
  return (
    <>
      <p className="note">ソースやだしなど、まとめて仕込むものです。出来上がり量から単価を出し、メニューの材料として使えます。</p>
      <ul className="list">
        {preps.map((p) => {
          const n = menus.filter((m) => uses(m.items, `p:${p.id}`, cat)).length
          return (
            <li key={p.id}>
              <button className="row" onClick={() => nav.open({ type: 'prep', id: p.id })}>
                <span className="row-main">
                  <span className="row-title">{p.name}</span>
                  <span className="row-sub">出来上がり {qtyFmt(p.yieldAmount)}{p.yieldUnit} · {n}品で使用</span>
                </span>
                <span className="row-num"><b>{unitYen(prepUnitCost(p, cat))}円</b><small>/ {p.yieldUnit}</small></span>
              </button>
            </li>
          )
        })}
        {!preps.length && (
          <li className="empty">
            <p>まだ仕込み品がありません。</p>
            <button className="btn primary" onClick={() => nav.openSheet({ type: 'name', kind: 'prep' })}>最初の仕込み品を登録する</button>
          </li>
        )}
      </ul>
    </>
  )
}

export function PrepDetail({ id }: { id: string }) {
  const { preps, cat } = useData()
  const nav = useNav()
  const p = preps.find((x) => x.id === id)
  if (!p) return <p className="empty">この仕込み品は削除されました</p>

  const update = async (patch: Partial<Prep>) => {
    const n = await savePrep({ ...p, ...patch })
    if (n) nav.toast(`${n}品のメニュー原価を更新しました`)
  }
  const total = p.items.reduce((a, it) => a + itemCost(it, cat), 0)

  const remove = () => nav.openSheet({
    type: 'confirm', title: '仕込み品を削除', message: `「${p.name}」を削除します。元に戻せません。`, confirmLabel: '削除する', danger: true,
    onConfirm: async () => {
      try {
        await deletePrep(p.id)
        nav.toast('削除しました')
        nav.back()
      } catch (e) {
        nav.toast((e as Error).message)
      }
    },
  })

  return (
    <>
      <section className="card">
        <label className="field"><span>仕込み品の名前</span>
          <TextInput id="p-name" value={p.name} onCommit={(name) => update({ name })} />
        </label>
        <div className="field"><span>出来上がり量</span>
          <div className="two">
            <NumInput id="p-ya" label="出来上がり量" value={p.yieldAmount} min={0.0001} onCommit={(yieldAmount) => update({ yieldAmount })} />
            <select id="p-yu" aria-label="単位" value={p.yieldUnit} onChange={(e) => update({ yieldUnit: e.target.value as BaseUnit })}>
              {BASE_UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <small>仕込んだ後に実際にできた量。メニューではこの単位で分量を入れます</small>
        </div>
        <div className="calc">
          <span>出来上がり1{p.yieldUnit}あたり</span>
          <b>{unitYen(prepUnitCost(p, cat))}円 / {p.yieldUnit}</b>
          <small>材料合計 {yen(total)}円 ÷ {qtyFmt(p.yieldAmount)}{p.yieldUnit}</small>
        </div>
      </section>
      <PhotoBlock owner={`prep:${p.id}`} name={p.name} />
      <section className="sec">
        <h2>材料<small>行をタップして分量を変更</small></h2>
        <ItemRows items={p.items} holder={{ kind: 'prep', id: p.id }} />
      </section>
      <section className="sec">
        <h2>作り方<small>入力欄から離れると保存</small></h2>
        <StepsEditor steps={p.steps} onSave={(steps) => update({ steps })} />
      </section>
      <button className="btn danger" onClick={remove}>この仕込み品を削除</button>
    </>
  )
}
