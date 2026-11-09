import { itemCost, refInfo } from '../../domain/cost'
import type { Item } from '../../domain/types'
import { useData } from '../data'
import { qtyFmt, yen } from '../format'
import { useNav, type Holder } from '../nav'
import { saveItems } from '../Sheets'
import { moveIndex, useDragSort } from '../sort'

/** メニューや仕込み品の材料一覧。行をタップすると分量を編集し、右端の「≡」で並べ替える */
export function ItemRows({ items, holder }: { items: Item[]; holder: Holder }) {
  const data = useData()
  const { cat } = data
  const nav = useNav()
  const sort = useDragSort((from, to) => { void saveItems(holder, moveIndex(items, from, to), data) })
  return (
    <ul className="list" {...sort.listProps}>
      {items.map((it, k) => {
        const inf = refInfo(it.ref, cat)
        if (!inf) return null
        const yNote = inf.ing
          ? it.yieldPct != null ? ` · 歩留まり${it.yieldPct}%（ここだけ）` : inf.ing.yieldPct < 100 ? ` · 歩留まり${inf.ing.yieldPct}%` : ''
          : ''
        return (
          <li key={`${it.ref}-${k}`} {...sort.rowProps(k)}>
            <button className="row" onClick={() => nav.openSheet({ type: 'qty', holder, ref: it.ref, index: k })}>
              <span className="row-main">
                <span className="row-title">{inf.kind === 'p' && <span className="tag">仕込み</span>}{inf.name}</span>
                <span className="row-sub num">{qtyFmt(it.qty)}{inf.unit}{yNote}</span>
              </span>
              <span className="row-num"><b>{yen(itemCost(it, cat))}円</b></span>
            </button>
            {items.length > 1 && <button type="button" className="grip" aria-label={`${inf.name}を並べ替え`} {...sort.handle(k)}>≡</button>}
          </li>
        )
      })}
      <li><button className="add-row" onClick={() => nav.openSheet({ type: 'pick', holder })}>＋ 材料を追加</button></li>
    </ul>
  )
}
