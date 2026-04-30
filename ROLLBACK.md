# Rollback plan — ibero/v6.2.0 patches

This branch carries two patch sets on top of upstream `v6.2.0`:

1. **Per-team email From override** (commits `ca70118` → `c0507b2`).
2. **EE license bypass** (commit `1c4a577`, 2026-04-29) — `NoopLicenseKeyService.checkLicense()` returns `true` to unlock Teams Members, SSO, Insights, Workflows, Routing Forms, and Organizations gates without a license key.

Tag activo en producción a 2026-04-29: `ibero-v6.2.0-1c4a577`.

If any patch causes issues in production, follow the rollback flow below.

## Quick rollback (Docker image only)

1. In Elestio dashboard → service `ibero-cal` → "Update config" → Docker Compose tab.
2. Change the `image:` of the `calcom` service from:
   ```
   image: ghcr.io/erickmmolina/cal.diy:ibero-v6.2.0-1c4a577
   ```
   back to either:
   ```
   image: ghcr.io/erickmmolina/cal.diy:ibero-v6.2.0-fa59ffe   # email From only, no license bypass
   ```
   or fully back to upstream:
   ```
   image: calcom/cal.com:${SOFTWARE_VERSION_TAG}
   ```
3. "Update & Restart". ETA 2-3 min.
4. The two new columns `Team.emailFromAddress` and `Team.emailFromName` remain in DB. The upstream image ignores them. **No data corruption.**

## Rolling back ONLY the license bypass

If the email From override is fine but you want EE features re-locked (e.g. you bought a real license and want upstream behaviour):

1. Cambia el tag en Elestio a `ibero-v6.2.0-fa59ffe` (still has email From, no license bypass).
2. Setea `CALCOM_LICENSE_KEY` con la key real en las ENV del servicio.
3. Restart. La instancia validará contra `CALCOM_PRIVATE_API_ROUTE` igual que upstream.

Datos en la DB no se ven afectados — el patch de licencia solo cambia un return value en código.

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
