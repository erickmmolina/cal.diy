# Rollback plan — ibero/v6.2.0 patch (per-team email From override)

If the per-team email From override deployed in this branch causes any issue in production:

## Quick rollback (Docker image only)

1. In Elestio dashboard → service `ibero-cal` → "Update config" → Docker Compose tab.
2. Change the `image:` of the `calcom` service from:
   ```
   image: ghcr.io/erickmmolina/cal.diy:ibero-v6.2.0-fa59ffe
   ```
   back to:
   ```
   image: calcom/cal.com:${SOFTWARE_VERSION_TAG}
   ```
3. "Update & Restart". ETA 2-3 min.
4. The two new columns `Team.emailFromAddress` and `Team.emailFromName` remain in DB. The upstream image ignores them. **No data corruption.**

## Full rollback (also drop the Prisma columns)

Only needed if some hypothetical upstream change starts complaining about unknown columns (extremely unlikely with additive nullable columns).

```sql
ALTER TABLE "Team" DROP COLUMN "emailFromAddress";
ALTER TABLE "Team" DROP COLUMN "emailFromName";
```

Run from the Elestio web terminal:

```bash
docker exec $(docker ps -q -f name=database) psql -U postgres -d cal -c \
  'ALTER TABLE "Team" DROP COLUMN "emailFromAddress"; ALTER TABLE "Team" DROP COLUMN "emailFromName";'
```

## Env vars to remove if rolling back fully

- `ALLOWED_EMAIL_DOMAINS`
- (optional) revert `EMAIL_FROM`, `EMAIL_SERVER_USER`, `EMAIL_SERVER_PASSWORD` to their pre-patch values

## Restore from Elestio backup

Last resort. Elestio backup snapshot was taken on 2026-04-24 right before this deploy. Restore from `Backups` tab in the service dashboard.

## Verification after rollback

- `docker ps` shows the upstream image again (`calcom/cal.com:v6.2.0`).
- `https://cal.ibero.work/team/iberolegal/consulta-inicial` responds 200.
- Booking emails revert to the global `EMAIL_FROM` for all teams.

## Re-applying the patch later

If you rolled back temporarily and want to re-apply later:

1. Push any fix to the `ibero/v6.2.0` branch — CI builds a new GHCR image with `ibero-v6.2.0-<sha>`.
2. Bump the `image:` in Elestio docker-compose to the new tag.
3. Update & Restart.

The companion design and implementation plan documents live in the parent project repo:
- `docs/superpowers/specs/2026-04-24-cal-com-team-email-from-override-design.md`
- `docs/superpowers/plans/2026-04-24-cal-com-team-email-from-override.md`
