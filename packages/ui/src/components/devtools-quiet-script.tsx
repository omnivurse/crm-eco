import { DEVTOOLS_QUIET_SCRIPT } from '../lib/devtools-quiet';

/** First tag in <head> on production builds. No-op in development. */
export function DevtoolsQuietScript() {
  if (process.env.NODE_ENV !== 'production') return null;
  return <script dangerouslySetInnerHTML={{ __html: DEVTOOLS_QUIET_SCRIPT }} />;
}
