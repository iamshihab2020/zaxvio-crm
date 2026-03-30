# Team Management — Implementation Plan

## Context

The CRM is currently single-user per tenant. For enterprise, organizations need multiple users with roles (Owner, Admin, Member) and invitation-based onboarding. Better Auth's organization plugin already provides the complete backend API — the primary work is frontend UI, role enforcement, and wiring up the invitation email flow.

## What Better Auth Already Provides (NO backend work needed)

All these endpoints exist at `/api/auth/*` via the organization plugin:

- `getFullOrganization()` — org with members + invitations
- `listMembers()`, `addMember()`, `removeMember()`, `updateMemberRole()`
- `createInvitation()`, `acceptInvitation()`, `rejectInvitation()`, `cancelInvitation()`
- `listInvitations()`, `getActiveMember()`

Client-side: `authClient.organization.*` already configured in `apps/web/src/lib/auth-client.ts`

## Roles

| Role | Access |
|------|--------|
| **Owner** | Full access, manage billing, transfer ownership, delete org |
| **Admin** | Manage team (invite/remove/roles), manage all data + settings |
| **Member** | Operational data only (jobs, customers, invoices), no team/billing/business settings |

---

## Phase 1: Backend Configuration

### 1.1 Configure Better Auth org plugin with roles + email hook

**File:** `apps/api/src/lib/auth.ts`

- Add `creatorRole: "owner"` to organization plugin config
- Add `invitationExpiresIn: 7 * 24 * 60 * 60` (7 days)
- Add `sendInvitationEmail` hook that sends via Resend
- Email contains link: `{FRONTEND_URL}/invite/{invitationId}`

### 1.2 Create invitation email template

**File:** `packages/email/src/templates/invitation.tsx` (new)

- React Email template with: org name, inviter name, role, CTA button, expiry notice
- Follows existing email design patterns in `packages/email/`

### 1.3 Create email sending utility

**File:** `apps/api/src/lib/email.ts` (new or extend existing)

- Resend SDK helper to render + send React Email templates
- Uses `RESEND_API_KEY` from env

### 1.4 Add `requireOrgRole` middleware

**File:** `apps/api/src/lib/auth-middleware.ts`

- New factory: `requireOrgRole(allowedRoles: string[])`
- Queries `member.role` where `userId` + `organizationId` match
- Returns 403 if role not in `allowedRoles`
- Add `orgRole` to `AuthUser` interface

### 1.5 Apply role guards to sensitive routes

| Route | Role Required |
|-------|---------------|
| `PATCH /tenants/current` (business settings) | `["owner", "admin"]` |
| Billing endpoints | `["owner"]` |
| All other tenant data routes (jobs, customers, invoices, etc.) | All roles (keep `requireTenant`) |

### 1.6 Migration: set existing org creators to "owner"

**File:** `supabase/migrations/XXXXXX_set_creator_owner_role.sql` (new)

```sql
-- Idempotent: only updates members who are still "member"
UPDATE member SET role = 'owner'
WHERE id IN (
  SELECT DISTINCT ON (organization_id) id
  FROM member ORDER BY organization_id, created_at ASC
) AND role = 'member';
```

---

## Phase 2: Invitation Acceptance Flow

### 2.1 Create `/invite/[id]` page

**File:** `apps/web/src/app/(auth)/invite/[id]/page.tsx` (new)

- If logged in: show invitation details + Accept/Reject buttons
- If not logged in: show Sign Up / Log In links with `?invite={id}` param
- On accept: `authClient.organization.acceptInvitation()` → set active org → redirect `/dashboard`

### 2.2 Modify signup page for invitation flow

**File:** `apps/web/src/app/(auth)/signup/page.tsx`

- Read `invite` query param from URL
- If `invite` present: hide "Business Name" field, skip org creation
- After signup: accept invitation → set active org → redirect

### 2.3 Modify login page for invitation flow

**File:** `apps/web/src/app/(auth)/login/page.tsx`

- Read `invite` query param from URL
- After login with invite param: accept invitation → set active org → redirect

---

## Phase 3: Team Settings Page

### 3.1 Add "Team" to settings nav

**File:** `apps/web/src/components/dashboard/settings/settings-nav.tsx`

- Add `{ label: "Team", href: "/settings/team", icon: IconUsersGroup }` to Organization group (between Business and Billing)

### 3.2 Create team route

**Files (new):**

- `apps/web/src/app/(dashboard)/settings/team/page.tsx` — server page
- `apps/web/src/app/(dashboard)/settings/team/team-settings-client.tsx` — client wrapper

Client wrapper:

- Fetches org data via `authClient.organization.getFullOrganization()`
- Gets current user role via `authClient.organization.getActiveMember()`
- Renders `<TeamMemberList>` + `<TeamPendingInvitations>` + invite button

### 3.3 Create team components

All in `apps/web/src/components/dashboard/settings/`:

#### `team-member-list.tsx` (new)

- `<SettingsSection>` wrapper with `IconUsersGroup` icon
- shadcn `<Table>` / `<TableHeader>` / `<TableBody>` / `<TableRow>` / `<TableHead>` / `<TableCell>` for member list
- shadcn `<Avatar>` / `<AvatarFallback>` for member avatars
- shadcn `<Badge>` via `<TeamRoleBadge>` for role display
- shadcn `<DropdownMenu>` / `<DropdownMenuContent>` / `<DropdownMenuItem>` for row actions (Change Role, Remove)
- shadcn `<Select>` / `<SelectTrigger>` / `<SelectContent>` / `<SelectItem>` for role change picker
- Reuses `<DeleteConfirmDialog>` from `components/reusable/` for remove confirmation
- Owner row protected (no remove/demote)
- Current user row shows "(you)" via `<Badge variant="secondary">`
- Reuses `<EmptyState>` from `components/reusable/` when no members

#### `team-invite-dialog.tsx` (new)

- shadcn `<Dialog>` / `<DialogContent>` / `<DialogHeader>` / `<DialogTitle>` / `<DialogFooter>`
- shadcn `<Input>` for email field
- shadcn `<Select>` for role picker (admin/member only, not owner)
- shadcn `<Label>` for form labels
- shadcn `<Button>` for submit/cancel
- Reuses `<SettingsFormMessage>` for success/error feedback
- Calls `authClient.organization.createInvitation()`

#### `team-pending-invitations.tsx` (new)

- `<SettingsSection>` wrapper with `IconMailForward` icon
- shadcn `<Table>` for invitation list: Email, Role (`<TeamRoleBadge>`), Sent, Expires, Cancel
- shadcn `<Button variant="ghost" size="icon">` for cancel action
- Reuses `<EmptyState>` when no pending invitations
- Reuses `<ConfirmActionDialog>` from `components/dashboard/reusable/` for cancel confirmation

#### `team-role-badge.tsx` (new) — REUSABLE

Wraps shadcn `<Badge>` with role→color mapping:

| Role | Style |
|------|-------|
| owner | `bg-brand-light text-brand` |
| admin | `bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300` |
| member | `bg-muted text-muted-foreground` |

Props: `{ role: string; className?: string }`

Used in: member list, pending invitations, invite dialog preview

---

## Reusable Components Summary

| Component | Location | Status |
|-----------|----------|--------|
| `<SettingsSection>` | `components/dashboard/settings/` | Existing — used by all settings pages |
| `<SettingsFormMessage>` | `components/dashboard/settings/` | Existing — success/error feedback |
| `<DeleteConfirmDialog>` | `components/reusable/` | Existing — remove member confirmation |
| `<ConfirmActionDialog>` | `components/dashboard/reusable/` | Existing — cancel invitation confirmation |
| `<EmptyState>` | `components/reusable/` | Existing — empty member/invitation states |
| `<TeamRoleBadge>` | `components/dashboard/settings/` | **New** — reusable role badge |
| `useOrgRole` | `hooks/` | **New** — reusable role hook for all pages |

## shadcn Components Used

`Table`, `Avatar`, `Badge`, `Button`, `Dialog`, `DropdownMenu`, `Select`, `Input`, `Label`, `Skeleton`, `Separator`, `Tooltip`

---

## Phase 4: Role-Based UI Visibility

### 4.1 Create `useOrgRole` hook

**File:** `apps/web/src/hooks/use-org-role.ts` (new)

- Calls `authClient.organization.getActiveMember()`
- Returns `{ role, isOwner, isAdmin, isMember, isLoading }`
- Caches in state

### 4.2 Make SettingsNav role-aware

**File:** `apps/web/src/components/dashboard/settings/settings-nav.tsx`

- Add optional `roles?: string[]` to `NavItem` interface
- Filter items based on `useOrgRole()`:

| Tab | Visible To |
|-----|------------|
| Profile | All |
| Business | Owner, Admin |
| Team | All (actions gated internally) |
| Billing | Owner |
| Invoices | All |
| Quotes | All |
| Bookings | All |

### 4.3 Gate sensitive UI actions

- Business settings form: disabled for members
- Team page: invite/remove/role buttons hidden for members

---

## Phase 5: Documentation

- Update `docs/project_docs/REPO_MAP.md` with all new files
- Update `docs/API_DOCUMENTATION.md` with team endpoints
- Update `docs/todo.md` — mark Team Management complete

---

## Critical Files

| File | Action |
|------|--------|
| `apps/api/src/lib/auth.ts` | Configure org plugin (roles, email hook) |
| `apps/api/src/lib/auth-middleware.ts` | Add `requireOrgRole()` middleware |
| `apps/api/src/lib/email.ts` | Create Resend email utility (new) |
| `packages/email/src/templates/invitation.tsx` | Invitation email template (new) |
| `apps/web/src/app/(auth)/invite/[id]/page.tsx` | Invitation acceptance page (new) |
| `apps/web/src/app/(auth)/signup/page.tsx` | Branch for invite-based signup |
| `apps/web/src/app/(auth)/login/page.tsx` | Handle invite param after login |
| `apps/web/src/app/(dashboard)/settings/team/` | Team settings route (new) |
| `apps/web/src/components/dashboard/settings/team-*.tsx` | Team components (4 new) |
| `apps/web/src/hooks/use-org-role.ts` | Role hook (new) |
| `apps/web/src/components/dashboard/settings/settings-nav.tsx` | Add Team tab + role filtering |

---

## Implementation Order

```
Phase 1 (Backend) — no frontend dependencies
  1.1 Configure Better Auth org plugin
  1.2 Create invitation email template
  1.3 Create email sending utility
  1.4 Add requireOrgRole middleware
  1.5 Apply role guards to routes
  1.6 Migration for existing member roles

Phase 2 (Invitation Flow) — depends on 1.1-1.3
  2.1 Create /invite/[id] acceptance page
  2.2 Modify signup page
  2.3 Modify login page

Phase 3 (Team UI) — depends on 1.1
  3.1 Add Team nav item
  3.2 Create team route page
  3.3 Create team components

Phase 4 (Role-Based UI) — depends on 3.x
  4.1 Create useOrgRole hook
  4.2 Make SettingsNav role-aware
  4.3 Gate sensitive UI actions

Phase 5 (Docs) — after all phases
```

---

## Verification

1. `pnpm typecheck` — no errors
2. Create a new org → creator has "owner" role in member table
3. Owner invites user via email → invitation email sent with correct link
4. New user clicks link → signs up → auto-joins org as invited role
5. Owner can change member roles, remove members
6. Member cannot see Billing/Business settings tabs
7. Member cannot access `/settings/business` directly (API returns 403)
8. Existing single-user tenants still work (migration sets them as owner)
9. Dark mode — all new components adapt correctly
