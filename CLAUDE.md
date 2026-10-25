# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 作業ルール

共通ルールは `~/dev-knowledge/standards/` にある。ここにはこのプロジェクト固有のことだけ書く。

## Project Status

料理人1名（開発するユーザー本人ではない）がiPhoneで使う原価計算PWA「原価計算帳」。金額はすべて税別、食材は手入力。

作る順番：
1. 食材・仕込み品・メニュー、原価・原価率、価格履歴と原価推移、バックアップ（完了、2026-10-04 公開）
2. 新しいアイコン、仕込み品とメニューの作り方（番号付きの手順）（2026-10-25 公開）
3. 仕込み品とメニューの写真（1枚、材料の上、高さ220pxで切り取り表示、押すと全体を拡大）（2026-10-25）

公開先：https://bobmoe54145-lab.github.io/genka-chou/
GitHub：https://github.com/bobmoe54145-lab/genka-chou（公開。GitHub Pages の無料プランのため）
要件定義書：https://claude.ai/code/artifact/000f75c3-68ba-45bb-9da0-610b73300642

やらないと決めたこと：スクショ読み取り、CSV取り込み、税込入力・税率設定、メニューのカテゴリ、作り方の手順ごとの写真、写真の複数枚、一覧への写真の表示、調理中用の画面、コツ・盛り付けのメモ欄。

## Commands

- `npm run dev` — 開発サーバー
- `npm test` — 計算・履歴・保存・バックアップ・データベースの版上げのテスト
- `npm run build` — 本番用ビルド（GitHub Pages 用は `BASE_PATH=/genka-chou/` を付ける。Actions が付ける）
- `npm run lint` — oxlint（`only-export-components` の警告は既知で問題なし）
- `npm run icons` — `assets/icon-original.png` から `public/` のアイコン一式を作る

## 動作確認のルール

- ブラウザ確認は `http://127.0.0.1:<5173以外のポート>` で行う（5173 は別のアプリが使っていることがある）。確認後は `indexedDB.deleteDatabase('genka-chou')` で消す。
- 開発サーバーではモジュールを直接読める：`await import('/src/db/repo.ts')` で確認用データを入れられる。
- スマホ幅は `<iframe src="/" style="width:390px">` に置き換えて見る。

## Architecture

- Vite + React + TS、Dexie（IndexedDB）、vite-plugin-pwa。サーバーなし。
- `src/domain/`：型（`types.ts`）、単位換算、原価計算（`cost.ts`）、履歴（`history.ts`）。画面に依存しない。
- `src/db/`：`db.ts`（スキーマと版。写真は別テーブル `photos`、キーは `menu:<id>` / `prep:<id>`）、`repo.ts`（保存のたびに影響するメニューの原価推移を記録）、`backup.ts`（書き出し・読み込み・検証）。
- `src/ui/`：`App.tsx` の state で4タブと画面の重なりを管理。シートは `Sheets.tsx`。
- 材料の参照は `i:<食材id>` / `p:<仕込み品id>`。仕込み品の入れ子は循環を防いでいる。
- **データの形を変えたら一緒に直す場所**：`types.ts` → `db.ts` に新しい `version(n)` と `upgrade()` → `backup.ts` の `version` と古い版の読み込み → テスト（`repo.test.ts` に版上げのテストあり）。今はデータベース版3・バックアップ版3（版2で `steps`、版3で `photos` を追加）。`repo.test.ts` に「全テーブルがバックアップに入っているか」のテストがある。

## ハマりどころ

- 作り方の入力欄は、離れたときに保存して空の手順を消す。新しい手順の欄に自動でフォーカスが移ったときに前の欄の「離れた」処理が走り、追加したばかりの空の手順まで消していた。`relatedTarget` が手順の中なら空の手順を残す。
- 写真は保存前に長い辺1200px・JPEG品質0.8に縮めて data URL で持つ（`src/ui/photo.ts`）。メニューの中に入れると、一覧を読むたびに全写真を読むので別テーブルにした。
- バックアップは写真を読むので時間がかかり、iPhone の共有シートが「押した直後」でないと開けない（`NotAllowedError`）。そのときはボタンを「押して保存する」に変えて2回目の操作で共有する（`ExportButton`）。
- ブラウザ確認でファイル選択は、canvas で作った画像を `DataTransfer` で `input.files` に入れ `change` を送ると試せる（ボタンを押すとファイル選択の窓が開いて操作できなくなる）。
- ホーム画面に追加済みのアイコンは自動では変わらず、削除して追加し直すとデータも消える（README 参照）。
