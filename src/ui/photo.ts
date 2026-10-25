/** 保存する写真の長い辺（ピクセル） */
const MAX_SIDE = 1200
const QUALITY = 0.8

async function loadImage(file: File): Promise<{ img: CanvasImageSource; w: number; h: number; done: () => void }> {
  // createImageBitmap は写真の向き（縦横）の情報も反映して読み込む
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { img: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close() }
    } catch {
      // 読めない形式のときは下の方法を試す
    }
  }
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.src = url
  await img.decode()
  return { img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) }
}

/** 写真を長い辺1200ピクセルのJPEGに縮め、data URL で返す。写真は切り取らない */
export async function shrinkPhoto(file: File): Promise<string> {
  const { img, w, h, done } = await loadImage(file)
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const g = canvas.getContext('2d')
    if (!g) throw new Error('canvas')
    g.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', QUALITY)
  } finally {
    done()
  }
}
