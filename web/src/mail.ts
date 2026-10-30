// Mail from kontakt@wpdigitalranger.com (Namecheap Private Email, SMTP). Sends only when the secret
// SMTP_PASSWORD is set; without it the pages fall back to a link the user forwards themselves.

export const ABSENDER = { name: "Jarvis · WP Digital Ranger", email: "kontakt@wpdigitalranger.com" };

export type Mail = { from: typeof ABSENDER; to: string; reply: typeof ABSENDER; subject: string; text: string };

/** Invitation to join a firm; plain text, no tracking. */
export function einladungsMail(an: string, firma: string, rolle: string, link: string): Mail {
  if (!/^[^@\s<>,;"]+@[^@\s<>,;"]+\.[a-z]{2,}$/i.test(an)) throw new Error("Ungültige Empfängeradresse");
  const name = firma.replace(/[\r\n]+/g, " ").trim().slice(0, 120);
  return {
    from: ABSENDER,
    to: an,
    reply: ABSENDER,
    subject: `Einladung zu Jarvis: ${name}`,
    text: `Hallo,

Sie wurden eingeladen, bei „${name}“ im Ausschreibungs-Alarm Jarvis mitzuarbeiten (Rolle: ${rolle}).

Einladung annehmen:
${link}

Der Link gilt 14 Tage und nur für diese E-Mail-Adresse. Sie melden sich ohne Passwort an, Jarvis schickt Ihnen dazu einen Anmelde-Link.

Wenn Sie diese Einladung nicht erwartet haben, können Sie diese Mail einfach löschen.

Viele Grüße
Jarvis · WP Digital Ranger
https://wpdigitalranger.com
`,
  };
}

export async function senden(env: { SMTP_PASSWORD?: string }, mail: Mail): Promise<void> {
  if (!env.SMTP_PASSWORD) throw new Error("Mailversand ist noch nicht eingerichtet");
  const { WorkerMailer } = await import("worker-mailer");
  await WorkerMailer.send(
    {
      host: "mail.privateemail.com",
      port: 465,
      secure: true,
      credentials: { username: ABSENDER.email, password: env.SMTP_PASSWORD.trim() },
      authType: ["plain", "login"],
      socketTimeoutMs: 30_000,
    },
    mail,
  );
}
