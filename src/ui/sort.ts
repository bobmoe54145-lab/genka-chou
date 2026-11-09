import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'

/** 配列の from 番目を to 番目へ動かした新しい配列を返す */
export function moveIndex<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list]
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}

/** 行の中心の位置から、つかんだ行を落とす位置を決める */
export function dropIndex(from: number, center: number, mids: readonly number[]): number {
  let to = from
  for (let i = from + 1; i < mids.length; i++) if (center > mids[i]) to = i
  for (let i = from - 1; i >= 0; i--) if (center < mids[i]) to = i
  return to
}

type Drag = { from: number; to: number; dy: number }

const EDGE = 80 // 画面の上下この幅に指が来たら自動でスクロールする

/**
 * 「≡」のつまみをつかんで行を上下に動かす。
 * 動かしている間は DOM の順番を変えずに見た目（transform）だけずらし、指を離したときに onDrop を呼ぶ。
 * DOM を並べ替えると、つかんでいる要素が外れて指の追跡（pointer capture）が切れるため。
 */
export function useDragSort(onDrop: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const start = useRef({ y: 0, scroll: 0, mids: [] as number[], center: 0, height: 0 })

  const rowsOf = (el: Element) => [...(el.closest('[data-sort-list]')?.querySelectorAll(':scope > [data-sort-row]') ?? [])]

  const handle = (k: number) => ({
    'data-sort-handle': '',
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.button !== 0) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      const rects = rowsOf(e.currentTarget).map((r) => r.getBoundingClientRect())
      const scroll = window.scrollY
      start.current = {
        y: e.clientY,
        scroll,
        mids: rects.map((r) => r.top + scroll + r.height / 2),
        center: rects[k].top + scroll + rects[k].height / 2,
        height: rects[k].height,
      }
      setDrag({ from: k, to: k, dy: 0 })
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      if (!drag) return
      if (e.clientY < EDGE) window.scrollBy(0, -8)
      else if (e.clientY > window.innerHeight - EDGE) window.scrollBy(0, 8)
      const s = start.current
      const dy = e.clientY - s.y + (window.scrollY - s.scroll)
      setDrag({ ...drag, dy, to: dropIndex(drag.from, s.center + dy, s.mids) })
    },
    onPointerUp() {
      if (drag && drag.from !== drag.to) onDrop(drag.from, drag.to)
      setDrag(null)
    },
    onPointerCancel() { setDrag(null) },
  })

  /** 行に付ける見た目のずれ */
  const rowStyle = (k: number): CSSProperties | undefined => {
    if (!drag) return undefined
    const { from, to, dy } = drag
    if (k === from) return { transform: `translateY(${dy}px)`, position: 'relative', zIndex: 2 }
    const h = start.current.height
    if (from < k && k <= to) return { transform: `translateY(${-h}px)` }
    if (to <= k && k < from) return { transform: `translateY(${h}px)` }
    return undefined
  }
  const rowProps = (k: number) => ({
    'data-sort-row': '',
    className: drag ? (k === drag.from ? 'sort-row dragging' : 'sort-row moving') : 'sort-row',
    style: rowStyle(k),
  })

  return { handle, rowProps, listProps: { 'data-sort-list': '' }, dragging: drag != null }
}
