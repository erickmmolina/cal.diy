import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@calcom/prisma", () => ({
  prisma: {
    team: { findUnique: vi.fn() },
  },
}));

const sendMailMock = vi.fn((payload, cb) => cb(null, { ok: true }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
  createTransport: () => ({ sendMail: sendMailMock }),
}));

vi.mock("@calcom/features/flags/features.repository", () => ({
  FeaturesRepository: class {
    async checkIfFeatureIsEnabledGlobally() { return false; }
  },
}));

vi.mock("@calcom/lib/serverConfig", () => ({
  serverConfig: {
    transport: { sendmail: true },
    from: "Default <default@example.com>",
    headers: {},
  },
}));

vi.mock("@calcom/lib/isSmsCalEmail", () => ({
  default: () => false,
}));

import { prisma } from "@calcom/prisma";
import BaseEmail from "./_base-email";
import { _invalidateTeamEmailFromCache } from "../lib/resolveTeamEmailFrom";

const findUniqueMock = prisma.team.findUnique as unknown as ReturnType<typeof vi.fn>;

class FakeEmail extends BaseEmail {
  constructor(teamId: number | null = null) {
    super();
    this.teamId = teamId;
  }
  protected async getNodeMailerPayload() {
    return {
      from: "Default <default@example.com>",
      to: "test@example.com",
      subject: "Hola",
      html: "<p>Hola</p>",
    };
  }
}

describe("BaseEmail with teamId override", () => {
  const originalIntegrationTestMode = process.env.INTEGRATION_TEST_MODE;

  beforeEach(() => {
    // Disable integration test mode so sendEmail() reaches the nodemailer path
    process.env.INTEGRATION_TEST_MODE = "false";
    _invalidateTeamEmailFromCache();
    sendMailMock.mockClear();
    findUniqueMock.mockReset();
  });

  afterEach(() => {
    process.env.INTEGRATION_TEST_MODE = originalIntegrationTestMode;
  });

  it("uses global from when teamId is null", async () => {
    await new FakeEmail(null).sendEmail();
    expect(sendMailMock).toHaveBeenCalled();
    expect(sendMailMock.mock.calls[0][0].from).toBe("Default <default@example.com>");
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("uses team override when teamId maps to configured team", async () => {
    findUniqueMock.mockResolvedValue({
      emailFromAddress: "noreply@ibero.legal",
      emailFromName: "Iberolegal",
    });
    await new FakeEmail(1).sendEmail();
    expect(sendMailMock.mock.calls[0][0].from).toContain("Iberolegal");
    expect(sendMailMock.mock.calls[0][0].from).toContain("noreply@ibero.legal");
  });

  it("falls back to global when team has no override", async () => {
    findUniqueMock.mockResolvedValue({ emailFromAddress: null, emailFromName: null });
    await new FakeEmail(1).sendEmail();
    expect(sendMailMock.mock.calls[0][0].from).toBe("Default <default@example.com>");
  });

  it("falls back to global when Prisma throws", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    findUniqueMock.mockRejectedValue(new Error("db down"));
    await new FakeEmail(1).sendEmail();
    expect(sendMailMock.mock.calls[0][0].from).toBe("Default <default@example.com>");
    errSpy.mockRestore();
  });
});
