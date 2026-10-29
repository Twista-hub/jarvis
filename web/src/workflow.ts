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
      const client = new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY });
      const message = await client.beta.messages
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
      const u = message.usage;
      const eingabe = u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
      const kosten = (eingabe * PREIS[0] + u.output_tokens * PREIS[1]) / 1e6;
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
    return { ...lesen, kosten: ki.kosten };
  }

  private async speichern(dir: string, markdown: string) {
    await this.env.DATEN.put(`${dir}/ergebnis.md`, markdown, { httpMetadata: { contentType: "text/markdown; charset=utf-8" } });
  }
}
