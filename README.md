# 原価計算帳

料理人がiPhoneで使う原価計算アプリ（PWA）です。食材の仕入れ値、仕込み品、メニューのレシピを登録すると、1皿の原価と原価率を計算します。データはiPhoneの中（IndexedDB）にだけ保存します。

- 要件定義書：https://claude.ai/code/artifact/000f75c3-68ba-45bb-9da0-610b73300642
- 金額はすべて税別です

## 開発

```sh
npm install
npm run dev      # 開発サーバー（同じWi‑FiのiPhoneから見るときは -- --host を付ける）
npm test         # 原価計算・履歴・バックアップのテスト
npm run build    # dist/ に本番用ファイルを作る
```

## 構成

| 場所 | 役割 |
| --- | --- |
| `src/domain/` | 単位換算、原価計算、履歴の記録（画面に依存しない） |
| `src/db/` | IndexedDB（Dexie）への保存、バックアップの書き出しと読み込み |
| `src/ui/` | 画面、シート、共通部品、スタイル |
| `public/` | アプリのアイコン（`logo.svg` から `npx pwa-assets-generator --preset minimal-2023 public/logo.svg` で生成） |

## 公開

`main` ブランチに push すると、`.github/workflows/deploy.yml` がテストとビルドをしてGitHub Pagesに公開します。初回だけ、GitHubのリポジトリ設定の「Pages」で Source を「GitHub Actions」にしてください。

## iPhoneでの使い方

1. 公開URLをSafariで開く
2. 共有ボタンから「ホーム画面に追加」を選ぶ
3. 以後はホーム画面のアイコンから開く（Safariで開いたままだと、しばらく使わないうちにデータが消えることがあります）
4. 設定の「ファイルに書き出す」で、定期的にiCloud Driveなどへバックアップする
