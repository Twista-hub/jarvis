// Turns one upload into a Steckbrief: files -> text (Workers AI) -> Claude -> ergebnis.md in R2.
import Anthropic from "@anthropic-ai/sdk";
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { unzipSync } from "fflate";
import ANLEITUNG from "../../alarm/steckbrief-anleitung.txt";
import profile from "../../alarm/profile.json";
import { baseName, bundle, mimeType, wanted, type Text } from "./bundle";
import type { Env, Job } from "./index";
import { loseLesen } from "./lose";

const MODEL = "claude-opus-5-5";
const PREIS = [4, 20]; // $ per million input / output tokens

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
        const typ = mimeType(f.name);
        if (typ.startsWith("text/") && typ !== "text/html") {
          texts.push({ name: f.name, text: new TextDecoder().decode(f.data) });
          continue;
        }
        try {
          const r = await this.env.AI.toMarkdown({ name: baseName(f.name), blob: new Blob([f.data], { type: typ }) });
          if (r.format === "error") ausgelassen.push(`${baseName(f.name)} (nicht lesbar)`);
          else texts.push({ name: f.name, text: r.data });
        } catch {
          ausgelassen.push(`${baseName(f.name)} (nicht lesbar)`);
        }
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
      const bekanntmachung = await (await this.env.DATEN.get(`${dir}/bekanntmachung.md`))?.text();
      const bisher = bekanntmachung
        ? `\n\nBisheriger Steckbrief aus der öffentlichen Bekanntmachung:\n${bekanntmachung}\n\n` +
          "WICHTIG: Schreibe EINEN Steckbrief aus beiden Quellen. Übernimm jede Angabe aus dem bisherigen Steckbrief " +
          "(Fristen, Eignung, Nachweise, Referenzen, Lose, Orte, Zuschlag), auch wenn sie in den Vergabeunterlagen fehlt. " +
          "Schreibe „nicht angegeben“ nur, wenn die Angabe in KEINER der beiden Quellen steht. Ergänze, was die Unterlagen zusätzlich " +
          "enthalten. Widersprechen sich die Quellen, nenne beide Angaben und welche Quelle was sagt; die Vergabeunterlagen sind meist " +
          "aktueller. Lass den Fußtext des bisherigen Steckbriefs weg."
        : "";
      const kunde = (profile as Record<string, { beschreibung: string }>)[job.profil] ?? { beschreibung: job.kunde || "Keine Firmenbeschreibung hinterlegt." };
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
            content: `Kunde:\n${kunde.beschreibung}\n\nAusschreibung (Angaben des Kunden):\n${job.titel || "nicht angegeben"}\n\nVergabeunterlagen:\n${dokumente}${bisher}`,
          }],
        })
        .finalMessage();
      const kosten = kostenVon(message.usage);
      if (message.stop_reason === "refusal") return { text: "", kosten, bekanntmachung: !!bekanntmachung };
      return { text: message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim(), kosten, bekanntmachung: !!bekanntmachung };
    });

    const fuss = `\n\n---\n_Automatisch erstellt von Jarvis aus ${lesen.gelesen} Dateien` +
      (ki.bekanntmachung ? " und der öffentlichen Bekanntmachung" : "") +
      (lesen.ausgelassen.length ? ` (nicht gelesen: ${lesen.ausgelassen.join(", ")})` : "") +
      `. Ohne Gewähr, vor dem Angebot bitte die Originalunterlagen prüfen._\n`;
    // Lots, quantities, workforce and wage group for the calculation form; read from the Steckbrief only, so it is cheap.
    // Saved before the Steckbrief, because the result page appears as soon as ergebnis.md exists.
    const lose = ki.text
      ? await step.do("Lose erfassen", { retries: { limit: 2, delay: "10 seconds" } }, async () => {
          const { lose, kosten } = await loseLesen(this.client(), ki.text);
          await this.env.DATEN.put(`${dir}/lose.json`, JSON.stringify(lose));
          return { anzahl: lose.length, kosten };
        })
      : { anzahl: 0, kosten: 0 };
    await step.do("Ergebnis speichern", async () => {
      await this.speichern(dir, (ki.text || "# Kein Steckbrief\n\nDie KI hat diese Unterlagen abgelehnt.") + fuss);
      await this.env.DATEN.delete(`${dir}/text.md`);
    });

    return { ...lesen, kosten: ki.kosten + lose.kosten, lose: lose.anzahl };
  }

  private client() {
    return new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY });
  }

  private async speichern(dir: string, markdown: string) {
    await this.env.DATEN.put(`${dir}/ergebnis.md`, markdown, { httpMetadata: { contentType: "text/markdown; charset=utf-8" } });
  }
}
