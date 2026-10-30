// Reads the lots of a Steckbrief with quantities, the workforce each lot needs and the suggested wage group
// of the collective agreement (GVP/DGB). Cheap call (effort low) on the finished Steckbrief only.
import type Anthropic from "@anthropic-ai/sdk";
import type { Los } from "./kalkulation.ts";
import { GVP } from "./tarife.ts";

const MODEL = "claude-opus-5-5";

export const LOSE_SCHEMA = {
  type: "object",
  properties: {
    lose: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nr: { type: "string" },
          name: { type: "string" },
          menge: { type: "number" },
          einheit: { type: "string" },
          zeitraum: { type: "string" },
          hinweis: { type: "string" },
          taetigkeit: { type: "string" },
          eg: { type: "string", enum: ["", ...GVP.gruppen] },
          eg_grund: { type: "string" },
        },
        required: ["nr", "name", "menge", "einheit", "zeitraum", "hinweis", "taetigkeit", "eg", "eg_grund"],
        additionalProperties: false,
      },
    },
  },
  required: ["lose"],
  additionalProperties: false,
};

export const LOSE_ANLEITUNG = `Lies aus dem Steckbrief die Lose bzw. Leistungen mit ihren Mengen. Gibt es keine Lose, nimm die ganze Leistung als ein Los.
- menge: Zahl (Stunden pro Jahr oder Gesamt, wie angegeben; 0, wenn unbekannt). einheit: z. B. Stunden, Tage, Stück, pauschal. zeitraum: z. B. pro Jahr oder Laufzeit.
- taetigkeit: welche Arbeitskraft das Los braucht, kurz und konkret, mit geforderter Ausbildung oder Erfahrung, wenn genannt (z. B. "Servicekraft Bankett, Erfahrung in der Gastronomie" oder "Koch/Köchin mit abgeschlossener Ausbildung"). Mehrere Arbeitskräfte mit Komma trennen.
- eg: Entgeltgruppe nach dem ${GVP.rahmen} für die überwiegende Tätigkeit. Maßgeblich ist allein, was die Tätigkeit erfordert:
${GVP.gruppen.map((g) => `  EG ${g}: ${GVP.merkmale[g]}`).join("\n")}
  Leer lassen, wenn es keine Personalleistung ist oder die Unterlagen zu wenig sagen.
- eg_grund: ein kurzer Satz, warum diese Entgeltgruppe (welche Anforderung aus den Unterlagen).`;

export async function loseLesen(client: Anthropic, steckbrief: string): Promise<{ lose: Los[]; usage: Anthropic.Beta.BetaUsage }> {
  const message = await client.beta.messages.create({
    model: MODEL,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    max_tokens: 8000,
    output_config: { effort: "low", format: { type: "json_schema", schema: LOSE_SCHEMA } },
    system: LOSE_ANLEITUNG,
    messages: [{ role: "user", content: steckbrief }],
  });
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const lose = message.stop_reason === "refusal" ? [] : (JSON.parse(text).lose as Los[]);
  return { lose, usage: message.usage };
}
