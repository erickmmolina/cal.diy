# Upgrade runbook — `ibero/v6.2.0` → newer Cal.com release

This branch carries 7 patch commits on top of upstream `v6.2.0`. When a newer Cal.com release ships and you want to take it, follow this runbook.

## How you'll know there's a new release

1. **GitHub Watch (manual):** in the upstream repo, click `Watch` → `Custom` → tick **Releases** only. Saves the noise of issues/PRs but you get an email/notification when a new tag is cut.
   - Direct link: https://github.com/calcom/cal.diy
2. **Automated watcher (already in this fork):** the workflow `.github/workflows/upstream-watch.yml` runs daily and opens an issue in this fork when upstream has a tag newer than the latest `ibero/*` branch. The issue title is `chore(upstream): new Cal.com release v<X.Y.Z> available`.
3. **RSS:** subscribe to `https://github.com/calcom/cal.diy/releases.atom` from any feed reader.

## Decide whether to upgrade

Not every release is worth taking. Read the upstream changelog and decide based on:

- **Security fixes** → upgrade soon (within a week).
- **Bug fixes that affect your team** → opportunistic.
- **Major version bump** (e.g. v6 → v7) → spike first, may break the patch and require schema migration plan.
- **Minor cosmetic / unrelated features** → skip if your patch ages well.

The patch in this branch touches:

- `packages/prisma/schema.prisma` (Team model)
- `packages/prisma/migrations/<timestamp>_team_email_from/`
- `packages/emails/lib/resolveTeamEmailFrom.ts` + tests
- `packages/emails/templates/_base-email.ts` + tests
- 7 booking templates (`organizer-scheduled-email.ts`, `attendee-scheduled-email.ts`, `broken-integration-email.ts`, 4 video download recording/transcript variants)
- `packages/lib/validateEmailFromDomain.ts` + tests
- `packages/trpc/server/routers/viewer/teams/update.handler.ts` + `update.schema.ts`
- `apps/web/modules/ee/teams/views/team-profile-view.tsx`
- `packages/features/ee/teams/lib/queries.ts`

Conflicts on a rebase will most likely happen in `_base-email.ts`, `team-profile-view.tsx`, and `update.handler.ts` if upstream restructures those files.

## Rebase procedure

```bash
cd /Users/erickmolina/CascadeProjects/cal-ibero

# 1. Update remotes
git fetch upstream --tags

# 2. Find the new tag you want to take. Replace <NEW_TAG> below (e.g. v6.3.0).
git log --oneline upstream/main -- packages/emails/templates/_base-email.ts | head

# 3. Create a rebase branch from the new tag.
git checkout -b ibero/<NEW_TAG> <NEW_TAG>

# 4. Cherry-pick our 7 feature commits in order (skip the doc commits if you don't want them on the new branch — they live on the old branch already).
#    Replace the SHAs with the actual ones from `git log ibero/v6.2.0`. Order matters.
git cherry-pick \
  ca701186d0 \  # feat(prisma): add emailFromAddress and emailFromName to Team
  9e082e7c72 \  # feat(emails): add resolveTeamEmailFrom helper with TTL cache
  4d8e0b504c \  # feat(emails): apply per-team From override in BaseEmail.sendEmail
  22ba980d23 \  # feat(emails): propagate teamId from calEvent to BaseEmail
  0bb99201ca \  # feat(trpc): validate and persist emailFromAddress/Name on Team update
  c0507b2893 \  # feat(settings): expose Team emailFrom fields in admin UI
  fa59ffe97f    # ci: build and publish ibero Docker image to GHCR

# 5. Resolve conflicts as they come up. Common scenarios:
#    - schema.prisma: keep our two new fields after `bannerUrl`. If upstream renamed/moved Team, place them in the equivalent location.
#    - _base-email.ts: keep the `protected teamId` and the `if (this.teamId != null)` block. If upstream changed the payload construction, keep the override block immediately before `createTransport(...)`.
#    - update.handler.ts: the validator call must run BEFORE prisma.team.update; the cache invalidation must run AFTER. The data passed to update must include the two new fields.
#    - team-profile-view.tsx: keep the two Controllers. If upstream renamed the form lib, adjust to its new API.

# 6. Run tests after the rebase.
~/.local/bin/yarn install --immutable
/usr/local/bin/node node_modules/.bin/vitest run packages/emails packages/lib/validateEmailFromDomain.test.ts packages/trpc/server/routers/viewer/teams

# 7. Push the new branch.
git push origin ibero/<NEW_TAG>
```

## What CI will do automatically

When you push to a branch matching `ibero/**`, the workflow `.github/workflows/ibero-build.yml` runs:

- Builds Docker image
- Tags it `ghcr.io/erickmmolina/cal.diy:ibero-<NEW_TAG>-<short-sha>`
- Pushes to GHCR

Wait for the green check on the Actions tab before deploying.

## Deploy the upgrade in Elestio

**1. Backup first** (Elestio dashboard → service `ibero-cal` → Backups → "Create manual backup").

**2.** In the same dashboard → Update config → Docker Compose → change the `image:` of the `calcom` service to the new tag:
```
image: ghcr.io/erickmmolina/cal.diy:ibero-<NEW_TAG>-<sha>
```

**3.** Update & Restart. Docker pulls the new image (1-3 min on the same host) and reapplies any new Prisma migrations automatically.

**4. Verify after restart:**

```bash
# In the Elestio web terminal:
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep calcom
docker exec $(docker ps -q -f name=database) psql -U postgres -d cal -c '\d "Team"' | grep -i emailFrom
```

**5. Smoke-test** with one real booking on `cal.ibero.work/team/iberolegal/consulta-inicial?lang=es`. The From should still be `Mónica de Iberolegal <monica@ibero.legal>` and headers should pass `spf/dkim/dmarc`.

## If the rebase becomes too painful

Small patch like this one usually rebases cleanly. If a major upstream refactor breaks the cherry-picks (e.g. `_base-email.ts` was rewritten), step back and:

1. Re-apply the change as a **fresh patch** rather than a cherry-pick: read the new `_base-email.ts`, identify the equivalent interception point, and patch it manually.
2. Update the spec at `docs/superpowers/specs/2026-04-24-cal-com-team-email-from-override-design.md` (in the parent repo) with a new "Maintenance — Upstream version <NEW_TAG>" section noting what changed and why.
3. Bump the spec/plan filenames if it's substantial enough.

If a major version (v7+) lands and the patch can't be carried, options:

- Stay on `ibero/v6.2.0` as long as upstream doesn't push critical security fixes.
- Or push to upstream a PR to add the feature natively, eliminating the fork.
