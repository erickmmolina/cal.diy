export class EmailFromDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailFromDomainError";
  }
}

export function validateEmailFromAddress(address: string | null | undefined) {
  if (!address) return;
  const allowed = (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return; // si no está configurado, no bloqueamos
  const domain = address.split("@")[1]?.toLowerCase();
  if (!domain || !allowed.includes(domain)) {
    throw new EmailFromDomainError(
      `Dominio no autorizado para emailFromAddress. Permitidos: ${allowed.join(", ")}`
    );
  }
}
