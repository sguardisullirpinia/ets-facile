import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Card, PrimaryButton, SecondaryButton, Badge } from "../components/ui";

type Tipologia =
  | "ENTRATA"
  | "USCITA"
  | "AVANZO_CASSA_T_1"
  | "AVANZO_BANCA_T_1";

type Macro =
  | "AIG"
  | "ATTIVITA_DIVERSE"
  | "RACCOLTE_FONDI"
  | "ATTIVITA_FINANZIARIA_PATRIMONIALE"
  | "SUPPORTO_GENERALE"
  | "INVESTIMENTO_DISINVESTIMENTO"
  | "IMPOSTE";

type Conto = "CASSA" | "BANCA";
type Regime = "FORFETTARIO" | "ORDINARIO";

type OptionItem = {
  code: number;
  label: string;
};

type NestedConfig = {
  primary: OptionItem[];
  secondary?: Record<number, string[]>;
  forceTextAfterPrimary?: number[];
  forceTextAfterSecondary?: Array<{
    primaryCode: number;
    secondaryValues: string[];
  }>;
  hideSecondary?: boolean;
};

function isValidMoney(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function isValidIva(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0;
}

/* =========================
   LISTE BASE COMUNI
========================= */

const USCITE_MATERIE_PRIME = [
  "acquisti di beni",
  "cancelleria e stampati",
  "carburanti e lubrificanti",
  "combustibile per riscaldamento",
  "costi accessori di acquisto di beni se addebitati dal fornitore (trasporti, spese di magazzino, etc)",
  "Imballaggi",
  "indumenti di lavoro",
  "materiale di consumo per manutenzioni e pulizie",
  "materie prime",
  "materie sussidiarie",
  "Semilavorati",
  "Generi alimentari, vestiario, igiene",
  "Medicinali e presidi sanitari (umani e veterinari)",
  "Cibo per animali",
  "Carburante automezzo associativo",
  "Cancelleria",
  "Casalinghi e ferramenta",
  "Materiale di consumo per manutenzioni e pulizia",
  "Dispositivi di protezione individuale",
  "Attrezzature e macchinari di costo inferiore a € 517",
  "indumenti da lavoro, divise",
];

const USCITE_SERVIZI = [
  "Aggiornamento e formazione",
  "Altri servizi resi da banche ed imprese finanziarie non collegati ad operazioni di finanziamento",
  "Assicurazioni varie",
  "Canoni di assistenza tecnica",
  "Commissioni per servizi di pagamento",
  "Compensi ai componenti dell’organo di controllo ed ai revisori legali",
  "Compenso all’organo amministrativo",
  "Compensi per collaborazioni coordinate e continuative",
  "Consulenze",
  "Costi per custodia di titoli",
  "Costi per il personale distaccato presso l’ente e dipendenti da altri enti",
  "Costi per mensa (se gestita da terzi)",
  "Energia elettrice, acqua, gas, telefono",
  "Indennità di fine rapporto connesse a co.co.co.",
  "Indennità chilometriche",
  "Lavanderia indumenti da lavoro",
  "Lavorazioni esterne",
  "Noleggio di cassette di sicurezza",
  "Pubblicità e promozione",
  "Rimborsi spese a piè di lista",
  "Servizi di manutenzione (attrezzature e mobili etc)",
  "Servizi di pulizia",
  "Servizi di smaltimento rifiuti",
  "Servizi di vigilanza",
  "Servizi di elaborazione dati",
  "Spese di rappresentanza",
  "Spese di ricerca, addestramento e formazione",
  "Spese di vitto ed alloggio a titolo di spesa di trasferta",
  "Spese legali e consulenze",
  "Spese per analisi e prove di laboratorio",
  "Spese postali",
  "Trasporti nel casi in cui gli stessi siano inclusi dal fornitore del bene nel prezzo di acquisto",
  "Viaggi e trasferte (biglietti aereo, treno, taxi, etc)",
  "Utenze telefoniche, elettriche, idriche, gas",
  "Spese Condominio",
  "Pedaggio autostradale per automezzo associativo",
  "Manutenzioni, riparazioni e servizi di pulizia",
  "Canoni assistenza tecnica",
  "Servizi tipografici e di elaborazione grafica",
  "Assicurazioni varie (diverse dalla polizza del volontariato)",
  "Spese postali e di spedizione",
  "Spese accensione fidejussione",
  "Polizza assicurazione copertura RC infortunio e malattia",
  "Lavoro autonomo e occasionale Costo lordo (comprensivo di ritenuta d’acconto, IRAP)",
  "Contratti collaborazione occasionale",
  "Parcelle liberi professionisti",
];

const USCITE_GODIMENTO_TERZI = [
  "Affitti e locazioni",
  "Canoni corrisposti per usufrutto, enfiteusi e diritto di superficie",
  "Diritto d’autore",
  "Leasing finanziario",
  "Leasing operativo",
  "Noleggio attrezzature, impianti, macchinari, autoveicoli, etc.",
  "Oneri accessori agli affitti (spese condominiali, imposta di registro)",
  "Royalties",
  "Utilizzo brevetti",
  "Affitto sede",
  "Noleggio sale e attrezzature",
  "Leasing",
  "Diritti per utilizzo di opere dell’ingegno, diritti d’autore, licenze e marchi (SIAE)",
];

const USCITE_PERSONALE = [
  "Retribuzione in denaro",
  "Retribuzione in natura",
  "Premi ed altri elementi simili",
  "Oneri previdenziali a carico dell’ente",
  "Oneri assistenziali a carico dell’ente (es. inail)",
  "Trattamento di fine rapporto",
  "Trattamento di quiescenza e simili",
  "Transazioni con i dipendenti",
  "Servizio sanitario",
  "Quote associative a favore dei dipendenti",
  "Sussidi occasionali (matrimoni, nascite, funerali)",
  "Borse di studio a favore dei dipendenti e loro familiari",
  "Omaggi a dipendenti",
  "Incentivi all’esodo",
];

const USCITE_DIVERSE_GESTIONE = [
  "Imposte e tasse relative al reddito imponibile dell’esercizio",
  "Imposte sostitutive",
  "Imposte di bollo",
  "Tributi locali",
  "Imposta di registro",
  "Imposte ipotecarie e catastali",
  "Tassa di concessione governativa",
  "Tesse di circolazione",
  "Tassa sui rifiuti",
  "Altre imposte e tasse",
  "Contributi ad associazioni sindacali di categoria",
  "Abbonamenti a riviste e giornali",
  "Costi per la mensa gestita interamente",
  "Sopravvenienze passive",
  "Liberalità omaggi ed articoli promozionali",
  "Spese per deposito e pubblicazione di bilanci, verbali assemblee, etc",
  "Oneri per multe, ammende e sanzioni",
  "Borse di studio e premi",
  "Quote associative a federazioni, affiliazioni",
  "Abbonamenti a giornali e riviste",
  "Omaggi e spese di rappresentanza",
  "Imposte e tasse",
  "Multe e ammende",
  "Rimborso spese Volontari",
  "Vitto",
  "Alloggio",
  "Trasporti",
  "rimborso chilometrico auto propria",
  "Erogazione di denaro a sostegno di persone svantaggiate",
  "Erogazione di denaro a ETS che svolgono attività a sostegno di persone svantaggiate",
  "Acquisto beni e servizi da donare",
];

/* =========================
   CONFIGURAZIONE GERARCHICA
========================= */

const USCITE_AIG_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Materie prime, sussidiarie, di consumo e di merci" },
    { code: 2, label: "Servizi" },
    { code: 3, label: "Godimento beni di terzi" },
    { code: 4, label: "Personale" },
    { code: 5, label: "Uscite diverse di gestione" },
  ],
  secondary: {
    1: USCITE_MATERIE_PRIME,
    2: USCITE_SERVIZI,
    3: USCITE_GODIMENTO_TERZI,
    4: USCITE_PERSONALE,
    5: USCITE_DIVERSE_GESTIONE,
  },
};

const USCITE_AD_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Materie prime, sussidiarie, di consumo e di merci" },
    { code: 2, label: "Servizi" },
    { code: 3, label: "Godimento beni di terzi" },
    { code: 4, label: "Personale" },
    { code: 5, label: "Uscite diverse di gestione" },
  ],
  secondary: {
    1: USCITE_MATERIE_PRIME,
    2: USCITE_SERVIZI,
    3: USCITE_GODIMENTO_TERZI,
    4: USCITE_PERSONALE,
    5: USCITE_DIVERSE_GESTIONE,
  },
};

const USCITE_RF_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Uscite per raccolte fondi abituali" },
    { code: 2, label: "Uscite per raccolte fondi occasionali" },
    { code: 3, label: "Altre uscite" },
  ],
  hideSecondary: true,
  forceTextAfterPrimary: [1, 2, 3],
};

const USCITE_AFP_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Su rapporti bancari" },
    { code: 2, label: "Su investimenti finanziari" },
    { code: 3, label: "Su patrimonio edilizio" },
    { code: 4, label: "Su altri beni patrimoniali" },
    { code: 5, label: "Altre uscite" },
  ],
  secondary: {
    1: [
      "costi fissi bancari o postali",
      "Commissioni bancarie o postali",
      "interessi passivi",
      "imposte",
      "Altro",
    ],
    2: [
      "Interessi su finanziamenti ottenuti da banche ed altri istituti di credito",
      "Commissioni passive su finanziamenti",
      "Interessi passivi su dilazioni ottenute da fornitori ed interessi di mora",
      "Altro",
    ],
    3: [
      "Manutenzioni straordinarie sul patrimonio edilizio",
      "IMU",
      "Spese condominiali",
      "Altro",
    ],
  },
  forceTextAfterPrimary: [4, 5],
};

const USCITE_SUPPORTO_GENERALE_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Materie prime, sussidiarie, di consumo e di merci" },
    { code: 2, label: "Servizi" },
    { code: 3, label: "Godimento beni di terzi" },
    { code: 4, label: "Personale" },
    { code: 5, label: "Altre uscite" },
  ],
  hideSecondary: true,
  forceTextAfterPrimary: [1, 2, 3, 4, 5],
};

const USCITE_INVESTIMENTI_CONFIG: NestedConfig = {
  primary: [
    {
      code: 1,
      label: "Investimenti in immobilizzazioni inerenti alle attività di interesse generale",
    },
    {
      code: 2,
      label: "Investimenti in immobilizzazioni inerenti alle attività diverse",
    },
    { code: 3, label: "Investimenti in attività finanziarie e patrimoniali" },
    { code: 4, label: "Rimborso di finanziamenti per quota capitale e di prestiti" },
  ],
  secondary: {
    1: ["Acquisto beni strumentali di valore superiore 516 euro", "Altro"],
    2: ["Acquisto beni strumentali di valore superiore 516 euro", "Altro"],
    3: ["Immobili ad uso investimento", "Titoli, azioni"],
    4: ["Quota capitale mutuo", "Altro"],
  },
};

const ENTRATE_AIG_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Entrate da quote associative e apporti dei fondatori" },
    { code: 2, label: "Entrate dagli associati per attività mutuali" },
    {
      code: 3,
      label: "Entrate per prestazioni e cessioni ad associati e fondatori",
    },
    { code: 4, label: "Erogazioni liberali" },
    { code: 5, label: "Entrate del 5 per mille" },
    { code: 6, label: "Contributi da soggetti privati" },
    { code: 7, label: "Entrate per prestazioni e cessioni a terzi" },
    { code: 8, label: "Contributi da enti pubblici" },
    { code: 9, label: "Entrate da contratti con enti pubblici" },
    { code: 10, label: "Altre entrate" },
  ],
  hideSecondary: true,
};

const ENTRATE_AD_CONFIG: NestedConfig = {
  primary: [
    {
      code: 1,
      label: "Entrate per prestazioni e cessioni ad associati e fondatori",
    },
    { code: 2, label: "Contributi da soggetti privati" },
    {
      code: 3,
      label: "Entrate per prestazioni e cessioni a terzi (sponsorizzazioni)",
    },
    { code: 4, label: "Contributi da enti pubblici" },
    { code: 5, label: "Entrate da contratti con enti pubblici" },
    { code: 6, label: "Altre entrate" },
  ],
  hideSecondary: true,
};

const ENTRATE_RF_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Entrate da raccolte fondi abituali" },
    { code: 2, label: "Entrate da raccolte fondi occasionali" },
    { code: 3, label: "Altre entrate" },
  ],
  hideSecondary: true,
};

const ENTRATE_AFP_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Da rapporti bancari" },
    { code: 2, label: "Da altri investimenti finanziari" },
    { code: 3, label: "Da patrimonio edilizio" },
    { code: 4, label: "Da altri beni patrimoniali" },
    { code: 5, label: "Altre entrate" },
  ],
  secondary: {
    1: ["Interessi attivi", "Altro"],
    2: ["Interessi attivi", "Altro"],
    3: ["Affitti attivi", "Altro"],
  },
  forceTextAfterPrimary: [4, 5],
};

const ENTRATE_SUPPORTO_GENERALE_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Entrate da distacco del personale" },
    { code: 2, label: "Altre entrate di supporto generale" },
  ],
  hideSecondary: true,
};

const ENTRATE_INVESTIMENTI_CONFIG: NestedConfig = {
  primary: [
    {
      code: 1,
      label: "Disinvestimenti di immobilizzazioni inerenti alle attività di interesse generale",
    },
    {
      code: 2,
      label: "Disinvestimenti di immobilizzazioni inerenti alle attività diverse",
    },
    { code: 3, label: "Disinvestimenti di attività finanziarie e patrimoniali" },
    { code: 4, label: "Ricevimento di finanziamenti e di prestiti" },
  ],
  hideSecondary: true,
};

function getConfig(
  tipologia: Tipologia | "",
  macro: Macro | ""
): NestedConfig | null {
  if (tipologia === "USCITA" && macro === "AIG") return USCITE_AIG_CONFIG;
  if (tipologia === "USCITA" && macro === "ATTIVITA_DIVERSE")
    return USCITE_AD_CONFIG;
  if (tipologia === "USCITA" && macro === "RACCOLTE_FONDI")
    return USCITE_RF_CONFIG;
  if (
    tipologia === "USCITA" &&
    macro === "ATTIVITA_FINANZIARIA_PATRIMONIALE"
  )
    return USCITE_AFP_CONFIG;
  if (tipologia === "USCITA" && macro === "SUPPORTO_GENERALE")
    return USCITE_SUPPORTO_GENERALE_CONFIG;
  if (tipologia === "USCITA" && macro === "INVESTIMENTO_DISINVESTIMENTO")
    return USCITE_INVESTIMENTI_CONFIG;

  if (tipologia === "ENTRATA" && macro === "AIG") return ENTRATE_AIG_CONFIG;
  if (tipologia === "ENTRATA" && macro === "ATTIVITA_DIVERSE")
    return ENTRATE_AD_CONFIG;
  if (tipologia === "ENTRATA" && macro === "RACCOLTE_FONDI")
    return ENTRATE_RF_CONFIG;
  if (
    tipologia === "ENTRATA" &&
    macro === "ATTIVITA_FINANZIARIA_PATRIMONIALE"
  )
    return ENTRATE_AFP_CONFIG;
  if (tipologia === "ENTRATA" && macro === "SUPPORTO_GENERALE")
    return ENTRATE_SUPPORTO_GENERALE_CONFIG;
  if (tipologia === "ENTRATA" && macro === "INVESTIMENTO_DISINVESTIMENTO")
    return ENTRATE_INVESTIMENTI_CONFIG;

  return null;
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
  const [conto, setConto] = useState<Conto>("CASSA");

  const [descrizioneCode, setDescrizioneCode] = useState<number | null>(null);
  const [descrizioneLabel, setDescrizioneLabel] = useState("");
  const [descrizioneLivello2, setDescrizioneLivello2] = useState("");
  const [descrizioneLibera, setDescrizioneLibera] = useState("");

  const [importo, setImporto] = useState("");
  const [iva, setIva] = useState("0");
  const [descrOperazione, setDescrOperazione] = useState("");

  const [regime, setRegime] = useState<Regime>("ORDINARIO");

  const isEntrataOrUscita = tipologia === "ENTRATA" || tipologia === "USCITA";
  const isAvanzo =
    tipologia === "AVANZO_CASSA_T_1" || tipologia === "AVANZO_BANCA_T_1";
  const isRegimeOrdinario = regime === "ORDINARIO";
  const showIvaField = isEntrataOrUscita && isRegimeOrdinario;

  const config = useMemo(() => getConfig(tipologia, macro), [tipologia, macro]);

  const primaryOptions = config?.primary ?? [];
  const secondaryOptions =
    descrizioneCode && config?.secondary?.[descrizioneCode]
      ? config.secondary[descrizioneCode]
      : [];

  const showSecondarySelect = useMemo(() => {
    if (!config || config.hideSecondary) return false;
    if (!descrizioneCode) return false;
    return secondaryOptions.length > 0;
  }, [config, descrizioneCode, secondaryOptions]);

  const needsTextAfterPrimary = useMemo(() => {
    if (!config || !descrizioneCode) return false;
    return (config.forceTextAfterPrimary ?? []).includes(descrizioneCode);
  }, [config, descrizioneCode]);

  const needsTextAfterSecondary = useMemo(() => {
    if (!config || !descrizioneCode || !descrizioneLivello2) return false;
    return (config.forceTextAfterSecondary ?? []).some(
      (r) =>
        r.primaryCode === descrizioneCode &&
        r.secondaryValues.includes(descrizioneLivello2)
    );
  }, [config, descrizioneCode, descrizioneLivello2]);

  const shouldShowDescrizioneLibera = useMemo(() => {
    if (isAvanzo) return false;
    if (!isEntrataOrUscita) return false;
    if (!macro) return false;
    if (macro === "IMPOSTE" && tipologia === "USCITA") return true;
    if (!config) return false;
    if (!descrizioneCode) return false;
    if (showSecondarySelect) {
      if (!descrizioneLivello2) return false;
      return true;
    }
    if (needsTextAfterPrimary || needsTextAfterSecondary) return true;
    return true;
  }, [
    isAvanzo,
    isEntrataOrUscita,
    macro,
    tipologia,
    config,
    descrizioneCode,
    showSecondarySelect,
    descrizioneLivello2,
    needsTextAfterPrimary,
    needsTextAfterSecondary,
  ]);

  /* =========================
     LOAD REGIME ANNUALITA
  ========================= */
  useEffect(() => {
    const loadRegime = async () => {
      const ls = localStorage.getItem("annualita_regime") as Regime | null;
      if (ls === "FORFETTARIO" || ls === "ORDINARIO") {
        setRegime(ls);
        return;
      }
      if (!annualitaId) return;
      const { data, error } = await supabase
        .from("annualita")
        .select("regime")
        .eq("id", annualitaId)
        .single();

      if (
        !error &&
        (data?.regime === "FORFETTARIO" || data?.regime === "ORDINARIO")
      ) {
        setRegime(data.regime);
        localStorage.setItem("annualita_regime", data.regime);
      }
    };

    loadRegime();
  }, [annualitaId]);

  useEffect(() => {
    if (!showIvaField) setIva("0");
  }, [showIvaField]);

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
      setMacro((row.macro as Macro) || "");
      setConto((row.conto as Conto) || "CASSA");
      setDescrizioneCode(row.descrizione_code ?? null);
      setImporto(String(row.importo ?? ""));
      setIva(String(row.iva ?? 0));
      setDescrOperazione((row.descrizione_operazione ?? "").toString());

      const fullLabel = String(row.descrizione_label ?? "");
      setDescrizioneLabel(fullLabel);

      const parts = fullLabel
        .split(" | ")
        .map((x: string) => x.trim())
        .filter(Boolean);

      if (parts.length >= 2) {
        setDescrizioneLivello2(parts[1]);
      }
      if (parts.length >= 3) {
        setDescrizioneLibera(parts.slice(2).join(" | "));
      } else {
        setDescrizioneLibera("");
      }

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
    setDescrizioneLivello2("");
    setDescrizioneLibera("");
    setImporto("");
    setIva("0");
    setDescrOperazione("");
  }, [tipologia, editId]);

  useEffect(() => {
    if (editId) return;
    setConto("CASSA");
    setDescrizioneCode(null);
    setDescrizioneLabel("");
    setDescrizioneLivello2("");
    setDescrizioneLibera("");
    setImporto("");
    setIva("0");
    setDescrOperazione("");
  }, [macro, editId]);

  useEffect(() => {
    if (editId) return;
    setDescrizioneLivello2("");
    setDescrizioneLibera("");
    const item = primaryOptions.find((x) => x.code === descrizioneCode);
    setDescrizioneLabel(item?.label || "");
  }, [descrizioneCode, editId, primaryOptions]);

  useEffect(() => {
    if (editId) return;
    if (!descrizioneCode) return;

    const item = primaryOptions.find((x) => x.code === descrizioneCode);
    const primaryLabel = item?.label || "";

    if (descrizioneLivello2) {
      setDescrizioneLabel(`${primaryLabel} | ${descrizioneLivello2}`);
    } else {
      setDescrizioneLabel(primaryLabel);
    }
  }, [descrizioneLivello2, descrizioneCode, primaryOptions, editId]);

  useEffect(() => {
    if (editId) return;
    if (!descrizioneCode) return;

    const item = primaryOptions.find((x) => x.code === descrizioneCode);
    const primaryLabel = item?.label || "";

    let finalLabel = primaryLabel;

    if (descrizioneLivello2) {
      finalLabel += ` | ${descrizioneLivello2}`;
    }
    if (descrizioneLibera.trim()) {
      finalLabel += ` | ${descrizioneLibera.trim()}`;
    }

    setDescrizioneLabel(finalLabel);
  }, [
    descrizioneLibera,
    descrizioneLivello2,
    descrizioneCode,
    primaryOptions,
    editId,
  ]);

  /* =========================
     SALVA
  ========================= */
  const salva = async () => {
    setError(null);

    if (!annualitaId) return setError("Annualità non selezionata");

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return setError("Utente non autenticato");

    if (!tipologia) return setError("Seleziona la tipologia");

    if (showIvaField && !isValidIva(iva)) {
      setError("IVA non valida");
      return;
    }

    if (!isAvanzo) {
      if (!data || !macro || !isValidMoney(importo)) {
        setError("Compila tutti i campi obbligatori");
        return;
      }

      if (macro === "IMPOSTE" && tipologia === "USCITA") {
        if (!descrizioneLibera.trim()) {
          setError("Inserisci la descrizione");
          return;
        }
      } else {
        if (!descrizioneCode) {
          setError("Seleziona la descrizione codificata");
          return;
        }

        if (showSecondarySelect && !descrizioneLivello2.trim()) {
          setError("Seleziona il dettaglio della descrizione");
          return;
        }

        if (shouldShowDescrizioneLibera && !descrizioneLibera.trim()) {
          setError("Inserisci la descrizione personale aggiuntiva");
          return;
        }
      }

      if (!descrOperazione.trim()) {
        setError("Inserisci la descrizione dell’operazione");
        return;
      }
    } else {
      if (!isValidMoney(importo)) {
        setError("Importo non valido");
        return;
      }
    }

    const descrOperazioneFinale = isAvanzo
      ? tipologia === "AVANZO_CASSA_T_1"
        ? "Avanzo cassa t-1"
        : "Avanzo banca t-1"
      : descrOperazione.trim();

    const descrizioneLabelFinale = isAvanzo
      ? null
      : macro === "IMPOSTE" && tipologia === "USCITA"
      ? descrizioneLibera.trim()
      : descrizioneLabel || null;

    const payload: any = {
      user_id: userData.user.id,
      annualita_id: annualitaId,
      tipologia,
      data: isAvanzo ? null : data || null,
      macro: isAvanzo ? null : macro || null,
      conto: isAvanzo
        ? tipologia === "AVANZO_CASSA_T_1"
          ? "CASSA"
          : "BANCA"
        : isEntrataOrUscita
        ? conto
        : null,
      descrizione_code:
        isAvanzo || (macro === "IMPOSTE" && tipologia === "USCITA")
          ? null
          : descrizioneCode,
      descrizione_label: descrizioneLabelFinale,
      importo: Number(importo),
      iva: showIvaField ? Number(iva || 0) : 0,
      descrizione_operazione: descrOperazioneFinale,
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
      <div className="pageHeader" style={{ paddingTop: 15 }}>
        <div>
          <h2 className="pageTitle">
            {editId ? "Modifica movimento" : "Nuovo Movimento"}
          </h2>
          <div className="pageHelp">
            Seleziona tipologia, data e categoria. Le altre tendine compariranno
            in automatico in base alla scelta effettuata.
          </div>
        </div>
      </div>

      <Card title="1️⃣ Tipologia">
        <select
          value={tipologia}
          onChange={(e) => setTipologia(e.target.value as Tipologia | "")}
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
              onChange={(e) => setMacro(e.target.value as Macro | "")}
              className="input"
            >
              <option value="">Seleziona…</option>
              <option value="AIG">AIG</option>
              <option value="ATTIVITA_DIVERSE">Attività Diverse</option>
              <option value="RACCOLTE_FONDI">Raccolte Fondi</option>
              <option value="ATTIVITA_FINANZIARIA_PATRIMONIALE">
                Attività Finanziaria e Patrimoniale
              </option>
              <option value="SUPPORTO_GENERALE">Supporto Generale</option>
              <option value="INVESTIMENTO_DISINVESTIMENTO">
                Investimento e Disinvestimento
              </option>
              <option value="IMPOSTE">Imposte</option>
            </select>
          </Card>
        </>
      )}

      {isEntrataOrUscita && macro && (
        <Card title="4️⃣ Banca / Cassa">
          <select
            value={conto}
            onChange={(e) => setConto(e.target.value as Conto)}
            className="input"
          >
            <option value="CASSA">Cassa</option>
            <option value="BANCA">Banca</option>
          </select>
        </Card>
      )}

      {tipologia === "USCITA" && macro === "SUPPORTO_GENERALE" && (
        <Card title="ℹ️ Nota">
          <div style={{ lineHeight: 1.45 }}>
            Le spese di <b>Supporto Generale</b> saranno salvate come movimenti
            autonomi e dovranno poi essere <b>ripartite automaticamente</b> tra
            AIG, Attività Diverse e Raccolte Fondi nella logica dei riepiloghi.
          </div>
        </Card>
      )}

      {isEntrataOrUscita &&
        macro &&
        !(tipologia === "USCITA" && macro === "IMPOSTE") &&
        primaryOptions.length > 0 && (
          <Card title="5️⃣ Descrizione codificata">
            <select
              value={descrizioneCode ?? ""}
              onChange={(e) =>
                setDescrizioneCode(e.target.value ? Number(e.target.value) : null)
              }
              className="input"
            >
              <option value="">Seleziona…</option>
              {primaryOptions.map((v) => (
                <option key={v.code} value={v.code}>
                  {v.code}) {v.label}
                </option>
              ))}
            </select>
          </Card>
        )}

      {showSecondarySelect && (
        <Card title="6️⃣ Dettaglio descrizione">
          <select
            value={descrizioneLivello2}
            onChange={(e) => setDescrizioneLivello2(e.target.value)}
            className="input"
          >
            <option value="">Seleziona…</option>
            {secondaryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Card>
      )}

      {((tipologia === "USCITA" && macro === "IMPOSTE") ||
        shouldShowDescrizioneLibera) && (
        <Card
          title={
            tipologia === "USCITA" && macro === "IMPOSTE"
              ? "5️⃣ Descrizione"
              : showSecondarySelect
              ? "7️⃣ Descrizione personale (aggiuntiva)"
              : "6️⃣ Descrizione personale (aggiuntiva)"
          }
        >
          <input
            value={descrizioneLibera}
            onChange={(e) => setDescrizioneLibera(e.target.value)}
            className="input"
            placeholder="Inserisci una descrizione aggiuntiva"
          />
        </Card>
      )}

      {tipologia && (
        <>
          <Card title="8️⃣ Importo">
            <input
              type="number"
              value={importo}
              onChange={(e) => setImporto(e.target.value)}
              className="input"
              placeholder="0,00"
              step="0.01"
              min={0}
            />
          </Card>

          {showIvaField && (
            <Card title="9️⃣ IVA (solo regime ordinario)">
              <input
                type="number"
                value={iva}
                onChange={(e) => setIva(e.target.value)}
                className="input"
                placeholder="0,00"
                step="0.01"
                min={0}
              />
              <div className="rowSub" style={{ marginTop: 8 }}>
                Inserisci <b>0</b> se l’operazione non prevede IVA.
              </div>
            </Card>
          )}

          {isEntrataOrUscita && (
            <Card title="🔟 Descrizione operazione">
              <input
                value={descrOperazione}
                onChange={(e) => setDescrOperazione(e.target.value)}
                className="input"
                placeholder="Es. Fattura n. X • Bolletta • quota • ricevuta • ecc."
              />
            </Card>
          )}
        </>
      )}

      {error && (
        <div style={{ marginTop: 14, marginBottom: 10 }}>
          <Badge tone="red">Errore</Badge>
          <div className="errorText">{error}</div>
        </div>
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
