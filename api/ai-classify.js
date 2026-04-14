const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SCHEMA = {
  USCITA: [
    {
      macro: "AIG",
      macroLabel: "Attività di interesse generale",
      primary: [
        {
          code: 1,
          label: "Materie prime, sussidiarie, di consumo e di merci",
          secondary: [
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
            "Altro",
          ],
        },
        {
          code: 2,
          label: "Servizi",
          secondary: [
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
            "Canone sito web, PEC, firma digitale, licenze software",
            "Altro",
          ],
        },
        {
          code: 3,
          label: "Godimento beni di terzi",
          secondary: [
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
            "Altro",
          ],
        },
        {
          code: 4,
          label: "Personale",
          secondary: [
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
            "Altro",
          ],
        },
        {
          code: 5,
          label: "Uscite diverse di gestione",
          secondary: [
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
            "Altro",
          ],
        },
        { code: 99, label: "Altro", secondary: ["Altro"] },
      ],
    },
    {
      macro: "ATTIVITA_DIVERSE",
      macroLabel: "Attività diverse",
      primary: [
        { code: 1, label: "Materie prime, sussidiarie, di consumo e di merci", secondary: ["Altro"] },
        { code: 2, label: "Servizi", secondary: ["Altro"] },
        { code: 3, label: "Godimento beni di terzi", secondary: ["Altro"] },
        { code: 4, label: "Personale", secondary: ["Altro"] },
        { code: 5, label: "Uscite diverse di gestione", secondary: ["Altro"] },
        { code: 99, label: "Altro", secondary: ["Altro"] },
      ],
    },
    {
      macro: "RACCOLTE_FONDI",
      macroLabel: "Raccolte fondi",
      primary: [
        { code: 1, label: "Uscite per raccolte fondi abituali", secondary: ["Altro"] },
        { code: 2, label: "Uscite per raccolte fondi occasionali", secondary: ["Altro"] },
        { code: 3, label: "Altre uscite", secondary: ["Altro"] },
        { code: 99, label: "Altro", secondary: ["Altro"] },
      ],
    },
    {
      macro: "ATTIVITA_FINANZIARIA_PATRIMONIALE",
      macroLabel: "Attività finanziaria e patrimoniale",
      primary: [
        {
          code: 1,
          label: "Su rapporti bancari",
          secondary: [
            "costi fissi bancari o postali",
            "Commissioni bancarie o postali",
            "interessi passivi",
            "imposte",
            "Altro",
          ],
        },
        {
          code: 2,
          label: "Su investimenti finanziari",
          secondary: [
            "Interessi su finanziamenti ottenuti da banche ed altri istituti di credito",
            "Commissioni passive su finanziamenti",
            "Interessi passivi su dilazioni ottenute da fornitori ed interessi di mora",
            "Altro",
          ],
        },
        {
          code: 3,
          label: "Su patrimonio edilizio",
          secondary: [
            "Manutenzioni straordinarie sul patrimonio edilizio",
            "IMU",
            "Spese condominiali",
            "Altro",
          ],
        },
        { code: 4, label: "Su altri beni patrimoniali", secondary: ["Altro"] },
        { code: 5, label: "Altre uscite", secondary: ["Altro"] },
        { code: 99, label: "Altro", secondary: ["Altro"] },
      ],
    },
    {
      macro: "SUPPORTO_GENERALE",
      macroLabel: "Supporto generale",
      primary: [
        { code: 1, label: "Materie prime, sussidiarie, di consumo e di merci", secondary: ["Altro"] },
        { code: 2, label: "Servizi", secondary: ["Altro"] },
        { code: 3, label: "Godimento beni di terzi", secondary: ["Altro"] },
        { code: 4, label: "Personale", secondary: ["Altro"] },
        { code: 5, label: "Altre uscite", secondary: ["Altro"] },
        { code: 99, label: "Altro", secondary: ["Altro"] },
      ],
    },
    {
      macro: "INVESTIMENTO_DISINVESTIMENTO",
      macroLabel: "Investimento e disinvestimento",
      primary: [
        {
          code: 1,
          label: "Investimenti in immobilizzazioni inerenti alle attività di interesse generale",
          secondary: ["Acquisto beni strumentali di valore superiore 516 euro", "Altro"],
        },
        {
          code: 2,
          label: "Investimenti in immobilizzazioni inerenti alle attività diverse",
          secondary: ["Acquisto beni strumentali di valore superiore 516 euro", "Altro"],
        },
        {
          code: 3,
          label: "Investimenti in attività finanziarie e patrimoniali",
          secondary: ["Immobili ad uso investimento", "Titoli, azioni", "Altro"],
        },
        {
          code: 4,
          label: "Rimborso di finanziamenti per quota capitale e di prestiti",
          secondary: ["Quota capitale mutuo", "Altro"],
        },
        { code: 99, label: "Altro", secondary: ["Altro"] },
      ],
    },
    {
      macro: "IMPOSTE",
      macroLabel: "Imposte",
      primary: [
        {
          code: 1,
          label: "IRAP pagate nell’esercizio",
          secondary: ["IRAP pagate nell’esercizio"],
        },
      ],
    },
    {
      macro: "COSTI_GENERALI",
      macroLabel: "Costi generali",
      primary: [
        { code: 1, label: "Materie prime, sussidiarie, di consumo e di merci", secondary: ["Altro"] },
        { code: 2, label: "Servizi", secondary: ["Altro"] },
        { code: 3, label: "Godimento beni di terzi", secondary: ["Altro"] },
        { code: 4, label: "Personale", secondary: ["Altro"] },
        { code: 5, label: "Altre uscite", secondary: ["Altro"] },
        { code: 99, label: "Altro", secondary: ["Altro"] },
      ],
    },
  ],
  ENTRATA: [
    {
      macro: "AIG",
      macroLabel: "Attività di interesse generale",
      primary: [
        { code: 1, label: "Entrate da quote associative e apporti dei fondatori", secondary: ["Altro"] },
        { code: 2, label: "Entrate dagli associati per attività mutuali", secondary: ["Altro"] },
        { code: 3, label: "Entrate per prestazioni e cessioni ad associati e fondatori", secondary: ["Altro"] },
        { code: 4, label: "Erogazioni liberali", secondary: ["Altro"] },
        { code: 5, label: "Entrate del 5 per mille", secondary: ["Altro"] },
        { code: 6, label: "Contributi da soggetti privati", secondary: ["Altro"] },
        { code: 7, label: "Entrate per prestazioni e cessioni a terzi", secondary: ["Altro"] },
        { code: 8, label: "Contributi da enti pubblici", secondary: ["Altro"] },
        { code: 9, label: "Entrate da contratti con enti pubblici", secondary: ["Altro"] },
        { code: 10, label: "Altre entrate", secondary: ["Altro"] },
        { code: 99, label: "Altro", secondary: ["Altro"] },
      ],
    },
    {
      macro: "ATTIVITA_DIVERSE",
      macroLabel: "Attività diverse",
      primary: [
        { code: 1, label: "Entrate per prestazioni e cessioni ad associati e fondatori", secondary: ["Altro"] },
        { code: 2, label: "Contributi da soggetti privati", secondary: ["Altro"] },
        { code: 3, label: "Entrate per prestazioni e cessioni a terzi (sponsorizzazioni)", secondary: ["Altro"] },
        { code: 4, label: "Contributi da enti pubblici", secondary: ["Altro"] },
        { code: 5, label: "Entrate da contratti con enti pubblici", secondary: ["Altro"] },
        { code: 6, label: "Altre entrate", secondary: ["Altro"] },
        { code: 99, label: "Altro", secondary: ["Altro"] },
      ],
    },
    {
      macro: "RACCOLTE_FONDI",
      macroLabel: "Raccolte fondi",
      primary: [
        { code: 1, label: "Entrate da raccolte fondi abituali", secondary: ["Altro"] },
        { code: 2, label: "Entrate da raccolte fondi occasionali", secondary: ["Altro"] },
        { code: 3, label: "Altre entrate", secondary: ["Altro"] },
        { code: 99, label: "Altro", secondary: ["Altro"] },
      ],
    },
    {
      macro: "ATTIVITA_FINANZIARIA_PATRIMONIALE",
      macroLabel: "Attività finanziaria e patrimoniale",
      primary: [
        { code: 1, label: "Da rapporti bancari", secondary: ["Interessi attivi", "Altro"] },
        { code: 2, label: "Da altri investimenti finanziari", secondary: ["Interessi attivi", "Altro"] },
        { code: 3, label: "Da patrimonio edilizio", secondary: ["Affitti attivi", "Altro"] },
        { code: 4, label: "Da altri beni patrimoniali", secondary: ["Altro"] },
        { code: 5, label: "Altre entrate", secondary: ["Altro"] },
        { code: 99, label: "Altro", secondary: ["Altro"] },
      ],
    },
    {
      macro: "SUPPORTO_GENERALE",
      macroLabel: "Supporto generale",
      primary: [
        { code: 1, label: "Entrate da distacco del personale", secondary: ["Altro"] },
        { code: 2, label: "Altre entrate di supporto generale", secondary: ["Altro"] },
        { code: 99, label: "Altro", secondary: ["Altro"] },
      ],
    },
    {
      macro: "INVESTIMENTO_DISINVESTIMENTO",
      macroLabel: "Investimento e disinvestimento",
      primary: [
        { code: 1, label: "Disinvestimenti di immobilizzazioni inerenti alle attività di interesse generale", secondary: ["Altro"] },
        { code: 2, label: "Disinvestimenti di immobilizzazioni inerenti alle attività diverse", secondary: ["Altro"] },
        { code: 3, label: "Disinvestimenti di attività finanziarie e patrimoniali", secondary: ["Altro"] },
        { code: 4, label: "Ricevimento di finanziamenti e di prestiti", secondary: ["Altro"] },
        { code: 99, label: "Altro", secondary: ["Altro"] },
      ],
    },
  ],
};

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function extractTextFromResponse(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  if (Array.isArray(response?.output)) {
    for (const item of response.output) {
      if (Array.isArray(item?.content)) {
        for (const content of item.content) {
          if (typeof content?.text === "string" && content.text.trim()) {
            return content.text.trim();
          }
        }
      }
    }
  }

  return "";
}

function normalizeSuggestion(parsed, tipologia) {
  const allowedMacros = (SCHEMA[tipologia] || []).map((x) => x.macro);

  const macro = allowedMacros.includes(parsed?.macro)
    ? parsed.macro
    : allowedMacros[0] || null;

  const macroConfig =
    (SCHEMA[tipologia] || []).find((x) => x.macro === macro) || null;

  let descrizioneCode = parsed?.descrizioneCode ?? null;
  if (descrizioneCode !== null) {
    descrizioneCode = safeNumber(descrizioneCode, null);
  }

  const selectedPrimary =
    macroConfig?.primary?.find((p) => p.code === descrizioneCode) ||
    macroConfig?.primary?.[0] ||
    null;

  let descrizioneDettaglio =
    typeof parsed?.descrizioneDettaglio === "string"
      ? parsed.descrizioneDettaglio.trim()
      : "";

  if (!descrizioneDettaglio && selectedPrimary?.secondary?.length) {
    descrizioneDettaglio = selectedPrimary.secondary[0];
  }

  const descrizioneLiberaSuggerita =
    typeof parsed?.descrizioneLiberaSuggerita === "string"
      ? parsed.descrizioneLiberaSuggerita.trim()
      : "";

  const contoConsigliato =
    parsed?.contoConsigliato === "BANCA" || parsed?.contoConsigliato === "CASSA"
      ? parsed.contoConsigliato
      : null;

  const confidenza = clamp(safeNumber(parsed?.confidenza, 0), 0, 100);

  return {
    macro,
    macroLabel: macroConfig?.macroLabel || "",
    descrizioneCode: selectedPrimary?.code ?? null,
    descrizionePrimaryLabel: selectedPrimary?.label || "",
    descrizioneDettaglio: descrizioneDettaglio || "",
    descrizioneLiberaSuggerita: descrizioneLiberaSuggerita || "",
    contoConsigliato,
    confidenza,
    exactMatch: Boolean(parsed?.exactMatch),
    motivazioneBreve:
      typeof parsed?.motivazioneBreve === "string"
        ? parsed.motivazioneBreve.trim()
        : "",
  };
}

async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { tipologia, testo, macroAttuale } = req.body || {};

    if (tipologia !== "ENTRATA" && tipologia !== "USCITA") {
      return res.status(400).json({ error: "Tipologia non valida" });
    }

    if (!String(testo || "").trim()) {
      return res.status(400).json({ error: "Descrizione mancante" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY mancante su Vercel" });
    }

    const schemaTipologia = SCHEMA[tipologia];

    const developerPrompt = `
Sei un commercialista italiano esperto di Enti del Terzo Settore e di rendiconto per cassa ETS.

Devi classificare un movimento secondo questo schema:
TIPOLOGIA -> CATEGORIA -> SPECIFICA DI CATEGORIA -> DETTAGLIO DELLA POSTA.

Regole obbligatorie:
1. La tipologia è già scelta dall'utente e non va cambiata.
2. Devi privilegiare sempre una soluzione già presente nello schema.
3. Se non esiste una corrispondenza perfetta, scegli la soluzione più vicina: prima la specifica di categoria, poi la categoria, poi la voce residuale.
4. Non inventare categorie fuori schema.
5. Se il movimento riguarda spese o proventi bancari, interessi, commissioni, rapporti bancari, privilegia ATTIVITA_FINANZIARIA_PATRIMONIALE.
6. Se il movimento riguarda acquisto di beni strumentali durevoli, disinvestimenti, finanziamenti, mutui, quota capitale, privilegia INVESTIMENTO_DISINVESTIMENTO.
7. Se si tratta chiaramente di IRAP pagata, usa IMPOSTE.
8. Se si tratta di costi di struttura o trasversali non direttamente imputabili a una singola attività, puoi usare SUPPORTO_GENERALE o COSTI_GENERALI.
9. Restituisci solo JSON valido, senza testo aggiuntivo.

Schema consentito:
${JSON.stringify(schemaTipologia)}
    `.trim();

    const userPrompt = `
Tipologia già scelta: ${tipologia}
Macro già selezionata dall'utente, se presente: ${macroAttuale || "nessuna"}

Testo utente:
${String(testo).trim()}

Restituisci solo JSON con questi campi:
{
  "macro": "string",
  "descrizioneCode": number,
  "descrizioneDettaglio": "string",
  "descrizioneLiberaSuggerita": "string",
  "contoConsigliato": "CASSA oppure BANCA oppure null",
  "confidenza": number,
  "exactMatch": boolean,
  "motivazioneBreve": "string"
}
    `.trim();

    const response = await openai.responses.create({
      model: "gpt-5.4",
      input: [
        { role: "developer", content: developerPrompt },
        { role: "user", content: userPrompt },
      ],
      text: {
        format: { type: "text" },
      },
    });

    const text = extractTextFromResponse(response);

    if (!text) {
      console.error("Risposta AI vuota:", response);
      return res.status(500).json({ error: "Risposta AI vuota" });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error("Errore parsing JSON AI:", text);
      return res.status(500).json({
        error: "Risposta AI non valida",
        raw: text,
      });
    }

    const normalized = normalizeSuggestion(parsed, tipologia);
    return res.status(200).json(normalized);
  } catch (error) {
    console.error("Errore route ai-classify:", error);
    return res.status(500).json({
      error: error?.message || "Errore interno nella classificazione AI",
    });
  }
}

module.exports = handler;
