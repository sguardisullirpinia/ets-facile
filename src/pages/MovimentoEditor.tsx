import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Card, PrimaryButton, SecondaryButton, Badge } from "../components/ui";

type Tipologia = "ENTRATA" | "USCITA" | "AVANZO_CASSA_T_1" | "AVANZO_BANCA_T_1";

type Macro =
  | "AIG"
  | "ATTIVITA_DIVERSE"
  | "RACCOLTE_FONDI"
  | "QUOTE_ASSOCIATIVE"
  | "EROGAZIONI_LIBERALI"
  | "PROVENTI_5X1000"
  | "CONTRIBUTI_PA_SENZA_CORRISPETTIVO"
  | "ALTRI_PROVENTI_NON_COMMERCIALI"
  // ✅ Step 1: costo generale master (solo in USCITA)
  | "COSTI_GENERALI";

type Conto = "CASSA" | "BANCA";

/* =========================
   DESCRIZIONI CODIFICATE
   ========================= */
// ENTRATE
const AIG_ENTRATE = [
  { code: 1, label: "Entrate dagli associati per attività mutuali" },
  {
    code: 2,
    label: "Prestazioni e cessioni a iscritti, associati e fondatori",
  },
  { code: 3, label: "Contributi da soggetti privati" },
  { code: 4, label: "Prestazioni e cessioni a terzi" },
  { code: 5, label: "Contributi da enti pubblici" },
  { code: 6, label: "Entrate da contratti con enti pubblici" },
  { code: 7, label: "Altri ricavi, rendite e proventi" },
  { code: 8, label: "Rimanenze finali" },
];

const AD_ENTRATE = [
  { code: 1, label: "Prestazioni ad associati" },
  { code: 2, label: "Contributi privati" },
  { code: 3, label: "Prestazioni a terzi" },
  { code: 4, label: "Contributi pubblici" },
  { code: 5, label: "Contratti pubblici" },
  { code: 6, label: "Sponsorizzazioni" },
  { code: 7, label: "Altre entrate" },
];

// USCITE
const AIG_USCITE = [
  { code: 1, label: "Materie prime" },
  { code: 2, label: "Servizi" },
  { code: 3, label: "Godimento beni di terzi" },
  { code: 4, label: "Personale" },
  { code: 5, label: "Ammortamenti" },
  { code: 6, label: "Accantonamenti" },
  { code: 7, label: "Oneri e uscite diverse" },
  { code: 8, label: "Rimanenze iniziali" },
  { code: 9, label: "Costi su rapporti bancari" },
  { code: 10, label: "Costi su prestiti" },
];

const AD_USCITE = [
  { code: 1, label: "Materie prime" },
  { code: 2, label: "Servizi" },
  { code: 3, label: "Godimento beni di terzi" },
  { code: 4, label: "Personale" },
  { code: 5, label: "Uscite diverse" },
];

function isValidMoney(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

export default function MovimentoEditor() {
  const annualitaId = localStorage.getItem("annualita_id");
  const editId = localStorage.getItem("movimento_edit_id");
  const presetTipologia =
    (localStorage.getItem("movimento_tipologia") as Tipologia) || "";

  const [loading, setLoading] = useState(!!editId);
  const [error, setError] = useState<string | null>(null);

  const [tipologia, setTipologia] = useState<Tipologia | "">(presetTipologia);
  const [data, setData] = useState("");
  const [macro, setMacro] = useState<Macro | "">("");

  // ✅ Banca/Cassa
  const [conto, setConto] = useState<Conto>("CASSA");

  const [descrizioneCode, setDescrizioneCode] = useState<number | null>(null);
  const [descrizioneLabel, setDescrizioneLabel] = useState("");
  const [importo, setImporto] = useState("");

  // ✅ obbligatoria per ENTRATA/USCITA
  const [descrOperazione, setDescrOperazione] = useState("");

  /* =========================
     FLAGS
     ========================= */
  const isEntrataOrUscita = tipologia === "ENTRATA" || tipologia === "USCITA";
  const isAvanzo =
    tipologia === "AVANZO_CASSA_T_1" || tipologia === "AVANZO_BANCA_T_1";

  const isSoloImportoEntrata =
    tipologia === "ENTRATA" &&
    (macro === "QUOTE_ASSOCIATIVE" ||
      macro === "EROGAZIONI_LIBERALI" ||
      macro === "PROVENTI_5X1000" ||
      macro === "CONTRIBUTI_PA_SENZA_CORRISPETTIVO" ||
      macro === "ALTRI_PROVENTI_NON_COMMERCIALI");

  // ✅ STEP 1: riconosco il master
  const isCostiGenerali = tipologia === "USCITA" && macro === "COSTI_GENERALI";

  /* =========================
     LOAD MOVIMENTO (EDIT)
     ========================= */
  useEffect(() => {
    if (!editId) return;

    const load = async () => {
      const { data: row, error } = await supabase
        .from("movimenti")
        .select("*")
        .eq("id", editId)
        .single();

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setTipologia(row.tipologia);
      setData(row.data || "");
      setMacro(row.macro || "");
      setConto((row.conto as Conto) || "CASSA");

      setDescrizioneCode(row.descrizione_code);
      setDescrizioneLabel(row.descrizione_label || "");
      setImporto(String(row.importo ?? ""));
      setDescrOperazione((row.descrizione_operazione ?? "").toString());

      setLoading(false);
    };

    load();
  }, [editId]);

  /* =========================
     RESET A CASCATA (solo INSERT)
     ========================= */
  useEffect(() => {
    if (editId) return;
    setData("");
    setMacro("");
    setConto("CASSA");
    setDescrizioneCode(null);
    setDescrizioneLabel("");
    setImporto("");
    setDescrOperazione("");
  }, [tipologia, editId]);

  useEffect(() => {
    if (editId) return;

    // se scelgo COSTI_GENERALI: azzero descrizione (non serve)
    if (tipologia === "USCITA" && macro === "COSTI_GENERALI") {
      setDescrizioneCode(null);
      setDescrizioneLabel("");
      return;
    }

    setDescrizioneCode(null);
    setDescrizioneLabel("");
  }, [macro, tipologia, editId]);

  /* =========================
     DESCRIZIONI DINAMICHE
     ========================= */
  const descrizioni = useMemo(() => {
    if (isCostiGenerali) return [];
    if (tipologia === "ENTRATA" && macro === "AIG") return AIG_ENTRATE;
    if (tipologia === "ENTRATA" && macro === "ATTIVITA_DIVERSE")
      return AD_ENTRATE;
    if (tipologia === "USCITA" && macro === "AIG") return AIG_USCITE;
    if (tipologia === "USCITA" && macro === "ATTIVITA_DIVERSE")
      return AD_USCITE;
    return [];
  }, [tipologia, macro, isCostiGenerali]);

  /* =========================
     SALVA (INSERT / UPDATE)
     ========================= */
  const salva = async () => {
    setError(null);

    if (!annualitaId) return setError("Annualità non selezionata");

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return setError("Utente non autenticato");

    if (!tipologia) return setError("Seleziona la tipologia");

    // ✅ Obbligatoria per ENTRATA/USCITA
    if (isEntrataOrUscita && !descrOperazione.trim()) {
      setError("Inserisci la descrizione dell’operazione (obbligatoria)");
      return;
    }

    if (!isAvanzo) {
      if (!data || !macro || !isValidMoney(importo)) {
        setError("Compila tutti i campi obbligatori");
        return;
      }

      // ✅ Se COSTI_GENERALI: nessuna descrizione codificata/libera richiesta
      if (!isCostiGenerali) {
        if (
          (macro === "AIG" || macro === "ATTIVITA_DIVERSE") &&
          !isSoloImportoEntrata &&
          (!descrizioneCode || !descrizioneLabel)
        ) {
          setError("Seleziona una descrizione");
          return;
        }

        if (macro === "RACCOLTE_FONDI" && !descrizioneLabel.trim()) {
          setError("Inserisci la descrizione");
          return;
        }
      }
    } else {
      if (!isValidMoney(importo)) {
        setError("Importo non valido");
        return;
      }
    }

    // ✅ DESCRIZIONE OPERAZIONE: mai null (DB NOT NULL)
    const descrOperazioneFinale = isAvanzo
      ? tipologia === "AVANZO_CASSA_T_1"
        ? "Avanzo cassa t-1"
        : "Avanzo banca t-1"
      : descrOperazione.trim();

    const payload: any = {
      user_id: userData.user.id,
      annualita_id: annualitaId,
      tipologia,
      data: isAvanzo ? null : data || null,
      macro: isAvanzo ? null : macro || null,

      // ✅ CONTO: sugli avanzi lo imposto automaticamente
      conto: isAvanzo
        ? tipologia === "AVANZO_CASSA_T_1"
          ? "CASSA"
          : "BANCA"
        : isEntrataOrUscita
          ? conto
          : null,

      // ✅ COSTI_GENERALI: descrizioni nulle
      descrizione_code:
        isAvanzo || isSoloImportoEntrata || isCostiGenerali
          ? null
          : descrizioneCode,
      descrizione_label:
        isAvanzo || isSoloImportoEntrata || isCostiGenerali
          ? null
          : descrizioneLabel || null,

      importo: Number(importo),

      descrizione_operazione: descrOperazioneFinale,

      iva: 0,

      // ✅ IMPORTANTISSIMO: niente allocazione per COSTI_GENERALI (master)
      // (qui non valorizziamo allocated_to_type/id, quindi rimangono null)
    };

    const q = editId
      ? supabase.from("movimenti").update(payload).eq("id", editId)
      : supabase.from("movimenti").insert(payload);

    const { error } = await q;
    if (error) {
      setError(error.message);
      return;
    }

    localStorage.removeItem("movimento_edit_id");
    localStorage.removeItem("movimento_tipologia");
    history.back();
  };

  if (loading) {
    return (
      <Layout>
        <div>Caricamento…</div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* HEADER */}
      <div className="pageHeader" style={{ paddingTop: 15 }}>
        <div>
          <h2 className="pageTitle">
            {editId ? "Modifica movimento" : "Nuovo Movimento"}
          </h2>
          <div className="pageHelp">
            Compila i campi passo-passo. La descrizione dell’operazione è
            obbligatoria per Entrate/Uscite.
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <Badge tone="red">Errore</Badge>
          <div className="errorText">{error}</div>
        </div>
      )}

      <Card title="1️⃣ Tipologia">
        <select
          value={tipologia}
          onChange={(e) => setTipologia(e.target.value as any)}
          disabled={!!editId}
          className="input"
        >
          <option value="">Seleziona…</option>
          <option value="ENTRATA">Entrata</option>
          <option value="USCITA">Uscita</option>
          <option value="AVANZO_CASSA_T_1">Avanzo cassa t-1</option>
          <option value="AVANZO_BANCA_T_1">Avanzo banca t-1</option>
        </select>
      </Card>

      {isEntrataOrUscita && (
        <>
          <Card title="2️⃣ Data">
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="input"
            />
          </Card>

          <Card title="3️⃣ Categoria">
            <select
              value={macro}
              onChange={(e) => setMacro(e.target.value as any)}
              className="input"
            >
              <option value="">Seleziona…</option>
              <option value="AIG">AIG</option>
              <option value="ATTIVITA_DIVERSE">Attività Diverse</option>
              <option value="RACCOLTE_FONDI">Raccolte Fondi</option>

              {/* ✅ Step 1: costo generale master */}
              {tipologia === "USCITA" && (
                <option value="COSTI_GENERALI">Costi generali</option>
              )}

              {tipologia === "ENTRATA" && (
                <>
                  <option value="QUOTE_ASSOCIATIVE">Quote associative</option>
                  <option value="EROGAZIONI_LIBERALI">
                    Erogazioni liberali
                  </option>
                  <option value="PROVENTI_5X1000">Proventi 5×1000</option>
                  <option value="CONTRIBUTI_PA_SENZA_CORRISPETTIVO">
                    Contributi PA senza corrispettivo
                  </option>
                  <option value="ALTRI_PROVENTI_NON_COMMERCIALI">
                    Altri proventi non commerciali
                  </option>
                </>
              )}
            </select>
          </Card>

          {/* ✅ BANCA/CASSA */}
          <Card title="3️⃣B Banca / Cassa">
            <select
              value={conto}
              onChange={(e) => setConto(e.target.value as Conto)}
              className="input"
            >
              <option value="CASSA">Cassa</option>
              <option value="BANCA">Banca</option>
            </select>
          </Card>
        </>
      )}

      {/* ✅ Info box per COSTI_GENERALI */}
      {isCostiGenerali && (
        <Card title="ℹ️ Nota (Costi generali)">
          <div style={{ lineHeight: 1.45 }}>
            Questo movimento è un <b>costo generale unico</b> e resterà visibile
            nella <b>Prima Nota</b> per poterlo modificare o cancellare.
            <br />
            La quota imputata alle singole attività verrà calcolata
            automaticamente nei riepiloghi (step successivi).
          </div>
        </Card>
      )}

      {(macro === "AIG" || macro === "ATTIVITA_DIVERSE") &&
        !isSoloImportoEntrata &&
        !isCostiGenerali && (
          <Card title="4️⃣ Descrizione (codificata)">
            <select
              value={descrizioneCode ?? ""}
              onChange={(e) => {
                const code = Number(e.target.value);
                const item = descrizioni.find((x) => x.code === code);
                setDescrizioneCode(code);
                setDescrizioneLabel(item?.label || "");
              }}
              className="input"
            >
              <option value="">Seleziona…</option>
              {descrizioni.map((v) => (
                <option key={v.code} value={v.code}>
                  {v.code}. {v.label}
                </option>
              ))}
            </select>
          </Card>
        )}

      {macro === "RACCOLTE_FONDI" && !isCostiGenerali && (
        <Card title="4️⃣ Descrizione raccolta fondi">
          <input
            value={descrizioneLabel}
            onChange={(e) => setDescrizioneLabel(e.target.value)}
            className="input"
            placeholder="Inserisci descrizione…"
          />
        </Card>
      )}

      {tipologia && (
        <>
          <Card title="5️⃣ Importo">
            <input
              type="number"
              value={importo}
              onChange={(e) => setImporto(e.target.value)}
              className="input"
              placeholder="0,00"
            />
          </Card>

          {isEntrataOrUscita && (
            <Card title="6️⃣ Descrizione operazione (obbligatoria)">
              <input
                value={descrOperazione}
                onChange={(e) => setDescrOperazione(e.target.value)}
                className="input"
                placeholder="Es. Bollette • Assicurazione • Canone software • 'Costi generali'…"
              />
            </Card>
          )}
        </>
      )}

      <div className="formActions">
        <PrimaryButton onClick={salva}>
          {editId ? "Salva modifiche" : "Salva"}
        </PrimaryButton>
        <SecondaryButton onClick={() => history.back()}>
          Annulla
        </SecondaryButton>
      </div>
    </Layout>
  );
}
