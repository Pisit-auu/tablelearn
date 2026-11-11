# Course Groups ("เลือก 1 จากกลุ่ม") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users group courses in the planner pool so generated plans contain exactly one course (one section) from each ticked group, skipping a group only when nothing in it can fit.

**Architecture:** Group data ops and the plan search become pure, tested modules in `app/planner/`. A group is "ticked" when its member codes are in the existing `plannerSelectedCodes`, so the existing section-pick logic (keyed on selected codes) and persistence keep working unchanged; groups only change how selected codes are partitioned into search slots. `generateSchedulePlans` in `app/page.tsx` delegates the search to the new solver.

**Tech Stack:** Next.js 16 / React 19 client component, plain CSS (`app/globals.css`), `node --test` with native TS stripping.

**Spec:** `docs/superpowers/specs/2026-11-11-course-groups-design.md`

## Global Constraints

- No new dependencies. All UI copy Thai. CSS tokens from DESIGN.md only.
- Group "นับเป็น 1 ช่องจากสูงสุด 7"; a course belongs to at most one group.
- Deleting a group or removing a course from a group never removes the course from the planner pool; it comes back unticked with no section picks.
- Planner behaviour with no groups must be identical to today (same plans, same counter text except wording below, same section-pick behaviour).
- Skip label copy (exact): `ข้ามกลุ่ม <ชื่อ>: ไม่มีวิชาที่ลงเวลาได้กับแผนนี้`. Group pick chip (exact): `<ชื่อกลุ่ม> → <ชื่อวิชา> S.<section>`. Group badge: `เลือก 1 วิชา`. Create button: `＋ สร้างกลุ่ม`. Default name: `กลุ่ม N` (N = smallest positive integer not used by an existing name of that form).
- Uncommitted change `app/globals.css` (mission panel anchored bottom-right) ships with this work — commit it in Task 1.

## Review Focus

1. **Two ticked groups competing for one time slot** — expect plans covering A and plans covering B, each labelled with the skipped group; never 0 plans. Test: Task 2 `competing groups`.
2. **A fitting group option beyond the per-slot cap** — prefilter against fixed courses first, cap after; expect it found. Test: Task 2 `option beyond cap`.
3. **Corrupt saved groups** (non-array, duplicate codes across groups, codes not in pool) — page loads, bad data dropped. Test: Task 1 `parseCourseGroups`.
4. **Group member already in the timetable, unlocked** — replaced by the plan's pick, never doubled. Covered by existing `lockedCourses` rule once members are in `plannerSelectedCodes`; verified in browser Task 4 Step 4.
5. **Mobile (≤900px)** "ย้ายเข้ากลุ่ม ▾" menu usable, closes on Esc/outside click, no horizontal scroll. Browser Task 4 Step 5.

---

### Task 1: Group data operations

**Files:**
- Create: `app/planner/course-groups.ts`, `app/planner/course-groups.test.ts`
- Modify: `package.json` test script → `node --test "app/onboarding/*.test.ts" "app/planner/*.test.ts"`
- Commit also: `app/globals.css` (pending mission-panel fix)

**Interfaces — Produces:**
```ts
export type CourseGroup = { id: string; name: string; codes: string[] };
export const maxGroupNameLength = 40;
export function nextGroupName(groups: CourseGroup[]): string;
export function parseCourseGroups(raw: unknown, poolCodes: ReadonlySet<string>): CourseGroup[];
export function moveCodeToGroup(groups: CourseGroup[], code: string, groupId: string | null): CourseGroup[]; // null = out of every group
export function renameGroup(groups: CourseGroup[], id: string, name: string): CourseGroup[]; // trimmed, sliced to max; empty → unchanged
export function removeGroup(groups: CourseGroup[], id: string): CourseGroup[];
export function pruneGroupCodes(groups: CourseGroup[], poolCodes: ReadonlySet<string>): CourseGroup[]; // keeps empty groups
export function groupOfCode(groups: CourseGroup[], code: string): CourseGroup | undefined;
export function countPlannerSlots(selectedCodes: string[], groups: CourseGroup[]): number; // singles + groups with ≥1 selected member
```

- [ ] **Step 1: Write failing tests:**
  - `nextGroupName([])` → `"กลุ่ม 1"`; with names `["กลุ่ม 1","กลุ่ม 3"]` → `"กลุ่ม 2"`
  - `moveCodeToGroup`: moving `"A"` from g1 to g2 leaves it only in g2; `null` removes it from all; unknown groupId → unchanged
  - `renameGroup`: `"  วิชาเลือก  "` → `"วิชาเลือก"`; `""` → old name kept; 60-char name → length 40
  - `parseCourseGroups`: `null`/`"x"`/`{}` → `[]`; drops entries without string id/name; drops codes not in pool; a code in two groups is kept only in the first; keeps a group whose codes became empty
  - `countPlannerSlots(["A","B","C"], [{codes:["B","C"]}])` → `2`; no groups → `3`
- [ ] **Step 2: Run** `npm test` — Expected: FAIL (module not found)
- [ ] **Step 3: Implement** `app/planner/course-groups.ts`.
- [ ] **Step 4: Run** `npm test && npx tsc --noEmit` — Expected: all pass, no type errors
- [ ] **Step 5: Commit** `feat(planner): course group data ops` (include `app/globals.css`, message body notes the mission panel fix)

### Task 2: Plan search with groups

**Files:**
- Create: `app/planner/solve-slots.ts`, `app/planner/solve-slots.test.ts`

**Interfaces — Produces:**
```ts
export type Slot<T> = { id: string; kind: "single" | "group"; options: T[]; cap?: number }; // cap overrides opts.perSlotCap
export type SlotSolution<T> = { picks: (T | null)[]; skipped: string[] }; // picks[i] for slots[i]; null only for skipped group slots; skipped = slot ids
export function solveSlots<T>(
  slots: Slot<T>[],
  fits: (chosen: T[]) => boolean,   // true when chosen options + fixed courses have no conflict
  opts: { perSlotCap: number; maxResults: number },
): SlotSolution<T>[];
```
Algorithm (decided here):
1. Prefilter: each slot's options → those with `fits([option])`; then slice to `slot.cap ?? perSlotCap`.
2. A single slot with 0 options after prefilter → return `[]` (same as today: no plan).
3. For `allowedSkips` = 0 … number of group slots: depth-first over slots in order; for each slot try its options (keeping `fits(chosenSoFar)`), and for group slots also try `null` while skips used < `allowedSkips`. Collect complete solutions until `maxResults`. Return the first `allowedSkips` level that yields ≥ 1 solution. (Guarantees max group coverage; competing groups yield both alternatives at the same level.)

- [ ] **Step 1: Write failing tests** (options are `{ id: string; day: string; t: number }`, `fits` = no two chosen share `day+t`):
  - `single slots only` — two singles with one compatible pair → 1 solution, `skipped: []`
  - `group picks exactly one` — group of 3 options, all fit → every solution has exactly one non-null pick for the group slot
  - `skip only when nothing fits` — group whose options all clash with a single's only option → solutions have `picks[g] === null` and `skipped` = `[g.id]`
  - `no skip when something fits` — group with one fitting option → no solution has null for it
  - `competing groups` — groups A and B each fit alone but clash together → result contains a solution covering A (B skipped) and one covering B (A skipped); none with both skipped
  - `option beyond cap` — group with 30 options where only index 29 fits, `perSlotCap: 12` → found
  - `maxResults` respected
  - `slot cap overrides default` — group slot with `cap: 24`, fitting option at index 20, `perSlotCap: 12` → found
- [ ] **Step 2: Run** `npm test` — Expected: FAIL
- [ ] **Step 3: Implement** `solve-slots.ts` per the algorithm.
- [ ] **Step 4: Run** `npm test` — Expected: PASS
- [ ] **Step 5: Commit** `feat(planner): slot solver with pick-one groups`

### Task 3: Wire groups into the planner state and generation

**Files:**
- Modify: `app/page.tsx` (SavedPlanner/readSavedPlanner ~425-470, planner state ~1014-1021, save effect ~1225-1240, handlers ~1919-2035, `generateSchedulePlans`, `GeneratedSchedulePlan` type ~91)
- Modify: `app/onboarding/help-copy.ts` (planner body: append ` วิชาที่ลงตัวไหนก็ได้ จับรวมเป็นกลุ่ม ระบบจะเลือกให้ 1 ตัวที่เวลาลงตัว`)

**Interfaces — Consumes:** Task 1 functions, Task 2 `solveSlots`. **Produces (for Task 4 UI):** state `plannerGroups: CourseGroup[]`; handlers `createPlannerGroup(withCode?: string): void`, `renamePlannerGroup(id, name)`, `deletePlannerGroup(id)`, `movePlannerCode(code, groupId | null)`, `togglePlannerGroup(id)`; `GeneratedSchedulePlan.groupNotes: { group: string; text: string; skipped: boolean }[]`.

Rules (from spec + its Claude's-call section):
- "Group ticked" ⇔ any member code in `plannerSelectedCodes`. `togglePlannerGroup`: if ticked → for each member remove from selected + `dropSectionPicks`; else add all members to selected. Disabled (no-op) for empty groups.
- `togglePlannerSection` / `selectAllPlannerSections` on a member: after their current effect, if the member became selected, add all other members of its group to selected (auto-tick group).
- `movePlannerCode(code, groupId)`: into a group → keep code's selection & picks; if code was selected or target group ticked, ensure all members of target group selected. Out (`null`) or via `deletePlannerGroup` → member codes removed from selected and picks dropped.
- `createPlannerGroup(code?)` → new group `nextGroupName`, id `crypto.randomUUID()`; with code → move it in.
- `removeFromPlanner` / `clearPlanner` / pool load → `pruneGroupCodes`; `clearPlanner` clears groups too.
- Persist `groups` in `SavedPlanner`; read with `parseCourseGroups(saved.groups, poolCodes)`.
- Counter text: `ติ๊กใช้สร้างแผน {countPlannerSlots(...)}/7`; the `> 7` guard in `generateSchedulePlans` uses the same count.
- Generation: build slots — each selected unlocked single → `kind:"single"`, options = `plannerClassesFor(group)`; each ticked group whose members are not locked in the table → `kind:"group"`, options = union of `plannerClassesFor` of members. A group with a locked member in the table is satisfied: no slot. `fits` = `!coursesHaveConflict([...lockedCourses, ...chosen.flatMap(toCourses)])`. Caps: `perSlotCap: 12` (today's value) for singles; group slots set `cap: 24`. `maxResults: 20`; sort by score, keep top 6 (unchanged).
- Score: each skipped group −15 and reason `ข้ามกลุ่ม <ชื่อ>: ไม่มีวิชาที่ลงเวลาได้กับแผนนี้`; `groupNotes` per ticked group: picked → `{ text: "<ชื่อกลุ่ม> → <coursename> S.<sectioncode>", skipped:false }`, skipped → skip text, `skipped:true`.
- Colors: keep today's palette indexing by slot index + option index.

- [ ] **Step 1:** Implement the state, persistence, handlers and generation changes above.
- [ ] **Step 2: Run** `npx tsc --noEmit && npm test` — Expected: clean, all pass (update `tours.test.ts`/help tests only if copy assertions break).
- [ ] **Step 3: Commit** `feat(planner): pick-one course groups in plan generation`

### Task 4: Group UI, styles, and browser verification

**Files:**
- Modify: `app/page.tsx` (planner pool list ~2995-3060, plan results ~3140-3160)
- Modify: `app/globals.css` (append `/* ---------- planner course groups ---------- */`)

Layout per the approved mockup `.superpowers/brainstorm/124314-1794378058/content/course-groups.html`:
- Ungrouped rows: unchanged plus a `ย้ายเข้ากลุ่ม ▾` button opening a small menu: existing groups, separator, `+ กลุ่มใหม่…` (creates group with this code). Menu closes on choose, Esc, outside pointerdown; on ≤900px it must stay inside the viewport.
- Group card (dashed `--primary` border, light tint): header = checkbox (togglePlannerGroup; disabled when empty), inline-editable name (input styled as text; Enter/blur commits via `renamePlannerGroup`, Esc reverts), badge `เลือก 1 วิชา`, `ลบกลุ่ม` (destructive link). Body = member rows without their own checkbox, each with `ดู section` (existing expand), `นำออก` (movePlannerCode(code, null)), `เอาออก` (removeFromPlanner). Empty group shows `ย้ายวิชาเข้ากลุ่มนี้ด้วยปุ่ม “ย้ายเข้ากลุ่ม”`.
- `＋ สร้างกลุ่ม` button after the list (when pool non-empty).
- Plan result: render `groupNotes` as chips under the plan name (`.chip-ok` tint / `.chip-skip` warning tint).
- Keep `data-tour="planner-pool"` on the bench; onboarding planner tour must still pass.

- [ ] **Step 1:** Implement markup + CSS.
- [ ] **Step 2: Run** `npx tsc --noEmit && npm test && npm run build` — Expected: all succeed.
- [ ] **Step 3: Browser (next start, 1440×900):** load real courses, add 4+ to pool; create group, rename it, move 3 courses in, tick group, generate → every plan has exactly one member + chip; delete group → members back, unticked, still in pool; reload page → groups persist.
- [ ] **Step 4: Browser:** put one group member in the timetable (unlocked), tick group, generate → plan contains exactly one member. Lock it → group satisfied, plan keeps the locked one and adds no other member.
- [ ] **Step 5: Browser 390×844:** move menu inside viewport, Esc closes, no horizontal scroll; group card readable.
- [ ] **Step 6: Browser:** onboarding planner tour still completes (steps 5–6 with a group present).
- [ ] **Step 7: Commit** `feat(planner): course group UI`
