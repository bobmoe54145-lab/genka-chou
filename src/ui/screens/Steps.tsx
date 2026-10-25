import { useEffect, useRef, useState } from 'react'

/** 中身に合わせて高さが伸びる入力欄 */
function GrowText({ value, onChange, onBlur, autoFocus, label }: {
  value: string
  onChange: (s: string) => void
  onBlur: (movedInside: boolean) => void
  autoFocus: boolean
  label: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea ref={ref} rows={1} value={value} aria-label={label} autoFocus={autoFocus} placeholder="例：豚肉に下味をつけて10分おく"
      onChange={(e) => onChange(e.target.value)} onBlur={(e) => onBlur(!!(e.relatedTarget as HTMLElement | null)?.closest('.steps'))} />
  )
}

const clean = (list: string[]) => list.map((s) => s.trim()).filter(Boolean)
const same = (a: string[], b: string[]) => a.length === b.length && a.every((s, i) => s === b[i])

/**
 * 作り方の手順。入力欄から離れたときに保存する。
 * 空の手順は保存しない（画面からは、手順の欄の外へ移ったときに消す）。
 */
export function StepsEditor({ steps, onSave }: { steps: string[]; onSave: (steps: string[]) => void }) {
  const [draft, setDraft] = useState(steps)
  const [prev, setPrev] = useState(steps)
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const [armedDelete, setArmedDelete] = useState<number | null>(null)
  // 保存した結果が戻ってきたときは、追加したばかりの空の手順を残すため、中身が違うときだけ入れ替える
  if (prev !== steps) {
    setPrev(steps)
    if (!same(clean(draft), steps)) setDraft(steps)
  }

  /** 保存する。keepEmpty なら画面の空の手順は残す（別の手順の欄へ移ったとき） */
  const save = (next: string[], keepEmpty = false) => {
    const cleaned = clean(next)
    setDraft(keepEmpty ? next : cleaned)
    if (!same(cleaned, steps)) onSave(cleaned)
  }
  const move = (k: number, d: -1 | 1) => {
    const next = [...draft]
    ;[next[k], next[k + d]] = [next[k + d], next[k]]
    setArmedDelete(null)
    save(next)
  }
  const remove = (k: number) => {
    if (armedDelete !== k) return setArmedDelete(k)
    setArmedDelete(null)
    save(draft.filter((_, i) => i !== k))
  }

  return (
    <ol className="list steps">
      {draft.map((s, k) => (
        <li key={k}>
          <span className="step-no num" aria-hidden="true">{k + 1}</span>
          <div className="step-body">
            <GrowText value={s} label={`手順${k + 1}`} autoFocus={focusIndex === k}
              onChange={(v) => setDraft(draft.map((x, i) => (i === k ? v : x)))}
              onBlur={(movedInside) => { setFocusIndex(null); save(draft, movedInside) }} />
            <div className="step-tools">
              <button type="button" disabled={k === 0} onClick={() => move(k, -1)} aria-label={`手順${k + 1}を上へ`}>↑</button>
              <button type="button" disabled={k === draft.length - 1} onClick={() => move(k, 1)} aria-label={`手順${k + 1}を下へ`}>↓</button>
              <button type="button" className={`del ${armedDelete === k ? 'armed' : ''}`} onClick={() => remove(k)}>
                {armedDelete === k ? 'もう一度押すと削除' : '削除'}
              </button>
            </div>
          </div>
        </li>
      ))}
      <li>
        <button type="button" className="add-row" onClick={() => { setFocusIndex(draft.length); setArmedDelete(null); setDraft([...draft, '']) }}>
          ＋ 手順を追加
        </button>
      </li>
    </ol>
  )
}
