import { describe, expect, it } from 'vitest'
import { dropIndex, moveIndex } from './sort'

describe('並べ替え', () => {
  it('from 番目を to 番目へ動かす', () => {
    expect(moveIndex(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveIndex(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    expect(moveIndex(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
  it('つかんだ行の中心が他の行の中心を越えたらその位置に落とす', () => {
    const mids = [25, 75, 125, 175] // 高さ50の行が4つ
    expect(dropIndex(0, 25, mids)).toBe(0)
    expect(dropIndex(0, 80, mids)).toBe(1)
    expect(dropIndex(0, 180, mids)).toBe(3)
    expect(dropIndex(3, 120, mids)).toBe(2)
    expect(dropIndex(3, 0, mids)).toBe(0)
  })
})
