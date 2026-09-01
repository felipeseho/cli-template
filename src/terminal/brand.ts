export const brandColors = {
  accent: '#22D3EE',
  mutedForeground: '#94A3B8',
  primary: '#8B5CF6',
} as const

export const brandSymbols = {
  breadcrumb: {
    ascii: '>',
    unicode: '›',
  },
  mark: {
    ascii: '<>',
    unicode: '◆',
  },
} as const

export type BrandSymbol = keyof typeof brandSymbols

export function resolveBrandSymbol(symbol: BrandSymbol, unicode: boolean): string {
  const variants = brandSymbols[symbol]
  return unicode ? variants.unicode : variants.ascii
}
