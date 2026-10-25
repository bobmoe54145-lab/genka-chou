import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import type { PhotoOwner } from '../../domain/types'
import { db } from '../../db/db'
import { deletePhoto, savePhoto } from '../../db/repo'
import { useNav } from '../nav'
import { shrinkPhoto } from '../photo'

/** 写真を画面いっぱいに大きく表示する */
function PhotoViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="写真を大きく表示" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <img src={src} alt={alt} />
      <button type="button" className="viewer-close" autoFocus onClick={onClose}>閉じる</button>
    </div>
  )
}

/** メニューや仕込み品の写真（1枚）。材料の上に置く */
export function PhotoBlock({ owner, name }: { owner: PhotoOwner; name: string }) {
  const nav = useNav()
  // undefined は読み込み中、null は写真なし
  const photo = useLiveQuery(() => db.photos.get(owner).then((p) => p ?? null), [owner])
  const [busy, setBusy] = useState(false)
  const [armedDelete, setArmedDelete] = useState(false)
  const [zoom, setZoom] = useState(false)
  const closeZoom = useCallback(() => setZoom(false), [])

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    setArmedDelete(false)
    try {
      await savePhoto(owner, await shrinkPhoto(f))
    } catch {
      nav.toast('この写真は読み込めませんでした。別の写真を選んでください')
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!armedDelete) return setArmedDelete(true)
    setArmedDelete(false)
    await deletePhoto(owner)
    nav.toast('写真を削除しました')
  }
  const input = <input type="file" accept="image/*" hidden onChange={onFile} />

  if (photo === undefined) return null
  if (busy) return <div className="photo-add busy" role="status">写真を準備しています…</div>
  if (!photo) {
    return <label className="photo-add">＋ 写真を追加{input}</label>
  }
  const alt = `${name}の写真`
  return (
    <div className="photo-block">
      <button type="button" className="photo" onClick={() => setZoom(true)} aria-label={`${alt}を大きく表示`}>
        <img src={photo.dataUrl} alt={alt} />
      </button>
      <div className="photo-tools">
        <label className="photo-change">写真を変える{input}</label>
        <button type="button" className={`del ${armedDelete ? 'armed' : ''}`} onClick={remove}>
          {armedDelete ? 'もう一度押すと削除' : '削除'}
        </button>
      </div>
      {zoom && <PhotoViewer src={photo.dataUrl} alt={alt} onClose={closeZoom} />}
    </div>
  )
}
