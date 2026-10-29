// Turns one upload into a Steckbrief: files -> text (Workers AI) -> Claude -> ergebnis.md in R2.
import Anthropic from "@anthropic-ai/sdk";
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { unzipSync } from "fflate";
import ANLEITUNG from "../../alarm/steckbrief-anleitung.txt";
import profile from "../../alarm/profile.json";
import { baseName, bundle, wanted, type Text } from "./bundle";
import type { Env, Job } from "./index";

const MODEL = "claude-opus-5-5";
const PREIS = [4, 20]; // $ per million input / output tokens

const LOSE_SCHEMA = {
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
        },
        required: ["nr", "name", "menge", "einheit", "zeitraum", "hinweis"],
        additionalProperties: false,
      },
    },
  },
  required: ["lose"],
  additionalProperties: false,
};

function kostenVon(u: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }) {
  const eingabe = u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
  return (eingabe * PREIS[0] + u.output_tokens * PREIS[1]) / 1e6;
}

export class Steckbrief extends WorkflowEntrypoint<Env, Job> {
  async run(event: Readonly<WorkflowEvent<Job>>, step: WorkflowStep) {
    const job = event.payload;
    const dir = `auftraege/${job.id}`;

    const lesen = await step.do("Unterlagen lesen", async () => {
      const files: { name: string; data: Uint8Array }[] = [];
      for (const obj of (await this.env.DATEN.list({ prefix: `${dir}/dateien/` })).objects) {
        const data = new Uint8Array(await (await this.env.DATEN.get(obj.key))!.arrayBuffer());
        const name = obj.key.slice(`${dir}/dateien/`.length);
        if (/\.zip$/i.test(name)) {
          for (const [inner, bytes] of Object.entries(unzipSync(data))) files.push({ name: `${name}/${inner}`, data: bytes });
        } else {
          files.push({ name, data });
        }
      }
      const texts: Text[] = [];
      const ausgelassen: string[] = [];
      for (const f of files) {
        if (!wanted(f.name)) {
          if (!f.name.endsWith("/")) ausgelassen.push(baseName(f.name));
          continue;
        }
        const r = await this.env.AI.toMarkdown({ name: baseName(f.name), blob: new Blob([f.data]) });
        if (r.format === "error") ausgelassen.push(`${baseName(f.name)} (nicht lesbar)`);
        else texts.push({ name: f.name, text: r.data });
      }
      const { text, skipped } = bundle(texts);
      await this.env.DATEN.put(`${dir}/text.md`, text);
      return { gelesen: texts.length, ausgelassen: [...ausgelassen, ...skipped], zeichen: text.length };
    });

    if (!lesen.zeichen) {
      await this.speichern(dir, "# Keine lesbaren Unterlagen\n\nIn den hochgeladenen Dateien war kein Text zu finden. Bitte PDF, Word oder Excel hochladen (keine eingescannten Bilder).");
      return lesen;
    }

    const ki = await step.do("Steckbrief schreiben", { retries: { limit: 2, delay: "30 seconds" }, timeout: "15 minutes" }, async () => {
      const dokumente = await (await this.env.DATEN.get(`${dir}/text.md`))!.text();
      const kunde = (profile as Record<string, { beschreibung: string }>)[job.profil];
      const message = await this.client().beta.messages
        .stream({
          model: MODEL,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          max_tokens: 32000,
          output_config: { effort: "medium" },
          system: ANLEITUNG,
          messages: [{
            role: "user",
            content: `Kunde:\n${kunde.beschreibung}\n\nAusschreibung (Angaben des Kunden):\n${job.titel || "nicht angegeben"}\n\nVergabeunterlagen:\n${dokumente}`,
          }],
        })
        .finalMessage();
      const kosten = kostenVon(message.usage);
      if (message.stop_reason === "refusal") return { text: "", kosten };
      return { text: message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim(), kosten };
    });

    const fuss = `\n\n---\n_Automatisch erstellt von Jarvis aus ${lesen.gelesen} Dateien` +
      (lesen.ausgelassen.length ? ` (nicht gelesen: ${lesen.ausgelassen.join(", ")})` : "") +
      `. Ohne Gewähr, vor dem Angebot bitte die Originalunterlagen prüfen._\n`;
    await step.do("Ergebnis speichern", async () => {
      await this.speichern(dir, (ki.text || "# Kein Steckbrief\n\nDie KI hat diese Unterlagen abgelehnt.") + fuss);
      await this.env.DATEN.delete(`${dir}/text.md`);
    });

    // Lots and quantities for the calculation form; read from the Steckbrief only, so it is cheap.
    const lose = ki.text
      ? await step.do("Lose erfassen", { retries: { limit: 2, delay: "10 seconds" } }, async () => {
          const message = await this.client().beta.messages.create({
            model: MODEL,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            max_tokens: 8000,
            output_config: { effort: "low", format: { type: "json_schema", schema: LOSE_SCHEMA } },
            system: "Lies aus dem Steckbrief die Lose bzw. Leistungen mit ihren Mengen. menge: Zahl (Stunden pro Jahr oder Gesamt, wie angegeben; 0, wenn unbekannt). einheit: z. B. Stunden, Tage, Stück, pauschal. zeitraum: z. B. pro Jahr oder Laufzeit. Gibt es keine Lose, nimm die ganze Leistung als ein Los.",
            messages: [{ role: "user", content: ki.text }],
          });
          const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
          const lose = message.stop_reason === "refusal" ? [] : (JSON.parse(text).lose as unknown[]);
          await this.env.DATEN.put(`${dir}/lose.json`, JSON.stringify(lose));
          return { anzahl: lose.length, kosten: kostenVon(message.usage) };
        })
      : { anzahl: 0, kosten: 0 };
    return { ...lesen, kosten: ki.kosten + lose.kosten, lose: lose.anzahl };
  }

  private client() {
    return new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY });
  }

  private async speichern(dir: string, markdown: string) {
    await this.env.DATEN.put(`${dir}/ergebnis.md`, markdown, { httpMetadata: { contentType: "text/markdown; charset=utf-8" } });
  }
}
