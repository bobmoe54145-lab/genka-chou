import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// アイコンの元画像は assets/icon.png（assets/make-icon.mjs で作る）。
// iPhone のホーム画面用は余白を付けず、絵をいっぱいに表示する。余白が要るものはクリーム色で埋める。
const cream = '#FCF2D6'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: { sizes: [180], padding: 0, resizeOptions: { background: cream, fit: 'contain' } },
    maskable: { sizes: [512], padding: 0.1, resizeOptions: { background: cream, fit: 'contain' } },
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
  },
  images: ['assets/icon.png'],
})
