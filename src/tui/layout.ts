export type DashboardLayout = 'compact' | 'standard' | 'wide'

export interface DashboardViewport {
  readonly columns: number
  readonly rows: number
}

export function resolveDashboardLayout({columns, rows}: DashboardViewport): DashboardLayout {
  if (columns < 90 || rows < 28) {
    return 'compact'
  }

  if (columns >= 110 && rows >= 30) {
    return 'wide'
  }

  return 'standard'
}

/**
 * Rows left after the outer border, two-line header, breadcrumb and footer.
 * Keeping this calculation alongside the breakpoints lets screens size logs
 * and tables without knowing how the dashboard shell is assembled.
 */
export function dashboardContentRows(rows: number): number {
  return Math.max(1, rows - 9)
}
