import {describe, expect, it} from 'vitest'

import {dashboardContentRows, resolveDashboardLayout} from '@/tui/layout.js'

describe('dashboard layout', () => {
  it('uses both terminal dimensions to select compact, standard and wide layouts', () => {
    expect(resolveDashboardLayout({columns: 89, rows: 40})).toBe('compact')
    expect(resolveDashboardLayout({columns: 120, rows: 27})).toBe('compact')
    expect(resolveDashboardLayout({columns: 90, rows: 28})).toBe('standard')
    expect(resolveDashboardLayout({columns: 109, rows: 40})).toBe('standard')
    expect(resolveDashboardLayout({columns: 110, rows: 30})).toBe('wide')
  })

  it('never exposes a non-positive content viewport', () => {
    expect(dashboardContentRows(40)).toBe(31)
    expect(dashboardContentRows(9)).toBe(1)
    expect(dashboardContentRows(0)).toBe(1)
  })
})
