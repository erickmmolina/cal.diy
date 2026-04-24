import { prisma } from "@calcom/prisma";

type Override = { name: string; address: string };

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 100;
const cache = new Map<number, { value: Override | null; expiresAt: number }>();

export async function resolveTeamEmailFrom(teamId: number): Promise<Override | null> {
  const now = Date.now();
  const hit = cache.get(teamId);
  if (hit && hit.expiresAt > now) return hit.value;

  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { emailFromAddress: true, emailFromName: true },
    });
    const value: Override | null =
      team?.emailFromAddress && team?.emailFromName
        ? { name: team.emailFromName, address: team.emailFromAddress }
        : null;

    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(teamId, { value, expiresAt: now + CACHE_TTL_MS });
    return value;
  } catch (err) {
    console.error("[emailFromResolver]", err);
    return null;
  }
}

export function _invalidateTeamEmailFromCache(teamId?: number) {
  if (teamId !== undefined) cache.delete(teamId);
  else cache.clear();
}
