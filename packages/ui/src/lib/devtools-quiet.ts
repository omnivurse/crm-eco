/**
 * Production browser quieting. Runs in <head> before React.
 * Does not disable DevTools, block inspect, or use debugger traps.
 */

export const DEVTOOLS_QUIET_SCRIPT = `(function(){try{var c=window.console;if(c){var n=function(){};c.log=n;c.info=n;c.debug=n;c.warn=n;c.error=n;c.trace=n;c.dir=n;c.table=n;c.group=n;c.groupCollapsed=n;c.groupEnd=n;}var h=window.__REACT_DEVTOOLS_GLOBAL_HOOK__;if(h){h.inject=function(){};h.onCommitFiberRoot=function(){};h.onCommitFiberUnmount=function(){};h.supportsFiber=false;}else{Object.defineProperty(window,"__REACT_DEVTOOLS_GLOBAL_HOOK__",{value:{isDisabled:true,inject:function(){},supportsFiber:false},configurable:false});}}catch(e){}})();`;

const LEAK_MARKERS = [
  'crm-eco',
  'crm-core',
  'double helix',
  'doublehelix',
  'supabase',
  'next.js',
  'pin',
  'lock',
];

export function devtoolsQuietScriptIsNeutral(source = DEVTOOLS_QUIET_SCRIPT): boolean {
  const lower = source.toLowerCase();
  return !LEAK_MARKERS.some((marker) => lower.includes(marker));
}
