// Rendiconto.tsx
import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Card, PrimaryButton, SecondaryButton } from "../components/ui";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

type Movimento = {
  id: string;
  annualita_id: string;
  tipologia:
    | "ENTRATA"
    | "USCITA"
    | "AVANZO_CASSA_T_1"
    | "AVANZO_BANCA_T_1"
    | string;
  macro: string | null;
  descrizione_code: number | null;
  descrizione_label?: string | null;
  importo: any;
  iva: any;
  conto?: string | null;
};

type AnnualitaRow = {
  id: string;
  anno: number;
};

type RendicontoValues = Record<string, number>;

function num(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  let s = String(v).trim();
  if (!s) return 0;

  s = s.replace(/\s/g, "");

  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function lordo(m: Movimento): number {
  return num(m.importo) + num(m.iva);
}

function euro(v: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(v || 0);
}

function sumBy(
  movs: Movimento[],
  predicate: (m: Movimento) => boolean,
): number {
  return movs.filter(predicate).reduce((acc, m) => acc + lordo(m), 0);
}

function buildValues(movs: Movimento[]): RendicontoValues {
  const v: RendicontoValues = {};

  // A) ATTIVITÀ DI INTERESSE GENERALE
  v.A_U_1 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" && m.macro === "AIG" && m.descrizione_code === 1,
  );
  v.A_U_2 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" && m.macro === "AIG" && m.descrizione_code === 2,
  );
  v.A_U_3 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" && m.macro === "AIG" && m.descrizione_code === 3,
  );
  v.A_U_4 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" && m.macro === "AIG" && m.descrizione_code === 4,
  );
  v.A_U_5 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" && m.macro === "AIG" && m.descrizione_code === 5,
  );
  v.A_U_TOT = v.A_U_1 + v.A_U_2 + v.A_U_3 + v.A_U_4 + v.A_U_5;

  v.A_E_1 = sumBy(
    movs,
    (m) => m.tipologia === "ENTRATA" && m.macro === "QUOTE_ASSOCIATIVE",
  );
  v.A_E_2 = 0;
  v.A_E_3 = 0;
  v.A_E_4 = sumBy(
    movs,
    (m) => m.tipologia === "ENTRATA" && m.macro === "EROGAZIONI_LIBERALI",
  );
  v.A_E_5 = sumBy(
    movs,
    (m) => m.tipologia === "ENTRATA" && m.macro === "PROVENTI_5X1000",
  );
  v.A_E_6 = 0;
  v.A_E_7 = sumBy(movs, (m) => m.tipologia === "ENTRATA" && m.macro === "AIG");
  v.A_E_8 = sumBy(
    movs,
    (m) =>
      m.tipologia === "ENTRATA" &&
      m.macro === "CONTRIBUTI_PA_SENZA_CORRISPETTIVO",
  );
  v.A_E_9 = 0;
  v.A_E_10 = sumBy(
    movs,
    (m) =>
      m.tipologia === "ENTRATA" && m.macro === "ALTRI_PROVENTI_NON_COMMERCIALI",
  );

  v.A_E_TOT =
    v.A_E_1 +
    v.A_E_2 +
    v.A_E_3 +
    v.A_E_4 +
    v.A_E_5 +
    v.A_E_6 +
    v.A_E_7 +
    v.A_E_8 +
    v.A_E_9 +
    v.A_E_10;

  v.A_AVANZO = v.A_E_TOT - v.A_U_TOT;

  // B) ATTIVITÀ DIVERSE
  v.B_U_1 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" &&
      m.macro === "ATTIVITA_DIVERSE" &&
      m.descrizione_code === 1,
  );
  v.B_U_2 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" &&
      m.macro === "ATTIVITA_DIVERSE" &&
      m.descrizione_code === 2,
  );
  v.B_U_3 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" &&
      m.macro === "ATTIVITA_DIVERSE" &&
      m.descrizione_code === 3,
  );
  v.B_U_4 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" &&
      m.macro === "ATTIVITA_DIVERSE" &&
      m.descrizione_code === 4,
  );
  v.B_U_5 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" &&
      m.macro === "ATTIVITA_DIVERSE" &&
      (m.descrizione_code === 5 ||
        m.descrizione_code === 6 ||
        m.descrizione_code === 7),
  );
  v.B_U_TOT = v.B_U_1 + v.B_U_2 + v.B_U_3 + v.B_U_4 + v.B_U_5;

  v.B_E_1 = sumBy(
    movs,
    (m) =>
      m.tipologia === "ENTRATA" &&
      m.macro === "ATTIVITA_DIVERSE" &&
      m.descrizione_code === 1,
  );
  v.B_E_2 = sumBy(
    movs,
    (m) =>
      m.tipologia === "ENTRATA" &&
      m.macro === "ATTIVITA_DIVERSE" &&
      m.descrizione_code === 2,
  );

  // codice 6 = sponsorizzazioni -> confluisce in Prestazioni e cessioni a terzi
  v.B_E_3 = sumBy(
    movs,
    (m) =>
      m.tipologia === "ENTRATA" &&
      m.macro === "ATTIVITA_DIVERSE" &&
      (m.descrizione_code === 3 || m.descrizione_code === 6),
  );

  v.B_E_4 = sumBy(
    movs,
    (m) =>
      m.tipologia === "ENTRATA" &&
      m.macro === "ATTIVITA_DIVERSE" &&
      m.descrizione_code === 4,
  );
  v.B_E_5 = sumBy(
    movs,
    (m) =>
      m.tipologia === "ENTRATA" &&
      m.macro === "ATTIVITA_DIVERSE" &&
      m.descrizione_code === 5,
  );

  // qui resta solo il codice 7 per evitare doppio conteggio
  v.B_E_6 = sumBy(
    movs,
    (m) =>
      m.tipologia === "ENTRATA" &&
      m.macro === "ATTIVITA_DIVERSE" &&
      m.descrizione_code === 7,
  );

  v.B_E_TOT = v.B_E_1 + v.B_E_2 + v.B_E_3 + v.B_E_4 + v.B_E_5 + v.B_E_6;
  v.B_AVANZO = v.B_E_TOT - v.B_U_TOT;

  // C) RACCOLTE FONDI
  v.C_U_1 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" &&
      m.macro === "RACCOLTE_FONDI" &&
      m.descrizione_code === 1,
  );
  v.C_U_2 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" &&
      m.macro === "RACCOLTE_FONDI" &&
      m.descrizione_code === 2,
  );
  v.C_U_3 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" &&
      m.macro === "RACCOLTE_FONDI" &&
      (m.descrizione_code === 3 ||
        m.descrizione_code === 4 ||
        m.descrizione_code === 5),
  );
  v.C_U_TOT = v.C_U_1 + v.C_U_2 + v.C_U_3;

  v.C_E_1 = sumBy(
    movs,
    (m) =>
      m.tipologia === "ENTRATA" &&
      m.macro === "RACCOLTE_FONDI" &&
      m.descrizione_code === 1,
  );
  v.C_E_2 = sumBy(
    movs,
    (m) =>
      m.tipologia === "ENTRATA" &&
      m.macro === "RACCOLTE_FONDI" &&
      m.descrizione_code === 2,
  );
  v.C_E_3 = sumBy(
    movs,
    (m) =>
      m.tipologia === "ENTRATA" &&
      m.macro === "RACCOLTE_FONDI" &&
      (m.descrizione_code === 3 ||
        m.descrizione_code === 4 ||
        m.descrizione_code === 5),
  );
  v.C_E_TOT = v.C_E_1 + v.C_E_2 + v.C_E_3;
  v.C_AVANZO = v.C_E_TOT - v.C_U_TOT;

  // D) FINANZIARIE / PATRIMONIALI
  v.D_U_1 = 0;
  v.D_U_2 = 0;
  v.D_U_3 = 0;
  v.D_U_4 = 0;
  v.D_U_5 = 0;
  v.D_U_TOT = 0;

  v.D_E_1 = 0;
  v.D_E_2 = 0;
  v.D_E_3 = 0;
  v.D_E_4 = 0;
  v.D_E_5 = 0;
  v.D_E_TOT = 0;
  v.D_AVANZO = 0;

  // E) SUPPORTO GENERALE
  v.E_U_1 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" &&
      m.macro === "COSTI_GENERALI" &&
      m.descrizione_code === 1,
  );
  v.E_U_2 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" &&
      m.macro === "COSTI_GENERALI" &&
      m.descrizione_code === 2,
  );
  v.E_U_3 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" &&
      m.macro === "COSTI_GENERALI" &&
      m.descrizione_code === 3,
  );
  v.E_U_4 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" &&
      m.macro === "COSTI_GENERALI" &&
      m.descrizione_code === 4,
  );
  v.E_U_5 = sumBy(
    movs,
    (m) =>
      m.tipologia === "USCITA" &&
      m.macro === "COSTI_GENERALI" &&
      m.descrizione_code === 5,
  );
  v.E_U_TOT = v.E_U_1 + v.E_U_2 + v.E_U_3 + v.E_U_4 + v.E_U_5;

  v.E_E_1 = 0;
  v.E_E_2 = 0;
  v.E_E_TOT = 0;
  v.E_AVANZO = v.E_E_TOT - v.E_U_TOT;

  // TOTALI GESTIONE
  v.TOTALE_ONERI_COSTI =
    v.A_U_TOT + v.B_U_TOT + v.C_U_TOT + v.D_U_TOT + v.E_U_TOT;

  v.TOTALE_ENTRATE_GESTIONE =
    v.A_E_TOT + v.B_E_TOT + v.C_E_TOT + v.D_E_TOT + v.E_E_TOT;

  v.AVANZO_PRIMA_IMPOSTE = v.TOTALE_ENTRATE_GESTIONE - v.TOTALE_ONERI_COSTI;

  v.IMPOSTE = 0;
  v.AVANZO_PRIMA_INVESTIMENTI = v.AVANZO_PRIMA_IMPOSTE - v.IMPOSTE;

  // INVESTIMENTI / DISINVESTIMENTI
  v.INV_U_1 = 0;
  v.INV_U_2 = 0;
  v.INV_U_3 = 0;
  v.INV_U_4 = 0;
  v.INV_U_TOT = 0;

  v.INV_E_1 = 0;
  v.INV_E_2 = 0;
  v.INV_E_3 = 0;
  v.INV_E_4 = 0;
  v.INV_E_TOT = 0;

  v.IMPOSTE_INV = 0;
  v.AVANZO_INVESTIMENTI = v.INV_E_TOT - v.INV_U_TOT;

  v.AVANZO_COMPLESSIVO =
    v.AVANZO_PRIMA_INVESTIMENTI + v.AVANZO_INVESTIMENTI - v.IMPOSTE_INV;

  // CASSA E BANCA
  v.CASSA = sumBy(movs, (m) => m.tipologia === "AVANZO_CASSA_T_1");
  v.BANCA = sumBy(movs, (m) => m.tipologia === "AVANZO_BANCA_T_1");
  v.CASSA_BANCA = v.CASSA + v.BANCA;

  // FIGURATIVI
  v.COSTI_FIG_AIG = 0;
  v.COSTI_FIG_AD = 0;
  v.COSTI_FIG_TOT = 0;

  v.PROVENTI_FIG_AIG = 0;
  v.PROVENTI_FIG_AD = 0;
  v.PROVENTI_FIG_TOT = 0;

  return v;
}

type LineItem = {
  label: string;
  key: string;
  strong?: boolean;
};

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 180px",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid #eef2f7",
        fontWeight: strong ? 700 : 400,
      }}
    >
      <div>{label}</div>
      <div style={{ textAlign: "right" }}>{euro(value)}</div>
    </div>
  );
}

function Section({
  title,
  items,
  values,
}: {
  title: string;
  items: LineItem[];
  values: RendicontoValues;
}) {
  return (
    <Card title={title} style={{ marginBottom: 16 }}>
      <div>
        {items.map((item) => (
          <Row
            key={item.key}
            label={item.label}
            value={values[item.key] || 0}
            strong={item.strong}
          />
        ))}
      </div>
    </Card>
  );
}

export default function Rendiconto() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [annoCorrente, setAnnoCorrente] = useState<number>(0);
  const [annoPrecedente, setAnnoPrecedente] = useState<number>(0);
  const [corrente, setCorrente] = useState<RendicontoValues>({});
  const [precedente, setPrecedente] = useState<RendicontoValues>({});

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      setLoading(true);

      const annualitaId = localStorage.getItem("annualita_id");
      const annoRaw = localStorage.getItem("annualita_anno");
      const anno = Number(annoRaw || 0);

      if (!annualitaId || !anno) {
        setCorrente(buildValues([]));
        setPrecedente(buildValues([]));
        setAnnoCorrente(0);
        setAnnoPrecedente(0);
        return;
      }

      setAnnoCorrente(anno);
      setAnnoPrecedente(anno - 1);

      const { data: prevAnnualita, error: prevAnnualitaError } = await supabase
        .from("annualita")
        .select("id, anno")
        .eq("anno", anno - 1)
        .limit(1)
        .maybeSingle();

      if (prevAnnualitaError) throw prevAnnualitaError;

      const prevId = (prevAnnualita as AnnualitaRow | null)?.id ?? null;

      const currentMovsPromise = supabase
        .from("movimenti")
        .select(
          "id, annualita_id, tipologia, macro, descrizione_code, descrizione_label, importo, iva, conto",
        )
        .eq("annualita_id", annualitaId);

      const prevMovsPromise = prevId
        ? supabase
            .from("movimenti")
            .select(
              "id, annualita_id, tipologia, macro, descrizione_code, descrizione_label, importo, iva, conto",
            )
            .eq("annualita_id", prevId)
        : Promise.resolve({ data: [], error: null } as any);

      const [currRes, prevRes] = await Promise.all([
        currentMovsPromise,
        prevMovsPromise,
      ]);

      if (currRes.error) throw currRes.error;
      if (prevRes.error) throw prevRes.error;

      const currentValues = buildValues((currRes.data || []) as Movimento[]);
      const prevValues = buildValues((prevRes.data || []) as Movimento[]);

      setCorrente(currentValues);
      setPrecedente(prevValues);
    } catch (err) {
      console.error("Errore caricamento rendiconto:", err);
      setCorrente(buildValues([]));
      setPrecedente(buildValues([]));
    } finally {
      setLoading(false);
    }
  }

  async function handleExportExcel() {
    try {
      setExporting(true);

      const response = await fetch(
        "/templates/rendiconto-per-cassa_MODELLO_GENERALE.xlsx",
      );

      if (!response.ok) {
        throw new Error("Template Excel non trovato in /public/templates");
      }

      const arrayBuffer = await response.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];

      ws["B5"] = { t: "s", v: String(annoCorrente || "") };
      ws["C5"] = { t: "s", v: String(annoPrecedente || "") };

      const map: Array<[string, string]> = [
        ["B7", "A_U_1"],
        ["B8", "A_U_2"],
        ["B9", "A_U_3"],
        ["B10", "A_U_4"],
        ["B11", "A_U_5"],
        ["C7", "A_U_1"],
        ["C8", "A_U_2"],
        ["C9", "A_U_3"],
        ["C10", "A_U_4"],
        ["C11", "A_U_5"],

        ["B16", "A_E_1"],
        ["B17", "A_E_2"],
        ["B18", "A_E_3"],
        ["B19", "A_E_4"],
        ["B20", "A_E_5"],
        ["B21", "A_E_6"],
        ["B22", "A_E_7"],
        ["B23", "A_E_8"],
        ["B24", "A_E_9"],
        ["B25", "A_E_10"],
        ["C16", "A_E_1"],
        ["C17", "A_E_2"],
        ["C18", "A_E_3"],
        ["C19", "A_E_4"],
        ["C20", "A_E_5"],
        ["C21", "A_E_6"],
        ["C22", "A_E_7"],
        ["C23", "A_E_8"],
        ["C24", "A_E_9"],
        ["C25", "A_E_10"],

        ["B32", "B_U_1"],
        ["B33", "B_U_2"],
        ["B34", "B_U_3"],
        ["B35", "B_U_4"],
        ["B36", "B_U_5"],
        ["C32", "B_U_1"],
        ["C33", "B_U_2"],
        ["C34", "B_U_3"],
        ["C35", "B_U_4"],
        ["C36", "B_U_5"],

        ["B40", "B_E_1"],
        ["B41", "B_E_2"],
        ["B42", "B_E_3"],
        ["B43", "B_E_4"],
        ["B44", "B_E_5"],
        ["B45", "B_E_6"],
        ["C40", "B_E_1"],
        ["C41", "B_E_2"],
        ["C42", "B_E_3"],
        ["C43", "B_E_4"],
        ["C44", "B_E_5"],
        ["C45", "B_E_6"],

        ["B52", "C_U_1"],
        ["B53", "C_U_2"],
        ["B54", "C_U_3"],
        ["C52", "C_U_1"],
        ["C53", "C_U_2"],
        ["C54", "C_U_3"],

        ["B58", "C_E_1"],
        ["B59", "C_E_2"],
        ["B60", "C_E_3"],
        ["C58", "C_E_1"],
        ["C59", "C_E_2"],
        ["C60", "C_E_3"],

        ["B67", "D_U_1"],
        ["B68", "D_U_2"],
        ["B69", "D_U_3"],
        ["B70", "D_U_4"],
        ["B71", "D_U_5"],
        ["C67", "D_U_1"],
        ["C68", "D_U_2"],
        ["C69", "D_U_3"],
        ["C70", "D_U_4"],
        ["C71", "D_U_5"],

        ["B75", "D_E_1"],
        ["B76", "D_E_2"],
        ["B77", "D_E_3"],
        ["B78", "D_E_4"],
        ["B79", "D_E_5"],
        ["C75", "D_E_1"],
        ["C76", "D_E_2"],
        ["C77", "D_E_3"],
        ["C78", "D_E_4"],
        ["C79", "D_E_5"],

        ["B86", "E_U_1"],
        ["B87", "E_U_2"],
        ["B88", "E_U_3"],
        ["B89", "E_U_4"],
        ["B90", "E_U_5"],
        ["C86", "E_U_1"],
        ["C87", "E_U_2"],
        ["C88", "E_U_3"],
        ["C89", "E_U_4"],
        ["C90", "E_U_5"],

        ["B94", "E_E_1"],
        ["B95", "E_E_2"],
        ["C94", "E_E_1"],
        ["C95", "E_E_2"],

        ["B104", "IMPOSTE"],
        ["C104", "IMPOSTE"],

        ["B108", "INV_U_1"],
        ["B109", "INV_U_2"],
        ["B110", "INV_U_3"],
        ["B111", "INV_U_4"],
        ["C108", "INV_U_1"],
        ["C109", "INV_U_2"],
        ["C110", "INV_U_3"],
        ["C111", "INV_U_4"],

        ["B115", "INV_E_1"],
        ["B116", "INV_E_2"],
        ["B117", "INV_E_3"],
        ["B118", "INV_E_4"],
        ["C115", "INV_E_1"],
        ["C116", "INV_E_2"],
        ["C117", "INV_E_3"],
        ["C118", "INV_E_4"],

        ["B121", "IMPOSTE_INV"],
        ["C121", "IMPOSTE_INV"],

        ["B132", "CASSA"],
        ["B133", "BANCA"],
        ["C132", "CASSA"],
        ["C133", "BANCA"],

        ["B137", "COSTI_FIG_AIG"],
        ["B138", "COSTI_FIG_AD"],
        ["C137", "COSTI_FIG_AIG"],
        ["C138", "COSTI_FIG_AD"],

        ["B143", "PROVENTI_FIG_AIG"],
        ["B144", "PROVENTI_FIG_AD"],
        ["C143", "PROVENTI_FIG_AIG"],
        ["C144", "PROVENTI_FIG_AD"],
      ];

      for (const [cell, key] of map) {
        const isPrev = cell.startsWith("C");
        const values = isPrev ? precedente : corrente;
        ws[cell] = { t: "n", v: Number(values[key] || 0) };
      }

      const out = XLSX.write(wb, {
        bookType: "xlsx",
        type: "array",
      });

      const blob = new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(
        blob,
        `Rendiconto_per_cassa_${annoCorrente || "annualita"}_compilato.xlsx`,
      );
    } catch (err) {
      console.error("Errore export rendiconto:", err);
      alert("Impossibile generare il file Excel del rendiconto.");
    } finally {
      setExporting(false);
    }
  }

  const sezioni = useMemo(
    () => [
      {
        title: "A) Attività di interesse generale",
        items: [
          {
            label:
              "Uscite - 1) Materie prime, sussidiarie, di consumo e di merci",
            key: "A_U_1",
          },
          { label: "Uscite - 2) Servizi", key: "A_U_2" },
          { label: "Uscite - 3) Godimento beni di terzi", key: "A_U_3" },
          { label: "Uscite - 4) Personale", key: "A_U_4" },
          { label: "Uscite - 5) Uscite diverse di gestione", key: "A_U_5" },
          { label: "Totale uscite AIG", key: "A_U_TOT", strong: true },

          {
            label: "Entrate - 1) Quote associative e apporti dei fondatori",
            key: "A_E_1",
          },
          {
            label: "Entrate - 2) Entrate dagli associati per attività mutuali",
            key: "A_E_2",
          },
          {
            label:
              "Entrate - 3) Prestazioni e cessioni ad associati e fondatori",
            key: "A_E_3",
          },
          { label: "Entrate - 4) Erogazioni liberali", key: "A_E_4" },
          { label: "Entrate - 5) Entrate del 5 per mille", key: "A_E_5" },
          {
            label: "Entrate - 6) Contributi da soggetti privati",
            key: "A_E_6",
          },
          {
            label: "Entrate - 7) Prestazioni e cessioni a terzi",
            key: "A_E_7",
          },
          { label: "Entrate - 8) Contributi da enti pubblici", key: "A_E_8" },
          {
            label: "Entrate - 9) Entrate da contratti con enti pubblici",
            key: "A_E_9",
          },
          { label: "Entrate - 10) Altre entrate", key: "A_E_10" },
          { label: "Totale entrate AIG", key: "A_E_TOT", strong: true },

          {
            label: "Avanzo/disavanzo attività di interesse generale",
            key: "A_AVANZO",
            strong: true,
          },
        ] as LineItem[],
      },
      {
        title: "B) Attività diverse",
        items: [
          {
            label:
              "Uscite - 1) Materie prime, sussidiarie, di consumo e di merci",
            key: "B_U_1",
          },
          { label: "Uscite - 2) Servizi", key: "B_U_2" },
          { label: "Uscite - 3) Godimento beni di terzi", key: "B_U_3" },
          { label: "Uscite - 4) Personale", key: "B_U_4" },
          { label: "Uscite - 5) Uscite diverse di gestione", key: "B_U_5" },
          {
            label: "Totale uscite Attività Diverse",
            key: "B_U_TOT",
            strong: true,
          },

          {
            label:
              "Entrate - 1) Prestazioni e cessioni ad associati e fondatori",
            key: "B_E_1",
          },
          {
            label: "Entrate - 2) Contributi da soggetti privati",
            key: "B_E_2",
          },
          {
            label: "Entrate - 3) Prestazioni e cessioni a terzi",
            key: "B_E_3",
          },
          { label: "Entrate - 4) Contributi da enti pubblici", key: "B_E_4" },
          {
            label: "Entrate - 5) Entrate da contratti con enti pubblici",
            key: "B_E_5",
          },
          { label: "Entrate - 6) Altre entrate", key: "B_E_6" },
          {
            label: "Totale entrate Attività Diverse",
            key: "B_E_TOT",
            strong: true,
          },

          {
            label: "Avanzo/disavanzo attività diverse",
            key: "B_AVANZO",
            strong: true,
          },
        ] as LineItem[],
      },
      {
        title: "C) Raccolte fondi",
        items: [
          {
            label: "Uscite - 1) Uscite per raccolte fondi abituali",
            key: "C_U_1",
          },
          {
            label: "Uscite - 2) Uscite per raccolte fondi occasionali",
            key: "C_U_2",
          },
          { label: "Uscite - 3) Altre uscite", key: "C_U_3" },
          {
            label: "Totale uscite Raccolte Fondi",
            key: "C_U_TOT",
            strong: true,
          },

          {
            label: "Entrate - 1) Entrate da raccolte fondi abituali",
            key: "C_E_1",
          },
          {
            label: "Entrate - 2) Entrate da raccolte fondi occasionali",
            key: "C_E_2",
          },
          { label: "Entrate - 3) Altre entrate", key: "C_E_3" },
          {
            label: "Totale entrate Raccolte Fondi",
            key: "C_E_TOT",
            strong: true,
          },

          {
            label: "Avanzo/disavanzo raccolte fondi",
            key: "C_AVANZO",
            strong: true,
          },
        ] as LineItem[],
      },
      {
        title: "D) Attività finanziarie e patrimoniali",
        items: [
          { label: "Uscite - 1) Su rapporti bancari", key: "D_U_1" },
          { label: "Uscite - 2) Su investimenti finanziari", key: "D_U_2" },
          { label: "Uscite - 3) Su patrimonio edilizio", key: "D_U_3" },
          { label: "Uscite - 4) Su altri beni patrimoniali", key: "D_U_4" },
          { label: "Uscite - 5) Altre uscite", key: "D_U_5" },
          {
            label: "Totale uscite attività finanziarie/patrimoniali",
            key: "D_U_TOT",
            strong: true,
          },

          { label: "Entrate - 1) Da rapporti bancari", key: "D_E_1" },
          {
            label: "Entrate - 2) Da altri investimenti finanziari",
            key: "D_E_2",
          },
          { label: "Entrate - 3) Da patrimonio edilizio", key: "D_E_3" },
          { label: "Entrate - 4) Da altri beni patrimoniali", key: "D_E_4" },
          { label: "Entrate - 5) Altre entrate", key: "D_E_5" },
          {
            label: "Totale entrate attività finanziarie/patrimoniali",
            key: "D_E_TOT",
            strong: true,
          },

          {
            label: "Avanzo/disavanzo attività finanziarie e patrimoniali",
            key: "D_AVANZO",
            strong: true,
          },
        ] as LineItem[],
      },
      {
        title: "E) Supporto generale",
        items: [
          {
            label:
              "Uscite - 1) Materie prime, sussidiarie, di consumo e di merci",
            key: "E_U_1",
          },
          { label: "Uscite - 2) Servizi", key: "E_U_2" },
          { label: "Uscite - 3) Godimento beni di terzi", key: "E_U_3" },
          { label: "Uscite - 4) Personale", key: "E_U_4" },
          { label: "Uscite - 5) Altre uscite", key: "E_U_5" },
          {
            label: "Totale uscite supporto generale",
            key: "E_U_TOT",
            strong: true,
          },

          {
            label: "Entrate - 1) Entrate da distacco del personale",
            key: "E_E_1",
          },
          {
            label: "Entrate - 2) Altre entrate di supporto generale",
            key: "E_E_2",
          },
          {
            label: "Totale entrate supporto generale",
            key: "E_E_TOT",
            strong: true,
          },

          {
            label: "Avanzo/disavanzo supporto generale",
            key: "E_AVANZO",
            strong: true,
          },
        ] as LineItem[],
      },
      {
        title: "Riepilogo",
        items: [
          {
            label: "Totale oneri e costi",
            key: "TOTALE_ONERI_COSTI",
            strong: true,
          },
          {
            label: "Totale entrate della gestione",
            key: "TOTALE_ENTRATE_GESTIONE",
            strong: true,
          },
          {
            label: "Avanzo/disavanzo d’esercizio prima delle imposte",
            key: "AVANZO_PRIMA_IMPOSTE",
            strong: true,
          },
          { label: "Imposte", key: "IMPOSTE" },
          {
            label:
              "Avanzo/disavanzo d’esercizio prima di investimenti/disinvestimenti",
            key: "AVANZO_PRIMA_INVESTIMENTI",
            strong: true,
          },
          {
            label: "Avanzo/disavanzo da investimenti/disinvestimenti",
            key: "AVANZO_INVESTIMENTI",
            strong: true,
          },
          {
            label: "Avanzo/disavanzo complessivo",
            key: "AVANZO_COMPLESSIVO",
            strong: true,
          },
          { label: "Cassa", key: "CASSA" },
          { label: "Depositi bancari e postali", key: "BANCA" },
          { label: "Cassa e banca", key: "CASSA_BANCA", strong: true },
        ] as LineItem[],
      },
    ],
    [],
  );

  return (
    <Layout>
      <div className="container" style={{ paddingBottom: 90 }}>
        <Card
          title="Rendiconto per cassa"
          right={
            <div style={{ fontWeight: 700 }}>
              {annoCorrente
                ? `Anno ${annoCorrente}`
                : "Annualità non selezionata"}
            </div>
          }
          style={{ marginBottom: 16 }}
        >
          <div style={{ color: "#475569", lineHeight: 1.5 }}>
            Pagina in sola lettura. I valori mostrati sono riferiti solo
            all’annualità aperta. Il file Excel finale compilerà anche la
            colonna dell’anno precedente; se l’annualità T-1 manca, verranno
            inseriti automaticamente tutti 0.
          </div>

          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <PrimaryButton
              onClick={handleExportExcel}
              disabled={loading || exporting}
            >
              {exporting ? "Generazione Excel..." : "Scarica Excel compilato"}
            </PrimaryButton>

            <SecondaryButton onClick={() => void load()} disabled={loading}>
              {loading ? "Caricamento..." : "Aggiorna"}
            </SecondaryButton>
          </div>
        </Card>

        {loading ? (
          <Card>
            <div>Caricamento rendiconto...</div>
          </Card>
        ) : (
          sezioni.map((s) => (
            <Section
              key={s.title}
              title={s.title}
              items={s.items}
              values={corrente}
            />
          ))
        )}
      </div>
    </Layout>
  );
}
