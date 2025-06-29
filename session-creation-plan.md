# Simplified Plan: Support New Sessions in SessionViewer

## Current Complex Approach
- Separate CreateSession component
- Complex redirect logic
- Timing issues with streaming vs navigation
- Two different components to maintain

## Simpler Approach: SessionViewer with "new" mode

### 1. URL Structure
- Keep: `/project/{sessionId}` for existing sessions
- Add: `/project/new` for new sessions
- SessionViewer handles both cases

### 2. SessionViewer Changes
- Detect when `sessionId === "new"`
- In "new" mode:
  - Show empty session UI (no messages)
  - Show "New Session" as initial title
  - When first message is sent:
    - Create session via API
    - Update URL to real session ID
    - Continue normal flow
- Everything else stays the same (streaming, title updates, etc.)

### 3. Remove Complexity
- Delete CreateSession component entirely
- Delete messaging.ts utilities (use existing SessionViewer logic)
- Simplify create-session.astro to just redirect to `/project/new`

### 4. Implementation Steps
1. Update `/project/create-session` route to redirect to `/project/new`
2. Update SessionViewer to handle `sessionId === "new"` case
3. When in new mode, create session on first message send
4. Use `history.replaceState` to update URL after session creation
5. Remove all the complex CreateSession infrastructure

## Benefits
- ✅ Single component handles both new and existing sessions
- ✅ No complex redirect timing issues
- ✅ Streaming works normally (no page changes)
- ✅ Title updates work normally (single session watcher)
- ✅ Much less code to maintain
- ✅ Consistent UI/UX between new and existing sessions

## Files to Change
- Update `packages/web/src/pages/project/create-session.astro` → simple redirect
- Update `packages/web/src/components/SessionViewer.tsx` → handle "new" mode
- Delete `packages/web/src/components/CreateSession.tsx`
- Delete `packages/web/src/lib/messaging.ts`

## Result
This approach treats "new" as just another session ID that SessionViewer knows how to handle specially.