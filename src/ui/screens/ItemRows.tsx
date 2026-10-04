import { itemCost, refInfo } from '../../domain/cost'
import type { Item } from '../../domain/types'
import { useData } from '../data'
import { qtyFmt, yen } from '../format'
import { useNav, type Holder } from '../nav'

/** メニューや仕込み品の材料一覧。行をタップすると分量を編集する */
export function ItemRows({ items, holder }: { items: Item[]; holder: Holder }) {
  const { cat } = useData()
  const nav = useNav()
  return (
    <ul className="list">
      {items.map((it, k) => {
        const inf = refInfo(it.ref, cat)
        if (!inf) return null
        const yNote = inf.ing
          ? it.yieldPct != null ? ` · 歩留まり${it.yieldPct}%（ここだけ）` : inf.ing.yieldPct < 100 ? ` · 歩留まり${inf.ing.yieldPct}%` : ''
          : ''
        return (
          <li key={`${it.ref}-${k}`}>
            <button className="row" onClick={() => nav.openSheet({ type: 'qty', holder, ref: it.ref, index: k })}>
              <span className="row-main">
                <span className="row-title">{inf.kind === 'p' && <span className="tag">仕込み</span>}{inf.name}</span>
                <span className="row-sub num">{qtyFmt(it.qty)}{inf.unit}{yNote}</span>
              </span>
              <span className="row-num"><b>{yen(itemCost(it, cat))}円</b></span>
            </button>
          </li>
        )
      })}
      <li><button className="add-row" onClick={() => nav.openSheet({ type: 'pick', holder })}>＋ 材料を追加</button></li>
    </ul>
  )
}
