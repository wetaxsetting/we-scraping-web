# frontend/state-management/

State-management design for `wecms-web`.

## Purpose

Document the layered state model: server cache (TanStack Query), URL state (search params), session / auth state, and the small footprint of client-only stores (Zustand / React state).

## What goes here

- Cache-key hierarchy & invalidation rules
- URL-state conventions (search-param naming, debounce policy, pagination shape)
- Auth / session store layout
- When to lift state to a global store vs keep it route-local

## What does NOT go here

- Hook-specific cache details → [`../hooks/`](../hooks/)
- Component-internal `useState` patterns → [`../components/`](../components/)
