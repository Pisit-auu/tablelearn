# Onboarding Missions, Guided Tours and Help Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-visit mission panel (5 missions), do-it-for-real guided tours with spotlight/pulse/pointing hand, and a `?` help popover on each of the 8 page sections.

**Architecture:** Tour behaviour is pure data + pure functions in `app/onboarding/` (tested with Node's built-in test runner). Each tour step is either an `action` step (done when a predicate over a `TourSnapshot` of page state is true) or an `info` step (done when acknowledged); the current step is always the first unfinished one, which gives "rewind when the user strays" for free. Mission completion is event-driven: existing handlers in `app/page.tsx` call `completeMission(id)`. React components (overlay, panel, help popover) read targets via `data-tour="…"` attributes.

**Tech Stack:** Next.js 16 App Router (client component), React 19, plain CSS in `app/globals.css`, Node 22 `node --test` with native type stripping for logic tests, Playwright MCP for in-browser verification.

**Spec:** `docs/superpowers/specs/2026-11-11-onboarding-tour-design.md`

## Global Constraints

- Read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code (AGENTS.md). This feature is client-only React; no new routes.
- No new runtime dependencies; no tour library (driver.js/shepherd etc.).
- All CSS goes in `app/globals.css` using existing tokens (`--primary`, `--primary-tint`, `--heading`, `--ink`, `--line`, `--surface`, radii from DESIGN.md). No literal colours outside DESIGN.md.
- All UI copy in Thai, exactly as given in this plan / the spec.
- Progress lives in `localStorage` only; every read/write wrapped in try/catch.
- `prefers-reduced-motion: reduce` → no pulse ring, no hand animation, `scrollIntoView` uses `behavior: "auto"`.
- Accessibility: coach card is `role="dialog"` with `aria-live="polite"` body; `?` buttons have `aria-label="วิธีใช้ส่วน<ชื่อส่วน>"`; Esc closes popover / skips tour.
- Do not change existing feature behaviour (rooms, compare defaults, planner) — only add hooks/attributes.

## Review Focus

1. **Mobile (≤900px) bottom dock** — `.rail-nav` is `position: fixed; bottom: 0; z-index: 40`. Coach card, mission bottom sheet and launcher must sit above it (z-index > 40 and bottom offset ≥ dock height) and never cover the spotlit target. Test: Task 6 Step 4 (390×844 viewport).
2. **Target not in DOM / folded / off-screen** — e.g. section folded via `data-folded`, dialog closed, first result card not rendered yet. Expected: overlay unfolds the zone (`unfoldZone`), scrolls the target into view, and if still missing shows the card centred without a spotlight instead of crashing. Test: Task 2 `resolveStep` cases + Task 6 Step 5.
3. **localStorage blocked/corrupt** — private mode or garbage JSON. Expected: app renders with `defaultProgress` and never throws; if writes are blocked the panel may auto-open on every visit (accepted — nothing can be remembered). Test: Task 1 `parseProgress` cases.
4. **Spotlight must not block clicks** on the target or on other controls needed by multi-control steps (filters, several result cards, checkboxes). Test: Task 3 Step 4 (click through overlay).
5. **Arriving via `?room=` on first visit** — panel must not auto-open, and `panelSeen` stays false. Test: Task 1 `shouldAutoOpen` cases.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/onboarding/progress.ts` (create) | Progress type, parse/serialize, `shouldAutoOpen`, `markMission` |
| `app/onboarding/tour-engine.ts` (create) | Step/Tour types, `TourSnapshot`, `resolveStep` |
| `app/onboarding/tours.ts` (create) | The 5 tour definitions + mission list (Thai copy, targets, predicates) |
| `app/onboarding/help-copy.ts` (create) | `?` copy for the 8 zones |
| `app/onboarding/*.test.ts` (create) | Node test files |
| `app/onboarding/TourOverlay.tsx` (create) | Spotlight, pulse ring, hand, coach card |
| `app/onboarding/MissionPanel.tsx` (create) | Panel / bottom sheet + collapsed launcher |
| `app/onboarding/HelpButton.tsx` (create) | `?` button + popover |
| `app/onboarding/useOnboarding.ts` (create) | Hook: progress state, active tour, completeMission, start/skip |
| `app/page.tsx` (modify) | `data-tour` attributes, snapshot, mission hooks in handlers, render components |
| `app/globals.css` (modify) | Styles for all of the above |
| `tsconfig.json`, `package.json` (modify) | `allowImportingTsExtensions`, `test` script |

---

### Task 1: Progress storage and first-visit rule

**Files:**
- Modify: `tsconfig.json` (add `"allowImportingTsExtensions": true` to `compilerOptions`; valid because `noEmit` is already true)
- Modify: `package.json` scripts: `"test": "node --test app/onboarding/"`
- Create: `app/onboarding/progress.ts`
- Test: `app/onboarding/progress.test.ts`

**Interfaces:**
- Produces:
  - `type MissionId = "tour" | "planner" | "lock" | "compare" | "room"`
  - `type OnboardingProgress = { version: 1; panelSeen: boolean; done: MissionId[] }`
  - `const progressStorageKey = "tablelearn-onboarding"`
  - `const defaultProgress: OnboardingProgress` (= `{ version: 1, panelSeen: false, done: [] }`)
  - `parseProgress(raw: string | null): OnboardingProgress`
  - `markMission(p: OnboardingProgress, id: MissionId): OnboardingProgress` (idempotent, returns same object if already done)
  - `shouldAutoOpen(p: OnboardingProgress, hasRoomParam: boolean): boolean`

- [ ] **Step 1: Write failing tests** in `progress.test.ts` (import from `"./progress.ts"`, use `node:test` + `node:assert/strict`):
  - `parseProgress(null)` deep-equals `defaultProgress`
  - `parseProgress("{bad")` deep-equals `defaultProgress`
  - `parseProgress('{"version":1,"panelSeen":true,"done":["planner","nope"]}')` → `{ version:1, panelSeen:true, done:["planner"] }` (unknown ids dropped)
  - `parseProgress('{"version":2}')` → `defaultProgress`
  - `markMission(defaultProgress,"lock").done` equals `["lock"]`; calling again returns the identical object (`===`)
  - `shouldAutoOpen(defaultProgress,false) === true`; `shouldAutoOpen(defaultProgress,true) === false`; `shouldAutoOpen({...defaultProgress,panelSeen:true},false) === false`
- [ ] **Step 2: Run** `npm test` — Expected: FAIL (module not found)
- [ ] **Step 3: Implement** `app/onboarding/progress.ts` with the interfaces above.
- [ ] **Step 4: Run** `npm test` — Expected: all pass. Also `npx tsc --noEmit` — Expected: no errors.
- [ ] **Step 5: Commit** `feat(onboarding): progress storage and first-visit rule`

### Task 2: Tour engine

**Files:**
- Create: `app/onboarding/tour-engine.ts`
- Test: `app/onboarding/tour-engine.test.ts`

**Interfaces:**
- Consumes: `MissionId` from `progress.ts`
- Produces:
  ```ts
  type TourSnapshot = {
    canEdit: boolean; browserOpen: boolean; searchResultCount: number;
    plannerPoolCount: number; generatedPlanCount: number; courseCount: number;
    planCount: number; inRoom: boolean; done: MissionId[];
  };
  type TourStep = {
    id: string; title: string; body: string;
    targets: string[];            // data-tour names; spotlight = union rect; [] = centred card
    zone?: string;                // section id to unfold + scroll to before showing
  } & ({ kind: "action"; isDone: (s: TourSnapshot) => boolean }
     | { kind: "info"; nextLabel: string });
  type Tour = { mission: MissionId; requiresEdit: boolean; steps: TourStep[] };
  resolveStep(tour: Tour, s: TourSnapshot, acked: ReadonlySet<string>): number  // -1 = finished
  ```
  Rule: index of the first step where (`action` && !isDone(s)) || (`info` && !acked.has(step.id)); -1 if none.

- [ ] **Step 1: Write failing tests** using a 3-step fixture tour (action A done when `plannerPoolCount>=2`, info B, action C done when `done` includes `"planner"`):
  - empty snapshot → `0`
  - pool=2, acked=∅ → `1`
  - pool=2, acked={B} → `2`
  - pool=2, acked={B}, done=["planner"] → `-1`
  - rewind: pool=1, acked={B}, done=[] → `0`
- [ ] **Step 2: Run** `npm test` — Expected: FAIL
- [ ] **Step 3: Implement** `tour-engine.ts`.
- [ ] **Step 4: Run** `npm test` — Expected: PASS
- [ ] **Step 5: Commit** `feat(onboarding): tour step resolver`

### Task 3: Tour definitions, mission list, help copy

**Files:**
- Create: `app/onboarding/tours.ts`, `app/onboarding/help-copy.ts`
- Test: `app/onboarding/tours.test.ts`

**Interfaces:**
- Consumes: `Tour`, `TourSnapshot` (Task 2), `MissionId` (Task 1)
- Produces:
  - `missions: { id: MissionId; label: string; icon: "map" | "crane" | "lock" | "compare" | "people" }[]` in order with labels: `รู้จักหน้าเว็บ`, `จัดแผนด้วยตัวช่วยจัดแผน`, `ล็อกวิชาที่ต้องได้`, `เทียบ 2 แผน`, `ชวนเพื่อนเข้าห้อง`
  - `tours: Record<MissionId, Tour>`
  - `helpCopy: Record<"face"|"blocks"|"planner"|"compare"|"voids"|"exams"|"room"|"feedback", { title: string; body: string; tour?: MissionId }>` — bodies copied verbatim from the spec's "ปุ่ม ?" section; `tour` set for planner→`planner`, compare→`compare`, room→`room`.

Tours (targets are `data-tour` names added in Task 5; titles/bodies from the spec tables, adapt only for brevity):

| mission | requiresEdit | steps (kind · targets · zone · done rule) |
|---|---|---|
| `tour` | false | info `timetable` zone face "ตารางของคุณ…" · info `fetch-courses` · info `planner-head` zone planner · info `zone-nav` (last `nextLabel: "เสร็จแล้ว"`) |
| `planner` | true | 1 action `fetch-courses`: `browserOpen \|\| pool>=2` · 2 action `course-search`: `results>0 \|\| pool>=2` · 3 action `add-to-planner`: `pool>=2` · 4 action `browser-close`: `!browserOpen && pool>=2` · 5 action `planner-pool`,`planner-generate` zone planner: `generated>0 && !browserOpen` · 6 action `apply-plan`: `done.includes("planner")` · 7 info `timetable` zone face "เสร็จแล้ว! ตารางใหม่อยู่ตรงนี้" `nextLabel:"เยี่ยม"` |
| `lock` | true | 0 info `blocks-empty` zone blocks "ต้องมีวิชาในตารางก่อน" — included only when `courseCount===0`: model as action with `isDone: s => s.courseCount>0` whose card offers "เริ่มภารกิจจัดแผน" · 1 action `lock-first` zone blocks: `done.includes("lock")` |
| `compare` | true | 1 action `add-plan` zone face: `planCount>=2` · 2 action `compare-pickers` zone compare: `done.includes("compare")` |
| `room` | false | 1 info `room-create`,`room-join` zone room, body = spec warning "ห้องใหม่จะเริ่มจากตารางว่าง ตารางส่วนตัวของคุณยังอยู่ในเครื่อง กด 'ออกจากห้อง' เมื่อไหร่ก็กลับมาเจอ" `nextLabel:"เข้าใจแล้ว"` · 2 action same targets: `inRoom` · 3 info `room-code`,`room-leave` "ส่งรหัสนี้ให้เพื่อน… กลับตารางส่วนตัวได้ที่ 'ออกจากห้อง'" `nextLabel:"เสร็จแล้ว"` |

Mission `tour` is marked done by the hook when its tour resolves to -1 (Task 4). Mission `room` is marked done by the room handlers (Task 5), the tour continues to step 3.

- [ ] **Step 1: Write failing tests:**
  - `missions.map(m=>m.id)` deep-equals `["tour","planner","lock","compare","room"]`
  - planner tour: snapshot pool=3, browserOpen=false, generated=0 → `resolveStep` returns index of step id `"generate"` (spec: "ถ้าคลังมีวิชาอยู่แล้วตอนเริ่ม ให้เริ่มที่ขั้น 5")
  - planner tour: browserOpen=false, pool=1 → index 0 (closed early → rewind)
  - planner tour: browserOpen=true, results=5, pool=1 → index of `"add"`
  - every step's `targets` ⊆ the set `allTourTargets` exported from `tours.ts` (guards typos against Task 5)
  - `Object.keys(helpCopy).length === 8`
- [ ] **Step 2: Run** `npm test` — Expected: FAIL
- [ ] **Step 3: Implement** `tours.ts` (export `allTourTargets: readonly string[]`) and `help-copy.ts`.
- [ ] **Step 4: Run** `npm test` — Expected: PASS
- [ ] **Step 5: Commit** `feat(onboarding): tour definitions and help copy`

### Task 4: `useOnboarding` hook and UI components

**Files:**
- Create: `app/onboarding/useOnboarding.ts`, `TourOverlay.tsx`, `MissionPanel.tsx`, `HelpButton.tsx` (all `"use client"`)
- Modify: `app/globals.css` (append an `/* ---------- onboarding ---------- */` section)

**Interfaces:**
- Consumes: Tasks 1–3
- Produces:
  ```ts
  useOnboarding(snapshot: TourSnapshot, opts: { hasRoomParam: boolean; onUnfoldZone: (zoneId: string) => void }): {
    progress: OnboardingProgress;
    panelOpen: boolean; setPanelOpen(open: boolean): void;
    activeTour: MissionId | null;
    startTour(id: MissionId): void;      // if tours[id].requiresEdit && !snapshot.canEdit → sets notice "ห้องนี้เป็นโหมดดูอย่างเดียว จึงเริ่มบทพาทำนี้ไม่ได้" instead
    skipTour(): void;
    ackStep(stepId: string): void;
    completeMission(id: MissionId): void;
    notice: string | null;
  }
  <TourOverlay tour={Tour} stepIndex={number} snapshot onAck onSkip onStartTour />
  <MissionPanel progress open onOpenChange onStart notice />
  <HelpButton zone={keyof typeof helpCopy} onStartTour={(id: MissionId) => void} />
  ```

Behaviour decisions:
- Hook loads progress in `useEffect` (avoid hydration mismatch), auto-opens panel once via `shouldAutoOpen`, then persists `panelSeen: true`. Opening the panel does NOT complete any mission.
- Hook computes `stepIndex = resolveStep(...)` each render; when it becomes -1 the tour closes, and if `activeTour === "tour"` calls `completeMission("tour")`. Acked set resets on `startTour`.
- When the current step has `zone`, call `onUnfoldZone(zone)` once per step change.
- Overlay: find elements via `document.querySelectorAll('[data-tour="<name>"]')`, take the first visible one per name, union their `getBoundingClientRect()`; recompute on `scroll` (capture), `resize`, and a `ResizeObserver` + `requestAnimationFrame` throttle. `scrollIntoView({ block: "center" })` on step change. Spotlight = a `position: fixed` box at the rect with `box-shadow: 0 0 0 9999px <dim>` and `pointer-events: none`; the overlay root is `pointer-events: none` so clicks pass through (Review Focus 4); only the coach card is `pointer-events: auto`. Missing target → centred card, no spotlight.
- Coach card: `ขั้นที่ X จาก N`, title, body, dot row, "ข้ามบทเรียน" button; for `action` steps a line "● รอคุณทำขั้นนี้…"; for `info` steps a primary button with `nextLabel`. Placed beside the rect on desktop (flip to fit viewport), fixed at bottom above the dock on ≤900px. Esc → `onSkip`.
- Pulse ring + 👆 hand (inline SVG or emoji) positioned at the rect; disabled under reduced motion.
- When a mission completes, panel item shows tag "สำเร็จแล้ว"; launcher shows `x/5`.
- Panel desktop: fixed top-right card 320px; mobile: bottom sheet above the dock. Title `ภารกิจเริ่มต้นใช้งาน`, sub `คุณทำภารกิจสำเร็จไปแล้ว x/5`, progress bar, 5 rows, close (×). Collapsed launcher: fixed bottom-right button (above dock on mobile) "ภารกิจ x/5", hidden when 5/5 done and panel closed.
- HelpButton: 22px round `?` after the zone `h1/h2`; popover (non-modal, closes on outside click/Esc) shows `body` and, if `tour`, a link button "พาทำให้ดู".

- [ ] **Step 1:** Read `node_modules/next/dist/docs/01-app` sections on client components to confirm `"use client"` usage in Next 16.
- [ ] **Step 2:** Implement the four files and CSS.
- [ ] **Step 3: Run** `npx tsc --noEmit && npm run lint && npm test` — Expected: all clean.
- [ ] **Step 4: Commit** `feat(onboarding): overlay, mission panel, help button`

### Task 5: Wire into `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: Task 4 hook/components; `allTourTargets` (Task 3)

- [ ] **Step 1: Add `data-tour` attributes** (names must match `allTourTargets` exactly):
  - `fetch-courses` → `.rail-cta` button (~line 2661)
  - `zone-nav` → `.rail-nav`
  - `timetable` → `.grid-scroll` / `.day-list` wrapper in `#face`
  - `add-plan` → "เพิ่มตาราง" button
  - `blocks-empty` → empty message in `#blocks`; `lock-first` → first course's ล็อก/ปลดล็อก button only (index 0)
  - `planner-head` → `#planner .zone-head`; `planner-generate` → "สร้างแผนที่เป็นไปได้"; `planner-pool` → first `.bench` (pool list); `apply-plan` → first "ใช้แผนนี้" only
  - `compare-pickers` → `.compare-bar`
  - `room-create`, `room-join` (form), `room-code` (copy-code button), `room-leave` ("ออกจากห้อง")
  - Course browser dialog: `course-search` → `.filter-grid` and `.dialog-run` (both get it; union), `add-to-planner` → first result's "เลือกเข้าตัวช่วยจัดแผน" button only, `browser-close` → dialog close button
- [ ] **Step 2: Build the snapshot** with `useMemo`: `canEdit: canEditActivePlan`, `browserOpen: isCourseBrowserOpen`, `searchResultCount: filteredRemoteClasses.length`, `plannerPoolCount: plannerPool.length`, `generatedPlanCount: generatedPlans.length`, `courseCount: courses.length`, `planCount: visiblePlans.length`, `inRoom: Boolean(shareSession)`, `done: progress.done`. Call `useOnboarding(snapshot, { hasRoomParam: <read once from location.search in effect>, onUnfoldZone: unfoldZone })`.
- [ ] **Step 3: Mission hooks — user actions only** (spec "นับสำเร็จจากการกระทำของผู้ใช้เท่านั้น"):
  - `applyGeneratedPlan` end → `completeMission("planner")`
  - `toggleCourseLocked` → `completeMission("lock")` only when the toggle results in `locked: true`
  - compare A/B `onChange` handlers → `completeMission("compare")` when the new A id ≠ effective B id (and vice versa)
  - `createSharedRoom` after success, `enterSharedRoom` after `loadSharedPlan` succeeds (view-only counts) → `completeMission("room")`
  - Do NOT hook polling/sync code paths.
- [ ] **Step 4: Render** `<HelpButton zone=…>` inside each of the 8 `.zone-head` headings; `<MissionPanel>` and `<TourOverlay>` (when `activeTour` and `stepIndex >= 0`) at the end of the root element.
- [ ] **Step 5: Run** `npx tsc --noEmit && npm run lint && npm test && npm run build` — Expected: all succeed.
- [ ] **Step 6: Commit** `feat(onboarding): wire missions, tours and help into the page`

### Task 6: In-browser verification

Run `npm run dev` (port 3005) and use Playwright MCP. Clear `localStorage` before each scenario.

- [ ] **Step 1: First visit** at 1440×900 — panel opens by itself with 0/5; reload → panel closed, launcher shows "ภารกิจ 0/5". Open `/?room=XXXXXX` with cleared storage → panel does not open.
- [ ] **Step 2: Planner tour end-to-end** — start mission 2, follow every step with real clicks (open browser, search a real faculty, add 2 courses, close, tick, generate, apply). Each step advances only after the action; at the end mission 2 shows "สำเร็จแล้ว". Screenshot steps 1, 3, 5.
- [ ] **Step 3: Rewind** — during step 3 close the dialog with 1 course added → card returns to step 1.
- [ ] **Step 4: Mobile** 390×844 — coach card and bottom sheet sit above the bottom dock, spotlit target visible, no horizontal scroll.
- [ ] **Step 5: Folded zone** — fold `#planner`, start mission 2 with ≥2 pooled courses → zone unfolds and scrolls into view.
- [ ] **Step 6: Help buttons** — each of 8 `?` opens its copy; "พาทำให้ดู" on planner starts mission 2; Esc closes.
- [ ] **Step 7: Reduced motion** — emulate `prefers-reduced-motion: reduce` → no pulse/hand animation.
- [ ] **Step 8: Room tour** — mission 5 shows the empty-room warning before creating; after create, mission ticks and step 3 points at room code and "ออกจากห้อง"; leaving restores the private table.
- [ ] **Step 9:** Fix anything found, re-run checks, commit `fix(onboarding): …` if needed.
