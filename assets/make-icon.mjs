// 元のイラスト（assets/icon-original.png）から、アイコン用の正方形画像（assets/icon.png）を作る。
// 外側の白い余白を切り取り、角の丸みで残る白い部分をクリーム色で塗りつぶす。
// 使い方：node assets/make-icon.mjs
import sharp from 'sharp'

const SRC = 'assets/icon-original.png'
const OUT = 'assets/icon.png'
const CREAM = [252, 242, 214]

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H } = info
const at = (x, y) => (y * W + x) * 3
// 背景の白（余白）かどうか。クリーム色は青が214前後なので、青が225を超えれば白とみなす
const isWhite = (x, y) => data[at(x, y) + 2] > 225

// 中央の行・列で、白い余白が終わる位置を探してクリーム色の四角の範囲を決める
const mid = Math.floor(H / 2)
let left = 0; while (isWhite(left, mid)) left++
let right = W - 1; while (isWhite(right, mid)) right--
let top = 0; while (isWhite(mid, top)) top++
let bottom = H - 1; while (isWhite(mid, bottom)) bottom--
const size = Math.min(right - left, bottom - top) + 1
console.log({ left, right, top, bottom, size })

// 四隅から白い部分をたどってクリーム色にする（絵の中の白いコック帽は線で囲まれているので届かない）
const seen = new Uint8Array(W * H)
const stack = [[left, top], [left + size - 1, top], [left, top + size - 1], [left + size - 1, top + size - 1]]
while (stack.length) {
  const [x, y] = stack.pop()
  if (x < left || y < top || x >= left + size || y >= top + size) continue
  const k = y * W + x
  if (seen[k] || !isWhite(x, y)) continue
  seen[k] = 1
  data.set(CREAM, at(x, y))
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
}

await sharp(data, { raw: { width: W, height: H, channels: 3 } })
  .extract({ left, top, width: size, height: size })
  .resize(1024, 1024)
  .png()
  .toFile(OUT)
console.log('wrote', OUT)
