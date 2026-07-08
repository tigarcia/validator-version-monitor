# Unstaked Nodes Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Unstaked Nodes" toggle that switches the version filter panel to show per-version node counts for gossip nodes that are not staked validators, sourced from `data/gossip.json`.

**Architecture:** The server component `src/app/page.tsx` reads `data/gossip.json`, filters out identities present in `data/validators.json`, and reduces the rest to a compact `Record<string, number>` version-count map passed as a prop. The client component `src/components/ValidatorTable.tsx` gains a toggle that switches the existing version panel between the current stake-% view (with filter checkboxes) and a read-only node-count view. The hourly GitHub Actions workflow additionally regenerates `data/gossip.json`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS 4. No test framework exists in this repo — verification is `npm run lint`, `npm run build`, a node one-liner for data correctness, and manual dev-server checks (this matches the spec's Testing section).

**Spec:** `docs/superpowers/specs/2026-07-07-unstaked-nodes-toggle-design.md`

## Global Constraints

- "Unstaked node" = entry in `data/gossip.json` whose `identityPubkey` is NOT in `data/validators.json`.
- Gossip entries without a `version` field count as `"unknown"`.
- Missing/unreadable/malformed `data/gossip.json` must degrade gracefully to an empty counts map (no crash).
- The main validator table, sorting, SFDP filter, infrastructure filters, CSV export, and `/api/validators` are NOT changed.
- URL param for the toggle is exactly `unstaked=1`, following the existing `URLSearchParams` + `window.history.replaceState()` pattern.
- Path alias `@/*` maps to `./src/*`, but the files touched here use relative imports (`../types/validator`) — follow the existing style of each file.
- Do not manually edit `data/validators.json` or `data/gossip.json`.

---

### Task 1: Server-side unstaked version counts in `page.tsx`

**Files:**
- Modify: `src/app/page.tsx` (add gossip read + aggregation after the validators/API loading block, pass new prop at line ~120)
- Modify: `src/components/ValidatorTable.tsx:11` (accept the new prop so the build stays green; rendering comes in Task 2)

**Interfaces:**
- Consumes: `data/gossip.json` — JSON array of objects shaped like `{ identityPubkey: string; version?: string; ipAddress: string; gossipPort: number; ... }`.
- Produces: `ValidatorTable` prop `unstakedVersionCounts: Record<string, number>` — keys are raw version strings (or `"unknown"`), values are node counts. Task 2 renders from this prop.

- [ ] **Step 1: Establish the expected counts (data sanity check)**

Run from the repo root:

```bash
node -e "
const g = require('./data/gossip.json');
const v = require('./data/validators.json');
const list = Array.isArray(v) ? v : v.validators;
const staked = new Set(list.map(x => x.identityPubkey));
const counts = {};
for (const n of g) {
  if (staked.has(n.identityPubkey)) continue;
  const ver = n.version || 'unknown';
  counts[ver] = (counts[ver] || 0) + 1;
}
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log('unstaked total:', total);
console.log('distinct versions:', Object.keys(counts).length);
"
```

Expected: `unstaked total:` ≈ 3639 (exact number depends on current data files; record it — you will compare against the UI in Task 2). No errors.

- [ ] **Step 2: Add the aggregation to `src/app/page.tsx`**

Add a `GossipNode` interface next to the other interfaces at the top of the file (after `ValidatorsAppValidator`, around line 25):

```typescript
interface GossipNode {
  identityPubkey: string;
  version?: string;
}
```

Inside `Home()`, after the big `try/catch` that loads validators and the external APIs (i.e., after the closing `}` at line ~68, before the `// Create maps for efficient lookup` comment), add:

```typescript
  // Count versions of unstaked gossip nodes (nodes not in the validator set)
  let unstakedVersionCounts: Record<string, number> = {};
  try {
    const gossipRaw = await fs.readFile(
      path.join(process.cwd(), "data", "gossip.json"),
      "utf-8"
    );
    const gossipNodes: GossipNode[] = JSON.parse(gossipRaw);
    const stakedIdentities = new Set(validators.map((v) => v.identityPubkey));
    for (const node of gossipNodes) {
      if (stakedIdentities.has(node.identityPubkey)) continue;
      const version = node.version || "unknown";
      unstakedVersionCounts[version] = (unstakedVersionCounts[version] || 0) + 1;
    }
  } catch (error) {
    console.error("Error reading gossip data:", error);
    unstakedVersionCounts = {};
  }
```

Then pass the prop where `ValidatorTable` is rendered (line ~120):

```tsx
        <ValidatorTable
          initialData={enrichedValidators}
          unstakedVersionCounts={unstakedVersionCounts}
        />
```

- [ ] **Step 3: Accept the prop in `ValidatorTable.tsx`**

Change the component signature at `src/components/ValidatorTable.tsx:11` from:

```tsx
export default function ValidatorTable({ initialData }: { initialData: Validator[] }) {
```

to:

```tsx
export default function ValidatorTable({
  initialData,
  unstakedVersionCounts = {},
}: {
  initialData: Validator[];
  unstakedVersionCounts?: Record<string, number>;
}) {
```

The prop is intentionally unused until Task 2. If `npm run lint` flags it as unused, that's acceptable to ignore only if it's a warning; if it's an error, silence it by referencing it in a trivial `void unstakedVersionCounts;` statement at the top of the component body and remove that statement in Task 2.

- [ ] **Step 4: Verify lint and build pass**

Run: `npm run lint`
Expected: no new errors (pre-existing warnings, if any, are fine).

Run: `npm run build`
Expected: `✓ Compiled successfully` and the build completes without type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/ValidatorTable.tsx
git commit -m "feat: compute unstaked gossip node version counts server-side"
```

---

### Task 2: Toggle button, unstaked panel, and URL state in `ValidatorTable.tsx`

**Files:**
- Modify: `src/components/ValidatorTable.tsx` (state ~line 20, URL effects ~lines 44–108, `clearAllFilters` ~line 376, toolbar buttons ~lines 477–502, version panel ~lines 536–596)

**Interfaces:**
- Consumes: prop `unstakedVersionCounts: Record<string, number>` from Task 1; `getMinorVersionGroup(version: string): string` from `../utils/versionParser` (already imported at line 8).
- Produces: URL query param `unstaked=1` when the toggle is on. No exports consumed by later tasks.

- [ ] **Step 1: Add toggle state**

Next to the other `useState` hooks (after `showVersionFilter` at line 20), add:

```tsx
  const [showUnstaked, setShowUnstaked] = useState(false);
```

- [ ] **Step 2: Read `unstaked` from the URL on load**

In the "Initialize filters from URL parameters" `useEffect` (starts line ~45), add alongside the other `searchParams.get` calls:

```tsx
    const unstaked = searchParams.get('unstaked');
```

and after the existing `if` blocks (e.g., after the `datacenters` block):

```tsx
    if (unstaked === '1') {
      setShowUnstaked(true);
      setShowVersionFilter(true);
    }
```

- [ ] **Step 3: Write `unstaked` to the URL on change**

In the "Update URL when filters change" `useEffect` (starts line ~80), add before `const queryString = params.toString();`:

```tsx
    if (showUnstaked) {
      params.set('unstaked', '1');
    }
```

and add `showUnstaked` to the effect's dependency array:

```tsx
  }, [selectedVersions, sfdpFilter, sortCfg, selectedClients, selectedAsns, selectedDataCenters, showUnstaked]);
```

- [ ] **Step 4: Compute unstaked version stats**

Add this `useMemo` after the existing `versionStats` memo (after line ~179). It reuses the same version-descending sort logic as `versionStats` and groups by `getMinorVersionGroup`:

```tsx
  // Version stats for unstaked gossip nodes (counts, not stake)
  const unstakedVersionStats = useMemo(() => {
    const compareVersionsDesc = (a: string, b: string) => {
      if (a === "unknown") return 1;
      if (b === "unknown") return -1;
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        if (aPart !== bPart) return bPart - aPart;
      }
      return 0;
    };

    const groupMap = new Map<string, Map<string, number>>(); // group -> version -> count
    let totalNodes = 0;

    Object.entries(unstakedVersionCounts).forEach(([version, count]) => {
      totalNodes += count;
      const group = getMinorVersionGroup(version);
      if (!groupMap.has(group)) {
        groupMap.set(group, new Map());
      }
      groupMap.get(group)!.set(version, count);
    });

    const groups = Array.from(groupMap.entries())
      .map(([groupName, versions]) => {
        const nodeCount = Array.from(versions.values()).reduce((sum, c) => sum + c, 0);
        const individualVersions = Array.from(versions.entries())
          .map(([version, count]) => ({ version, count }))
          .sort((a, b) => compareVersionsDesc(a.version, b.version));
        return {
          groupName,
          nodeCount,
          versionCount: versions.size,
          individualVersions,
        };
      })
      .sort((a, b) => compareVersionsDesc(a.groupName, b.groupName));

    return { groups, totalNodes };
  }, [unstakedVersionCounts]);
```

If Task 1 added a `void unstakedVersionCounts;` statement, remove it now.

- [ ] **Step 5: Add the toggle handler and wire `clearAllFilters`**

Add near the other toggle handlers (e.g., after `toggleDataCenter`, line ~374):

```tsx
  const toggleUnstaked = () => {
    setShowUnstaked((prev) => {
      const next = !prev;
      if (next) {
        setShowVersionFilter(true);
      }
      return next;
    });
  };
```

In `clearAllFilters` (line ~376), add before the `window.history.replaceState` call:

```tsx
    setShowUnstaked(false);
```

- [ ] **Step 6: Add the toolbar button**

In the toolbar `div` (the `flex items-center gap-2` block, lines ~477–502), add a button between the "Version Filter" button and the "Infrastructure Columns" button, matching the existing checkmark-toggle style:

```tsx
          <button
            onClick={toggleUnstaked}
            className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-900 rounded transition-colors"
          >
            Unstaked Nodes {showUnstaked ? '✓' : ''}
          </button>
```

- [ ] **Step 7: Render the unstaked panel and gate the existing one**

Change the existing version panel condition at line ~536 from:

```tsx
      {showVersionFilter && (
```

to:

```tsx
      {showVersionFilter && !showUnstaked && (
```

Then add the unstaked variant immediately after that block's closing `)}` (after line ~596):

```tsx
      {showVersionFilter && showUnstaked && (
        <div className="bg-gray-50 border rounded-lg p-4 mb-4 transition-all duration-200">
          <div className="text-sm text-gray-700 mb-3">
            <strong>{unstakedVersionStats.totalNodes.toLocaleString()}</strong> unstaked gossip nodes
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unstakedVersionStats.groups.map((group) => (
              <div
                key={group.groupName}
                className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm"
              >
                <div className="mb-2 pb-2 border-b border-gray-200">
                  <div className="font-semibold text-sm text-gray-900">
                    Version {group.groupName}
                  </div>
                  <div className="text-xs text-gray-600">
                    {group.nodeCount.toLocaleString()} node{group.nodeCount !== 1 ? 's' : ''} • {group.versionCount} version{group.versionCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="flex flex-col gap-1 mt-2">
                  {group.individualVersions.map((item) => (
                    <div
                      key={item.version}
                      className="flex items-center gap-2 text-xs text-gray-700 py-1"
                    >
                      <span className="flex-1 whitespace-nowrap">{item.version}</span>
                      <span className="text-gray-500">{item.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
```

Note: no checkboxes in this panel by design — the main table still shows staked validators, so there is nothing for the checkboxes to filter.

- [ ] **Step 8: Verify lint and build**

Run: `npm run lint`
Expected: no new errors.

Run: `npm run build`
Expected: `✓ Compiled successfully`, no type errors.

- [ ] **Step 9: Manual verification in the dev server**

Run: `npm run dev` and open `http://localhost:3000`, then check:

1. Click "Unstaked Nodes" → version panel opens in count mode; header total matches the number recorded in Task 1 Step 1 (≈3,639).
2. Version cards show `N nodes • M versions` per group and a count per version; no checkboxes visible.
3. URL now contains `?unstaked=1`. Reload the page with that URL → the panel restores in unstaked mode.
4. Click "Unstaked Nodes" again → the panel reverts to stake-% mode with working checkboxes; `unstaked` disappears from the URL.
5. Click "Clear All Filters" while toggled on → toggle resets, URL params cleared, panel closed.
6. The main table rows are identical in both modes (still staked validators).

Expected: all six checks pass. Stop the dev server afterward.

- [ ] **Step 10: Commit**

```bash
git add src/components/ValidatorTable.tsx
git commit -m "feat: add unstaked nodes toggle showing gossip version counts"
```

---

### Task 3: Regenerate `gossip.json` hourly in the GitHub Actions workflow

**Files:**
- Modify: `.github/workflows/update-validators.yml` (add a generation step after "Generate validators.json"; widen the commit step to cover both files)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: hourly-refreshed `data/gossip.json` in the same JSON-array format the app reads (`solana gossip --output json`).

- [ ] **Step 1: Add the gossip generation step**

In `.github/workflows/update-validators.yml`, after the "Generate validators.json" step, add:

```yaml
      - name: Generate gossip.json
        run: |
          solana -um gossip --output json > data/gossip.json
```

- [ ] **Step 2: Widen the commit step to both files**

Replace the "Commit and push if changed" step's `run` block with:

```yaml
      - name: Commit and push if changed
        run: |
          if [[ -n "$(git status --porcelain data/validators.json data/gossip.json)" ]]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add data/validators.json data/gossip.json
            git commit -m "update validators.json $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
            git push
          else
            echo "No changes; skipping commit."
          fi
```

- [ ] **Step 3: Validate the workflow YAML**

Run: `node -e "const fs=require('fs'); const s=fs.readFileSync('.github/workflows/update-validators.yml','utf8'); console.log(s.includes('gossip.json') ? 'gossip step present' : 'MISSING');"`
Expected: `gossip step present`

If `actionlint` is installed (`which actionlint`), also run: `actionlint .github/workflows/update-validators.yml`
Expected: no errors. If not installed, skip — the YAML edit mirrors the existing step structure exactly.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/update-validators.yml
git commit -m "ci: regenerate gossip.json hourly alongside validators.json"
```

---

## Final verification (after all tasks)

- [ ] `npm run lint` → clean
- [ ] `npm run build` → compiles
- [ ] Spot-check the six manual checks from Task 2 Step 9 once more
