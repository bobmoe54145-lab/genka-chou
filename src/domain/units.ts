import type { BaseUnit, PackUnit } from './types'

/** 仕入れ単位 → [最小単位, 倍率] */
export const BASE: Record<PackUnit, [BaseUnit, number]> = {
  kg: ['g', 1000],
  g: ['g', 1],
  L: ['ml', 1000],
  ml: ['ml', 1],
  '個': ['個', 1],
}

export const PACK_UNITS = Object.keys(BASE) as PackUnit[]
export const BASE_UNITS: BaseUnit[] = ['g', 'ml', '個']

export const baseUnitOf = (u: PackUnit): BaseUnit => BASE[u][0]
export const toBase = (amount: number, u: PackUnit): number => amount * BASE[u][1]
