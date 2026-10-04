import { useRef, useState, type ChangeEvent } from 'react'
import { backupFileName, backupOverdue, buildBackup, parseBackup, restoreBackup } from '../../db/backup'
import { saveSettings } from '../../db/repo'
import { NumInput } from '../components'
import { useData } from '../data'
import { useNav } from '../nav'

/** 全データをファイルに書き出す。iPhoneでは共有シートから「ファイルに保存」を選べる */
export function useExportBackup() {
  const { settings, ings, preps, menus } = useData()
  const nav = useNav()
  return async () => {
    // 共有シートはタップ直後でないと開けないので、DBを読み直さず画面のデータから作る
    const file = buildBackup({ settings, ingredients: ings, preps, menus })
    const blob = new File([JSON.stringify(file)], backupFileName(), { type: 'application/json' })
    try {
      if (navigator.canShare?.({ files: [blob] })) {
        await navigator.share({ files: [blob], title: '原価計算帳のバックアップ' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = blob.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      await saveSettings({ lastBackupAt: file.exportedAt })
      nav.toast('バックアップを書き出しました')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') nav.toast('書き出せませんでした。もう一度試してください')
    }
  }
}

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

function readFlag(key: string): boolean {
  try { return sessionStorage.getItem(key) === '1' } catch { return false }
}
function writeFlag(key: string) {
  try { sessionStorage.setItem(key, '1') } catch { /* 保存できなくても表示を消すだけ */ }
}

/** メニュー一覧の上に出す案内（ホーム画面への追加、バックアップの催促） */
export function Banners() {
  const { settings, ings, menus } = useData()
  const exportBackup = useExportBackup()
  const [hideInstall, setHideInstall] = useState(() => readFlag('hide-install'))
  const showInstall = !hideInstall && isIOS() && !isStandalone()
  const overdue = backupOverdue(settings.lastBackupAt, ings.length + menus.length > 0)

  return (
    <>
      {showInstall && (
        <div className="banner">
          <p><b>ホーム画面に追加してください</b>Safariの共有ボタン（□に↑）から「ホーム画面に追加」を選び、ホーム画面のアイコンから開いてください。Safariで開いたままだと、しばらく使わないうちにデータが消えることがあります。</p>
          <button className="icon-btn" onClick={() => { writeFlag('hide-install'); setHideInstall(true) }}>閉じる</button>
        </div>
      )}
      {overdue && (
        <div className="banner warn">
          <p><b>バックアップしてください</b>{settings.lastBackupAt ? '最後の書き出しから30日以上たっています。' : 'まだ一度もバックアップしていません。'}機種変更や故障に備えて、ファイルに書き出しておきましょう。</p>
          <button className="icon-btn solid" onClick={exportBackup}>書き出す</button>
        </div>
      )}
    </>
  )
}

export function SettingsScreen() {
  const { settings, ings, preps, menus } = useData()
  const nav = useNav()
  const exportBackup = useExportBackup()
  const fileRef = useRef<HTMLInputElement>(null)
  const t = settings.targetRate

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const b = parseBackup(await f.text())
      nav.openSheet({
        type: 'confirm', title: 'バックアップを読み込む',
        message: `今のデータをすべて消して、バックアップの内容（食材${b.ingredients.length}件、仕込み品${b.preps.length}件、メニュー${b.menus.length}品）に置き換えます。`,
        confirmLabel: '置き換える', danger: true,
        onConfirm: async () => {
          await restoreBackup(b)
          nav.toast('バックアップを読み込みました')
        },
      })
    } catch (err) {
      nav.toast((err as Error).message)
    }
  }

  return (
    <>
      <section className="card">
        <label className="field"><span>目標原価率</span>
          <div className="affix">
            <NumInput id="set-target" value={t} min={1} onCommit={async (v) => {
              if (v >= 100) return nav.toast('目標原価率は100%未満で入れてください')
              await saveSettings({ targetRate: v })
              nav.toast(`目標原価率を${v}%にしました`)
            }} />
            <span>%</span>
          </div>
          <small>メニューの色分けの基準になります</small>
        </label>
        <div className="legend">
          <span className="pill ok">〜{t}% 目標内</span>
          <span className="pill warn">〜{t + 5}% やや高め</span>
          <span className="pill bad">{t + 5}%超 目標超え</span>
        </div>
      </section>
      <section className="sec">
        <h2>バックアップ</h2>
        <div className="card">
          <p className="muted">データはこのiPhoneの中だけに保存されます。機種変更や故障に備えて、定期的にファイルへ書き出してください。共有メニューの「"ファイル"に保存」からiCloud Driveに保存できます。</p>
          <button className="btn ghost" onClick={exportBackup}>ファイルに書き出す</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>ファイルから読み込む</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
          <small className="muted">最終書き出し：{settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }) : 'まだありません'}</small>
        </div>
      </section>
      <section className="sec">
        <h2>登録件数</h2>
        <ul className="hist">
          <li><span>食材</span><span /><span className="v">{ings.length}件</span></li>
          <li><span>仕込み品</span><span /><span className="v">{preps.length}件</span></li>
          <li><span>メニュー</span><span /><span className="v">{menus.length}品</span></li>
        </ul>
      </section>
    </>
  )
}
