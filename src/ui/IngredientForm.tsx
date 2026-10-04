import { CATEGORIES, type Ingredient, type PackUnit } from '../domain/types'
import { BASE, PACK_UNITS } from '../domain/units'
import { useData } from './data'
import { qtyFmt, unitYen, yen, parseNum } from './format'

/** 入力途中の値を文字のまま持つ食材の下書き */
export interface IngDraft {
  name: string
  category: string
  supplier: string
  price: string
  packAmount: string
  packUnit: PackUnit
  yieldPct: string
}

export const toDraft = (i: Partial<Ingredient> = {}): IngDraft => ({
  name: i.name ?? '',
  category: i.category ?? '野菜',
  supplier: i.supplier ?? '',
  price: i.price != null ? String(i.price) : '',
  packAmount: String(i.packAmount ?? 1),
  packUnit: i.packUnit ?? 'kg',
  yieldPct: String(i.yieldPct ?? 100),
})

/** 下書きを食材にする。足りない項目があればエラーの文を返す */
export function fromDraft(d: IngDraft, id: string, history: Ingredient['history']): Ingredient | string {
  const price = parseNum(d.price), packAmount = parseNum(d.packAmount), yieldPct = parseNum(d.yieldPct)
  if (!d.name.trim()) return '食材名を入れてください'
  if (!(price > 0)) return '仕入れ価格を入れてください'
  if (!(packAmount > 0)) return 'この価格で入ってくる量を入れてください'
  if (!(yieldPct > 0 && yieldPct <= 100)) return '歩留まりは1〜100%で入れてください'
  return { id, name: d.name.trim(), category: d.category, supplier: d.supplier.trim(), price, packAmount, packUnit: d.packUnit, yieldPct, history }
}

function Calc({ d }: { d: IngDraft }) {
  const price = parseNum(d.price), amt = parseNum(d.packAmount), y = parseNum(d.yieldPct) || 100
  if (!(price > 0) || !(amt > 0)) {
    return <div className="calc"><span>使える分の単価</span><b>—</b><small>価格と量を入れると計算します</small></div>
  }
  const [bu, f] = BASE[d.packUnit]
  const c = price / (amt * f) / (y / 100)
  return (
    <div className="calc">
      <span>使える分の単価</span>
      <b>{unitYen(c)}円 / {bu}</b>
      <small>{yen(price)}円 ÷ {qtyFmt(amt * f)}{bu}{y < 100 ? ` ÷ 歩留まり${y}%` : ''}</small>
    </div>
  )
}

export function IngredientForm({ draft, onChange }: { draft: IngDraft; onChange: (d: IngDraft) => void }) {
  const { ings } = useData()
  const suppliers = [...new Set(ings.map((i) => i.supplier).filter(Boolean))]
  const set = <K extends keyof IngDraft>(k: K, v: IngDraft[K]) => onChange({ ...draft, [k]: v })
  return (
    <section className="card">
      <label className="field"><span>食材名</span>
        <input id="f-name" value={draft.name} placeholder="例：豚ロース スライス" onChange={(e) => set('name', e.target.value)} />
      </label>
      <div className="two">
        <label className="field"><span>カテゴリ</span>
          <select id="f-cat" value={draft.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field"><span>取引先</span>
          <input id="f-sup" list="suppliers" value={draft.supplier} placeholder="例：西原商会" onChange={(e) => set('supplier', e.target.value)} />
          <datalist id="suppliers">{suppliers.map((s) => <option key={s} value={s} />)}</datalist>
        </label>
      </div>
      <label className="field"><span>仕入れ価格<em>税別</em></span>
        <div className="affix">
          <input id="f-price" type="text" inputMode="decimal" value={draft.price} placeholder="2000" onChange={(e) => set('price', e.target.value)} />
          <span>円</span>
        </div>
      </label>
      <div className="field"><span>この価格で入ってくる量</span>
        <div className="two">
          <input id="f-amt" type="text" inputMode="decimal" aria-label="内容量" value={draft.packAmount} onChange={(e) => set('packAmount', e.target.value)} />
          <select id="f-unit" aria-label="単位" value={draft.packUnit} onChange={(e) => set('packUnit', e.target.value as PackUnit)}>
            {PACK_UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <small>10kg箱なら「10 kg」、1.8L瓶なら「1.8 L」、kg単価なら「1 kg」、10個入りなら「10 個」</small>
      </div>
      <label className="field"><span>歩留まり</span>
        <div className="affix">
          <input id="f-yld" type="text" inputMode="decimal" value={draft.yieldPct} onChange={(e) => set('yieldPct', e.target.value)} />
          <span>%</span>
        </div>
        <small>皮・骨・筋など捨てる部分を除いた、実際に使える割合</small>
      </label>
      <Calc d={draft} />
    </section>
  )
}
