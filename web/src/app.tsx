import { SessionGate } from './shell/session-gate'

/**
 * The console's entry point, and deliberately nothing else.
 *
 * This file was two and a half thousand lines: the shell, the router, fourteen
 * screens, five data hooks, and every formatting helper in the product. What
 * lives where is now decided by directory — `data/` reads, `lib/` computes,
 * `navigation/` names, `components/` composes the kit, `screens/` draws, and
 * `shell/` holds the three of them together.
 */
export function App() {
  return <SessionGate />
}
