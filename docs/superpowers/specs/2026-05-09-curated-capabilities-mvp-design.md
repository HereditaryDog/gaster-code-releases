# GasterCode Curated Capabilities MVP Design

## Summary

GasterCode will ship a lightweight curated capability set as the first step toward a future capability marketplace. The MVP includes 10 curated Skills and 6 curated Agents, all enabled by default after installation or upgrade. Users can disable individual items from the desktop Settings UI.

This feature treats the curated items as bundled GasterCode capabilities, not as files copied into the user's `~/.claude/skills` or project directories. That keeps user configuration clean, makes updates controllable by GasterCode releases, and gives the future marketplace a clear data model to build on.

## Goals

- Show curated Skills and Agents in Settings even when the user has no local Skills or custom Agents.
- Enable all curated Skills and Agents by default.
- Let users disable or re-enable each curated Skill or Agent.
- Make enabled curated Skills available to the model as runtime skills.
- Make enabled curated Agents available through the existing Agent loading path.
- Keep the implementation small enough for one MVP cycle.
- Avoid writing any new legacy external paths, labels, storage keys, or user-visible copy.
- Leave room for a later capability marketplace without committing to remote marketplace behavior in this MVP.

## Non-Goals

- No remote marketplace, downloads, search, ratings, payments, or third-party update channel.
- No uninstall flow for bundled curated items.
- No per-project enablement in the MVP.
- No user-authored Skill or Agent editor in the MVP.
- No automatic copying into `~/.claude/skills`, `.claude/skills`, `~/.claude/agents`, or project agent folders.
- No provider-specific recommendations or model marketplace behavior.

## Product Decisions

### Default Enablement

All curated Skills and Agents are enabled by default. The absence of user state means enabled. The persisted settings store only explicit user overrides, mainly disabled item IDs.

This gives the exact behavior requested:

- New install: every curated item is active.
- Upgrade: every newly introduced curated item is active unless the user disables it later.
- Config file missing or empty: every curated item is active.
- User disables an item: only that item is inactive until re-enabled.
- User re-enables an item: remove its disabled override and return to default-on behavior.

### Product Copy

The UI should call the section "官方精选" in Chinese and "Curated" in English. These items can be described as selected third-party-style capabilities, but they should not be labeled as a live marketplace yet.

Suggested Chinese copy:

- Skills page section title: `官方精选 Skills`
- Agents page section title: `官方精选 Agents`
- Description: `GasterCode 内置的精选能力，安装后默认开启。你可以关闭不需要的项目。`
- Enabled state: `已启用`
- Disabled state: `已关闭`

## Curated MVP Catalog

### Skills

The MVP ships 10 Skills. Names are stable IDs and slash-command names.

| ID | Display Name | Purpose | Default |
| --- | --- | --- | --- |
| `diagnostics-analyzer` | 诊断包分析 | Analyze exported diagnostics, group repeated failures, and identify likely root causes. | Enabled |
| `code-review` | 代码审查 | Review diffs for bugs, regressions, security risks, and missing tests. | Enabled |
| `bug-investigation` | 问题定位 | Guide systematic debugging before editing code. | Enabled |
| `frontend-review` | 前端体验走查 | Review rendered UI for layout, copy, responsive issues, and interaction gaps. | Enabled |
| `browser-smoke-test` | 浏览器冒烟验证 | Plan and run focused browser checks for local frontend changes. | Enabled |
| `test-author` | 测试补齐 | Add or improve focused regression tests for changed behavior. | Enabled |
| `release-checklist` | 发布检查 | Prepare release checks, notes, version consistency, and package handoff. | Enabled |
| `docs-polisher` | 文档润色 | Improve README, docs, changelog, and user-facing technical copy. | Enabled |
| `git-pr-summary` | PR 摘要 | Summarize local changes into commit, PR, or release-note language. | Enabled |
| `migration-planner` | 迁移规划 | Plan compatibility migrations for config, localStorage, naming, and legacy paths. | Enabled |

### Agents

The MVP ships 6 Agents. Agent type IDs should stay lowercase kebab-case to avoid colliding with existing built-in labels such as `general-purpose`.

| ID | Display Name | Role | Default |
| --- | --- | --- | --- |
| `gaster-frontend-engineer` | 前端工程师 | Implement and verify focused desktop UI changes. | Enabled |
| `gaster-backend-engineer` | 后端工程师 | Work on server APIs, runtime services, config storage, and integration points. | Enabled |
| `gaster-qa-engineer` | 测试工程师 | Add regression coverage and run targeted verification. | Enabled |
| `gaster-debug-investigator` | 调试分析师 | Explore failures, logs, and diagnostics before implementation. | Enabled |
| `gaster-release-manager` | 发布经理 | Prepare version, release notes, package workflow checks, and release handoff. | Enabled |
| `gaster-docs-engineer` | 文档工程师 | Update docs and user-facing technical explanations. | Enabled |

## Architecture

### Catalog Module

Create a shared catalog module for curated capabilities.

Expected responsibilities:

- Define all curated Skill and Agent metadata in one place.
- Expose lookup helpers by ID and by kind.
- Keep display metadata separate from runtime prompts.
- Include fields needed by a future marketplace: `id`, `kind`, `displayName`, `description`, `category`, `author`, `version`, `defaultEnabled`, and `tags`.

The catalog should live in source code, not in user-writable config. A good target is:

- `src/capabilities/curatedCatalog.ts`

### User State

Persist only user overrides in GasterCode's own config directory:

- `~/.claude/gaster-code/capabilities.json`

Do not use legacy config fallback for this new file. This is a new GasterCode feature and should only read and write the current GasterCode config path.

Suggested file shape:

```json
{
  "version": 1,
  "disabled": {
    "skills": ["frontend-review"],
    "agents": ["gaster-release-manager"]
  }
}
```

Runtime interpretation:

- `disabled.skills` missing: no disabled Skills.
- `disabled.agents` missing: no disabled Agents.
- Unknown IDs in the file: keep them on write only if they still exist in the catalog; ignore them at runtime.
- Malformed JSON: treat all curated items as enabled and surface a warning through the API response so the UI can explain why the toggle state could not be loaded.

Use an atomic write pattern matching existing provider config behavior: write a temporary file, then rename it into place.

### Server API

Add a small API surface for the desktop UI:

- `GET /api/capabilities/curated`
- `PUT /api/capabilities/curated/:kind/:id`

`kind` is either `skills` or `agents`.

`GET` returns catalog items merged with user state:

```json
{
  "skills": [
    {
      "id": "diagnostics-analyzer",
      "displayName": "诊断包分析",
      "description": "Analyze exported diagnostics...",
      "category": "diagnostics",
      "enabled": true,
      "defaultEnabled": true
    }
  ],
  "agents": [
    {
      "id": "gaster-frontend-engineer",
      "displayName": "前端工程师",
      "description": "Implement and verify focused desktop UI changes.",
      "category": "engineering",
      "enabled": true,
      "defaultEnabled": true
    }
  ],
  "warnings": []
}
```

`PUT` body:

```json
{
  "enabled": false
}
```

`PUT` behavior:

- Validate `kind`.
- Validate `id` exists in the catalog.
- Write the explicit disabled override when `enabled` is false.
- Remove the override when `enabled` is true.
- Clear command and agent definition caches after a successful write.
- Return the updated item and current counts.

### Skills Runtime Integration

Curated Skills should use the existing bundled skill mechanism. Each curated Skill registers a bundled skill command whose `isEnabled()` reads the curated state.

The Settings Skills API should also list curated bundled skills:

- Extend server `SkillMeta.source` to include `bundled`.
- Include bundled skills in `GET /api/skills`.
- For curated bundled skills, expose `enabled`, `defaultEnabled`, and `curated: true`.
- Support details for curated bundled skills by using existing bundled skill metadata and extracted reference files where available.

This lets the runtime and UI describe the same Skill without copying files into user directories.

### Agents Runtime Integration

Curated Agents should be returned by `getBuiltInAgents()` when enabled. They should have:

- `source: 'built-in'`
- `baseDir: 'built-in'`
- `agentType` equal to the stable catalog ID
- concise `whenToUse`
- a focused system prompt
- scoped tools where practical

The agent loader already handles built-in agents and override precedence. If a user or project defines an Agent with the same `agentType`, existing override behavior should continue to work. The curated Agent remains visible in `allAgents`, and the active list reflects the overriding definition.

### Desktop UI

Add a reusable curated capability panel used by both Skills and Agents settings.

Expected UI behavior:

- Render the curated section before the existing installed list.
- Show enabled and disabled counts.
- Show each item as a compact row or card with display name, description, category, and toggle.
- Toggling an item calls the new API and then refreshes the relevant Skills or Agents list.
- If a write fails, keep the previous state and show an error toast.
- Empty states should change: when there are no user/project/plugin Skills, the page still shows the curated Skills section.

The existing installed Skills and Agents browsers remain. The MVP should not replace the current grouping or detail views.

## Data Flow

### Initial Load

1. Desktop Settings page requests `GET /api/capabilities/curated`.
2. Server reads the static catalog.
3. Server reads `~/.claude/gaster-code/capabilities.json`.
4. Server computes `enabled = !disabled[kind].includes(id)`.
5. UI renders curated cards and existing installed lists.

### Toggle

1. User flips a Skill or Agent toggle.
2. Desktop sends `PUT /api/capabilities/curated/:kind/:id`.
3. Server validates the catalog ID.
4. Server writes the override atomically.
5. Server clears runtime caches:
   - command and skill memoization caches for Skills.
   - agent definition cache for Agents.
6. Desktop refreshes curated state and the relevant installed list.

### Runtime Use

1. Command loading asks bundled Skills whether they are enabled.
2. Agent loading asks the curated state before adding curated built-in Agents.
3. Disabled curated items are absent from runtime availability.
4. Re-enabled curated items return without reinstalling anything.

## Error Handling

- Missing config file: all curated items enabled.
- Empty config file: all curated items enabled, with a warning in the API response.
- Malformed config file: all curated items enabled, with a warning in the API response.
- Unknown catalog ID in persisted disabled list: ignored at runtime and removed on the next successful write.
- Failed write: API returns an error; UI reverts the toggle and shows a toast.
- Cache clear failure: API returns an error if cache invalidation throws; state is not reported as updated unless runtime will observe the change.

## Testing Strategy

### Server Tests

Add focused Bun tests for:

- `GET /api/capabilities/curated` returns all 10 Skills and 6 Agents enabled by default.
- `PUT` disables one Skill and persists it.
- `PUT` re-enables one Skill by removing the disabled override.
- `PUT` rejects unknown IDs.
- malformed config falls back to default-enabled with a warning.
- `GET /api/skills` includes enabled curated bundled Skills.
- disabled curated Skills do not appear in runtime command availability.
- enabled curated Agents appear in `/api/agents`.
- disabled curated Agents are absent from active built-in Agents.

### Desktop Tests

Add Vitest coverage for:

- Skills page renders the curated section when no local Skills exist.
- Agents page renders the curated section.
- toggling a Skill calls the API and refreshes Skills.
- toggling an Agent calls the API and refreshes Agents.
- write failure reverts visible toggle state and shows an error.
- Chinese and English copy keys exist for the new UI.

### Manual Verification

Use the existing local runtime:

- Backend: `SERVER_PORT=3456 HOST=127.0.0.1 bun run src/server/index.ts`
- Frontend: `cd desktop && bun run dev -- --host 127.0.0.1 --port 5174`
- Open `http://localhost:5174/`.
- Check Settings -> Skills: curated Skills render and are enabled.
- Disable one Skill, refresh, confirm it remains disabled.
- Re-enable it, refresh, confirm it is enabled.
- Check Settings -> Agents with the same flow.
- Start a new chat and verify enabled curated Skills and Agents are available through normal runtime discovery.

## Implementation Scope

The implementation should be broken into four small phases:

1. Catalog and settings service.
2. Server API and runtime cache invalidation.
3. Runtime integration for bundled Skills and built-in Agents.
4. Desktop UI, i18n, and tests.

Each phase should be separately testable. The final implementation should run:

- targeted server tests for curated capabilities, Skills, and Agents.
- targeted desktop tests for Settings UI.
- `bun run check:server`
- `bun run check:desktop`

## Future Marketplace Path

The MVP intentionally uses a catalog-shaped data model:

- `id`
- `kind`
- `author`
- `version`
- `category`
- `tags`
- `enabled`
- `defaultEnabled`

A future marketplace can reuse this shape and add:

- remote source metadata
- install state
- update state
- trust and permission review
- screenshots or examples
- user ratings or official recommendations

The MVP should not expose those future fields in the UI until they are real.

## Approval Gate

Implementation should not begin until this design is reviewed and approved. After approval, create a separate implementation plan under `docs/superpowers/plans/` before editing runtime or UI code.
