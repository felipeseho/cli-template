// The current termcn Ink registry names this primitive `Log`. The application
// exposes the product-facing `LogPanel` name from the MVP vocabulary while
// keeping the vendored registry component straightforward to update.
export {Log as LogPanel} from '@/tui/components/ui/log.js'
export type {LogEntry, LogProps as LogPanelProps} from '@/tui/components/ui/log.js'
