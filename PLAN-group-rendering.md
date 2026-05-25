# Plan: Render Group Children Together on One Page

## Philosophy

**Don't change what works. Add, don't modify.**

HeyForm's `flattenFieldsWithGroups()` is used by the renderer, the logic builder,
and the logic editor. Changing it ripples everywhere and creates merge conflicts
on every upstream update. Instead, we leave flattening alone — children stay as
individual entries in `state.fields` — and we only change **how groups are
rendered** and **how navigation skips over group children**.

This gives us:
- Zero changes to validation (`fieldsToValidateRules` already extracts group children)
- Zero changes to submission (`fieldValuesToAnswers` uses the same extraction)
- Zero changes to progress tracking (children are still individual countable fields)
- Zero changes to the sidebar (it already reads `parent` for tree display)
- Zero changes to the form builder (logic editor uses `flattenFieldsWithGroups` untouched)
- Zero changes to any existing block component (ShortText, Email, PhoneNumber, etc.)
- Zero changes to `Form.tsx` or `Block.tsx`
- Zero backend/API changes

**Total footprint: ~160 lines across 3 existing files (surgical edits) + 1 new file.**

---

## What Changes

### 1. `Blocks.tsx` — Render groups as a single page (~15 lines changed)

**File:** `packages/form-renderer/src/views/Blocks.tsx`

Two changes:

**a) Add GROUP case in `getBlock()` (line ~43)**

Currently GROUP falls through to the `default` case and renders as a `Statement`
(just a title with no inputs). Add an explicit case:

```tsx
import { Group } from '../blocks/Group'

// In getBlock():
case FieldKindEnum.GROUP:
  return <Group key={field.id} field={field} transitionState={transitionState} />
```

**b) Redirect group children to their parent (in `Main`, line ~135)**

When `scrollIndex` lands on a child field (e.g. via sidebar click), render the
parent group page instead:

```tsx
// After computing activeField:
const effectiveField = useMemo(() => {
  if (activeField?.parent) {
    return state.fields.find(f => f.id === activeField.parent?.id) || activeField
  }
  return activeField
}, [activeField, state.fields])
```

Then use `effectiveField` in place of `activeField` for rendering `activeBlock`.
The `leavingField` transition logic also needs to suppress animations when
the previous and current field belong to the same group (i.e. effectiveField
didn't change).

**Why this is safe:** We're adding a new case to a switch and wrapping an
existing variable. No existing code paths change behavior.

---

### 2. `store.ts` — Group-aware navigation (~20 lines changed)

**File:** `packages/form-renderer/src/store.ts`

Three surgical additions to existing actions:

**a) `scrollNext` (line ~205) — Skip past group children**

When the current field is a GROUP or a group child, jump past all siblings:

```tsx
scrollNext: (state: IState) => {
  const { scrollIndex, fields, values, jumpFieldIds } = state
  const currentField = fields[scrollIndex!]

  // NEW: If on a GROUP or group child, skip past all children
  const groupId = currentField?.kind === FieldKindEnum.GROUP
    ? currentField.id
    : currentField?.parent?.id

  if (groupId) {
    let nextIndex = scrollIndex! + 1
    while (nextIndex < fields.length && (
      fields[nextIndex]?.parent?.id === groupId ||
      fields[nextIndex]?.id === groupId
    )) {
      nextIndex++
    }
    if (nextIndex >= fields.length) {
      // Group is the last thing — trigger submission
      return { ...state, isScrollNextDisabled: true }
    }
    return actions.scrollTo(state, { scrollIndex: nextIndex, scrollTo: 'next' })
  }

  // ... existing logic unchanged below ...
}
```

**b) `scrollPrevious` (line ~194) — Skip back over group children**

When landing on a group child, jump to the field before the group:

```tsx
scrollPrevious: (state: IState) => {
  if (state.scrollIndex! < 1) return state

  let targetIndex = state.scrollIndex! - 1
  const targetField = state.fields[targetIndex]

  // NEW: If landing on a group child, jump to before the group
  if (targetField?.parent) {
    const parentIndex = state.fields.findIndex(f => f.id === targetField.parent?.id)
    targetIndex = parentIndex > 0 ? parentIndex - 1 : 0
  }

  return actions.scrollTo(state, { scrollIndex: targetIndex, scrollTo: 'previous' })
}
```

**c) `scrollToField` (line ~222) — Redirect child targets to parent group**

When error validation or sidebar navigation targets a group child, go to the
parent group instead (Blocks.tsx effectiveField handles rendering):

```tsx
scrollToField(state: IState, { fieldId, errorFieldId }: any) {
  let index = state.fields.findIndex(f => f.id === fieldId)
  if (index < 0) return state

  // NEW: If targeting a group child, go to parent group
  const field = state.fields[index]
  if (field?.parent) {
    const parentIndex = state.fields.findIndex(f => f.id === field.parent?.id)
    if (parentIndex >= 0) index = parentIndex
  }

  return actions.scrollTo(state, {
    scrollIndex: index,
    scrollTo: !helper.isNil(state.scrollIndex) && index >= state.scrollIndex! ? 'next' : 'previous',
    errorFieldId
  })
}
```

**Why this is safe:** Each change is additive — a conditional block at the top
of the function. If the field isn't a group/child, we fall through to the
exact original logic. The existing behavior is a strict subset.

---

### 3. New file: `blocks/Group.tsx` (~100 lines)

**File:** `packages/form-renderer/src/blocks/Group.tsx` (NEW)

This is the only substantial new code. It renders a group field + all its
children as a single scrollable page.

**Structure:**

```
<Block>                           ← existing wrapper (transition, layout)
  <div class="heyform-group">
    <h1>Group Title</h1>          ← from field.title
    <p>Description</p>            ← from field.description

    <div class="heyform-group-children">
      <!-- For each child field: -->
      <div class="heyform-group-child">
        <label>Child Title *</label>
        <Form field={child}>        ← rc-field-form per child
          <FormField rules={...}>
            <Input />               ← uses existing input components
          </FormField>
        </Form>
      </div>
    </div>

    <SubmitButton />               ← single Next/Submit button
  </div>
</Block>
```

**Key design decisions:**

1. **Each child keeps its own `<Form>` instance** — this means each child
   validates independently using rc-field-form, matching existing block behavior.
   We don't need to rewrite validation.

2. **Children rendered as lightweight inputs** — We import the actual input
   components (`Input`, `PhoneNumberInput`, etc.) directly from `../components`,
   not the full Block wrappers. This avoids nested transitions, nested scroll
   handlers, and nested theme backgrounds.

3. **Value dispatch per child** — Each child's `<Form>` dispatches `setValues`
   with `{ [child.id]: value }` on change (not on submit). This keeps
   `state.values` up to date as the user types, exactly like the existing
   behavior.

4. **Single Next button** — The Group component renders one "Next" button at
   the bottom. On click, it validates all children's forms programmatically
   (calling `form.validateFields()` on each). If all pass, it dispatches
   `scrollNext` (which, per our store change, skips past all children).

5. **Finding children** — Reads from `state.fields` using
   `fields.filter(f => f.parent?.id === field.id)`. Does NOT modify
   `flattenFieldsWithGroups`.

6. **Supported field kinds for MVP** — SHORT_TEXT, EMAIL, PHONE_NUMBER, NUMBER,
   URL, FULL_NAME. These cover the Chalet use case (first name, last name,
   phone, email). Others render as SHORT_TEXT fallback. More kinds can be added
   incrementally.

**Why this approach:** By keeping individual `<Form>` instances per child but
rendering them visually grouped, we avoid changing Form.tsx entirely. Each
child's onChange handler updates `state.values[childId]` independently, which
means progress tracking, auto-save, and partial submission all work for free.

---

### 4. `style.scss` — Additive group styles (~25 lines)

**File:** `packages/form-renderer/src/style.scss` (append at end)

```scss
/* Group: render children together on one page */
.heyform-group-children {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  margin-top: 1.5rem;
}

.heyform-group-child {
  .heyform-block-title {
    font-size: 1rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  /* Hide individual form submit buttons — group has its own */
  .heyform-submit,
  .heyform-skip-button {
    display: none;
  }
}

.heyform-group > .heyform-submit {
  margin-top: 2rem;
}
```

**Why this is safe:** Purely additive. Appended to end of file. No existing
selectors modified. Uses new class names that don't exist in upstream.

---

## Files NOT Changed (and why)

| File | Why untouched |
|------|---------------|
| `form.ts` (`flattenFieldsWithGroups`) | Used by builder's logic editor. Children stay as individual `state.fields` entries. All downstream logic works. |
| `Form.tsx` | Each child keeps its own Form instance. No props added. |
| `Block.tsx` | Group.tsx uses it as outer wrapper only. Children rendered with lightweight markup. |
| All block components (ShortText, Email, etc.) | Not reused inside Group — we use raw input components directly. |
| `answer-utils` (validate, fields-to-validate-rules) | `fieldsToValidateRules` already extracts children from `group.properties.fields` (line 31-32). Works as-is. |
| `shared-types-enums` | No new field kinds or settings needed. |
| `Sidebar.tsx` | Already shows group children via `treeFields()` which reads `f.parent`. |
| `Footer.tsx` | Previous/Next dispatch to store which now handles groups. |
| Backend / API | Values are keyed by field.id. Group children have individual IDs. Nothing changes server-side. |
| Form builder | Groups already exist. No new UI needed. |

---

## How Existing Systems See Groups (unchanged)

```
Form Data (from builder):
  fields: [A, Group{children: [C1,C2,C3]}, B]

After flattenFieldsWithGroups (UNCHANGED):
  state.fields: [A, Group(empty), C1(parent=Group), C2(parent=Group), C3(parent=Group), B]

Renderer sees scrollIndex on Group → renders Group.tsx → shows C1,C2,C3 together
Renderer sees scrollIndex on C1/C2/C3 → redirects to Group → same page

Navigation:
  Next from A      → lands on Group (index+1)
  Next from Group  → skips C1,C2,C3 → lands on B
  Prev from B      → lands on C3 → redirected to before Group → Group renders
                     Actually: prev from B lands on C3, C3 has parent, so skip
                     to field before Group → lands on A

Validation on final submit:
  validateFields(state.fields, values)
  → fieldsToValidateRules skips Group (but reads its properties.fields for children)
  → Wait — Group's properties.fields was emptied to [] by flattenFieldsWithGroups!
  → But C1,C2,C3 are individual entries in state.fields, so they're validated directly.
  → Works correctly.

Progress:
  questionCount = fields.filter(QUESTION_FIELD_KINDS).length
  → Counts Group + C1 + C2 + C3 = 4 (Group is in QUESTION_FIELD_KINDS)
  → Slightly inflated by 1 (the Group statement itself). Acceptable.
  → Could subtract 1 per group if needed (tiny optional fix).

Sidebar:
  treeFields(state.fields)
  → root = [A, Group, B] (no parent)
  → children = [C1, C2, C3] (have parent)
  → Group gets children: [C1, C2, C3]
  → Sidebar shows Group with expandable children. Works perfectly.
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Group with 0 children | Renders as Statement (existing behavior, getBlock falls through) |
| Group as last field before submit | scrollNext from group hits end-of-fields → triggers submission |
| User navigates via sidebar to a child | scrollToField redirects to parent group index |
| Validation error on a child during final submit | Error contains child.id, scrollToField redirects to group |
| Logic/branching on group children | Children are in state.fields individually, logic applies normally |
| Keyboard Enter inside a child input | Submits that child's form → value saved. Group's own Next button handles page advance. |
| Group with only 1 child | Works fine — renders as a group with 1 input |

---

## LOE

| Task | Effort |
|------|--------|
| `Blocks.tsx` changes (GROUP case + effectiveField) | 30 min |
| `store.ts` changes (scrollNext/Prev/ToField) | 45 min |
| `Group.tsx` new component | 2 hours |
| `style.scss` additions | 30 min |
| Manual testing with real form | 1 hour |
| **Total** | **~5 hours** |

---

## Future Upstream Merges

When pulling from upstream `heyform/heyform`:

- **`Blocks.tsx`**: Only conflict if upstream adds a GROUP case to `getBlock()` (unlikely —
  they've left it as default/Statement for years). The effectiveField wrapper in Main is
  additive and won't conflict with changes to activeField computation.

- **`store.ts`**: Only conflicts if upstream rewrites scrollNext/scrollPrevious signatures.
  Our additions are clearly isolated at the top of each function with early returns.

- **`Group.tsx`**: New file. Zero conflict possible.

- **`style.scss`**: Appended at end. No conflict unless upstream adds identical class names.

**Estimated merge effort per upstream update: < 5 minutes.**
