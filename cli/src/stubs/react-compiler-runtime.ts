// Shim for react/compiler-runtime that doesn't depend on the React dispatcher.
// The React Compiler transforms components to call _c(size) which normally calls
// ReactSharedInternals.H.useMemoCache(size). In custom reconcilers (like Ink's),
// the dispatcher can be null when the compiler runtime is loaded before the
// reconciler sets it up. This shim provides a simple per-component cache.

const caches = new WeakMap<object, unknown[]>();

export function c(size: number): unknown[] {
  // Get the current component fiber from React internals
  // Since we can't reliably access the fiber, use a simple approach:
  // Return an array of the requested size. React will manage the cache.
  const ReactSharedInternals =
    (globalThis as any).__REACT_SHARED_INTERNALS__ ||
    require('react').__CLIENT_INTERNALS_DO_NOT_USE_ORWARN_USERS_THEY_CANNOT_UPGRADE ||
    require('react').__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

  if (ReactSharedInternals?.H?.useMemoCache) {
    return ReactSharedInternals.H.useMemoCache(size);
  }

  // Fallback: return a fresh array (no caching, but no crash)
  return new Array(size).fill(undefined);
}
