import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@calcom/prisma", () => ({
  prisma: {
    team: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@calcom/prisma";

import {
  _invalidateTeamEmailFromCache,
  resolveTeamEmailFrom,
} from "./resolveTeamEmailFrom";

const findUniqueMock = prisma.team.findUnique as unknown as ReturnType<typeof vi.fn>;

describe("resolveTeamEmailFrom", () => {
  beforeEach(() => {
    _invalidateTeamEmailFromCache();
    findUniqueMock.mockReset();
  });

  it("returns null when team does not exist", async () => {
    findUniqueMock.mockResolvedValue(null);
    const result = await resolveTeamEmailFrom(999);
    expect(result).toBeNull();
  });

  it("returns null when team exists but both fields are null", async () => {
    findUniqueMock.mockResolvedValue({ emailFromAddress: null, emailFromName: null });
    const result = await resolveTeamEmailFrom(1);
    expect(result).toBeNull();
  });

  it("returns null when only address is set (name missing)", async () => {
    findUniqueMock.mockResolvedValue({ emailFromAddress: "noreply@ibero.legal", emailFromName: null });
    const result = await resolveTeamEmailFrom(1);
    expect(result).toBeNull();
  });

  it("returns name + address when both are set", async () => {
    findUniqueMock.mockResolvedValue({
      emailFromAddress: "noreply@ibero.legal",
      emailFromName: "Iberolegal",
    });
    const result = await resolveTeamEmailFrom(1);
    expect(result).toEqual({ name: "Iberolegal", address: "noreply@ibero.legal" });
  });

  it("returns null and logs error when Prisma throws", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    findUniqueMock.mockRejectedValue(new Error("boom"));
    const result = await resolveTeamEmailFrom(1);
    expect(result).toBeNull();
    expect(errSpy).toHaveBeenCalledWith("[emailFromResolver]", expect.any(Error));
    errSpy.mockRestore();
  });

  it("caches results within TTL", async () => {
    findUniqueMock.mockResolvedValue({
      emailFromAddress: "noreply@ibero.legal",
      emailFromName: "Iberolegal",
    });
    await resolveTeamEmailFrom(1);
    await resolveTeamEmailFrom(1);
    expect(findUniqueMock).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after cache invalidation", async () => {
    findUniqueMock.mockResolvedValue({
      emailFromAddress: "noreply@ibero.legal",
      emailFromName: "Iberolegal",
    });
    await resolveTeamEmailFrom(1);
    _invalidateTeamEmailFromCache(1);
    await resolveTeamEmailFrom(1);
    expect(findUniqueMock).toHaveBeenCalledTimes(2);
  });
});
