// Reads the lots of a Steckbrief with quantities, the workforce each lot needs and the suggested wage group
// of the collective agreement (GVP/DGB). Cheap call on the finished Steckbrief only: Haiku 5.5 at effort low
// (a simple extraction; Haiku has no server-side refusal fallback, a decline just leaves the lots empty).
import type Anthropic from "@anthropic-ai/sdk";
import type { Los } from "./kalkulation.ts";
import { GVP } from "./tarife.ts";

const MODEL = "claude-haiku-5-5";
const PREIS = [0.1, 0.5]; // $ per million input / output tokens (prompts up to 100K tokens)

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

export async function loseLesen(client: Anthropic, steckbrief: string): Promise<{ lose: Los[]; kosten: number }> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: "low", format: { type: "json_schema", schema: LOSE_SCHEMA } },
    system: LOSE_ANLEITUNG,
    messages: [{ role: "user", content: steckbrief }],
  });
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const lose = message.stop_reason === "refusal" ? [] : (JSON.parse(text).lose as Los[]);
  const u = message.usage;
  const eingabe = u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  return { lose, kosten: (eingabe * PREIS[0] + u.output_tokens * PREIS[1]) / 1e6 };
}
