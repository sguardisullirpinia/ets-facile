const SCHEMA = {
  ENTRATA: {
    AIG: {
      primary: [
        { code: 1, label: 'Entrate da quote associative e apporti dei fondatori' },
        { code: 2, label: 'Entrate dagli associati per attività mutuali' },
        { code: 3, label: 'Entrate per prestazioni e cessioni ad associati e fondatori' },
        { code: 4, label: 'Erogazioni liberali' },
        { code: 5, label: 'Entrate del 5 per mille' },
        { code: 6, label: 'Contributi da soggetti privati' },
        { code: 7, label: 'Entrate per prestazioni e cessioni a terzi' },
        { code: 8, label: 'Contributi da enti pubblici' },
        { code: 9, label: 'Entrate da contratti con enti pubblici' },
        { code: 10, label: 'Altre entrate' },
        { code: 99, label: 'Altro' },
      ],
      hideSecondary: true,
    },
    ATTIVITA_DIVERSE: {
      primary: [
        { code: 1, label: 'Entrate per prestazioni e cessioni ad associati e fondatori' },
        { code: 2, label: 'Contributi da soggetti privati' },
        { code: 3, label: 'Entrate per prestazioni e cessioni a terzi (sponsorizzazioni)' },
        { code: 4, label: 'Contributi da enti pubblici' },
        { code: 5, label: 'Entrate da contratti con enti pubblici' },
        { code: 6, label: 'Altre entrate' },
        { code: 99, label: 'Altro' },
      ],
      hideSecondary: true,
    },
    RACCOLTE_FONDI: {
      primary: [
        { code: 1, label: 'Entrate da raccolte fondi abituali' },
        { code: 2, label: 'Entrate da raccolte fondi occasionali' },
        { code: 3, label: 'Altre entrate' },
        { code: 99, label: 'Altro' },
      ],
      hideSecondary: true,
    },
    ATTIVITA_FINANZIARIA_PATRIMONIALE: {
      primary: [
        { code: 1, label: 'Da rapporti bancari' },
        { code: 2, label: 'Da altri investimenti finanziari' },
        { code: 3, label: 'Da patrimonio edilizio' },
        { code: 4, label: 'Da altri beni patrimoniali' },
        { code: 5, label: 'Altre entrate' },
        { code: 99, label: 'Altro' },
      ],
      secondary: {
        1: ['Interessi attivi', 'Altro'],
        2: ['Interessi attivi', 'Altro'],
        3: ['Affitti attivi', 'Altro'],
        4: ['Altro'],
        5: ['Altro'],
        99: ['Altro'],
      },
    },
    SUPPORTO_GENERALE: {
      primary: [
        { code: 1, label: 'Entrate da distacco del personale' },
        { code: 2, label: 'Altre entrate di supporto generale' },
        { code: 99, label: 'Altro' },
      ],
      hideSecondary: true,
    },
    INVESTIMENTO_DISINVESTIMENTO: {
      primary: [
        { code: 1, label: 'Disinvestimenti di immobilizzazioni inerenti alle attività di interesse generale' },
        { code: 2, label: 'Disinvestimenti di immobilizzazioni inerenti alle attività diverse' },
        { code: 3, label: 'Disinvestimenti di attività finanziarie e patrimoniali' },
        { code: 4, label: 'Ricevimento di finanziamenti e di prestiti' },
        { code: 99, label: 'Altro' },
      ],
      hideSecondary: true,
    },
  },
  USCITA: {
    AIG: {
      primary: [
        { code: 1, label: 'Materie prime, sussidiarie, di consumo e di merci' },
        { code: 2, label: 'Servizi' },
        { code: 3, label: 'Godimento beni di terzi' },
        { code: 4, label: 'Personale' },
        { code: 5, label: 'Uscite diverse di gestione' },
        { code: 99, label: 'Altro' },
      ],
      secondary: {
        1: [
          'acquisti di beni', 'cancelleria e stampati', 'carburanti e lubrificanti',
          'combustibile per riscaldamento', 'costi accessori di acquisto di beni se addebitati dal fornitore (trasporti, spese di magazzino, etc)',
          'Imballaggi', 'indumenti di lavoro', 'materiale di consumo per manutenzioni e pulizie', 'materie prime', 'materie sussidiarie',
          'Semilavorati', 'Generi alimentari, vestiario, igiene', 'Medicinali e presidi sanitari (umani e veterinari)', 'Cibo per animali',
          'Carburante automezzo associativo', 'Cancelleria', 'Casalinghi e ferramenta', 'Materiale di consumo per manutenzioni e pulizia',
          'Dispositivi di protezione individuale', 'Attrezzature e macchinari di costo inferiore a € 517', 'indumenti da lavoro, divise', 'Altro',
        ],
        2: [
          'Aggiornamento e formazione', 'Altri servizi resi da banche ed imprese finanziarie non collegati ad operazioni di finanziamento',
          'Assicurazioni varie', 'Canoni di assistenza tecnica', 'Commissioni per servizi di pagamento', 'Compensi ai componenti dell’organo di controllo ed ai revisori legali',
          'Compenso all’organo amministrativo', 'Compensi per collaborazioni coordinate e continuative', 'Consulenze', 'Costi per custodia di titoli',
          'Costi per il personale distaccato presso l’ente e dipendenti da altri enti', 'Costi per mensa (se gestita da terzi)', 'Energia elettrice, acqua, gas, telefono',
          'Indennità di fine rapporto connesse a co.co.co.', 'Indennità chilometriche', 'Lavanderia indumenti da lavoro', 'Lavorazioni esterne',
          'Noleggio di cassette di sicurezza', 'Pubblicità e promozione', 'Rimborsi spese a piè di lista', 'Servizi di manutenzione (attrezzature e mobili etc)',
          'Servizi di pulizia', 'Servizi di smaltimento rifiuti', 'Servizi di vigilanza', 'Servizi di elaborazione dati', 'Spese di rappresentanza',
          'Spese di ricerca, addestramento e formazione', 'Spese di vitto ed alloggio a titolo di spesa di trasferta', 'Spese legali e consulenze',
          'Spese per analisi e prove di laboratorio', 'Spese postali', 'Trasporti nel casi in cui gli stessi siano inclusi dal fornitore del bene nel prezzo di acquisto',
          'Viaggi e trasferte (biglietti aereo, treno, taxi, etc)', 'Utenze telefoniche, elettriche, idriche, gas', 'Spese Condominio',
          'Pedaggio autostradale per automezzo associativo', 'Manutenzioni, riparazioni e servizi di pulizia', 'Canoni assistenza tecnica',
          'Servizi tipografici e di elaborazione grafica', 'Assicurazioni varie (diverse dalla polizza del volontariato)', 'Spese postali e di spedizione',
          'Spese accensione fidejussione', 'Polizza assicurazione copertura RC infortunio e malattia',
          'Lavoro autonomo e occasionale Costo lordo (comprensivo di ritenuta d’acconto, IRAP)', 'Contratti collaborazione occasionale',
          'Parcelle liberi professionisti', 'Canone sito web, PEC, firma digitale, licenze software', 'Altro',
        ],
        3: [
          'Affitti e locazioni', 'Canoni corrisposti per usufrutto, enfiteusi e diritto di superficie', 'Diritto d’autore', 'Leasing finanziario',
          'Leasing operativo', 'Noleggio attrezzature, impianti, macchinari, autoveicoli, etc.', 'Oneri accessori agli affitti (spese condominiali, imposta di registro)',
          'Royalties', 'Utilizzo brevetti', 'Affitto sede', 'Noleggio sale e attrezzature', 'Leasing', 'Diritti per utilizzo di opere dell’ingegno, diritti d’autore, licenze e marchi (SIAE)', 'Altro',
        ],
        4: [
          'Retribuzione in denaro', 'Retribuzione in natura', 'Premi ed altri elementi simili', 'Oneri previdenziali a carico dell’ente',
          'Oneri assistenziali a carico dell’ente (es. inail)', 'Trattamento di fine rapporto', 'Trattamento di quiescenza e simili',
          'Transazioni con i dipendenti', 'Servizio sanitario', 'Quote associative a favore dei dipendenti', 'Sussidi occasionali (matrimoni, nascite, funerali)',
          'Borse di studio a favore dei dipendenti e loro familiari', 'Omaggi a dipendenti', 'Incentivi all’esodo', 'Altro',
        ],
        5: [
          'Imposte sostitutive', 'Imposte di bollo', 'Tributi locali', 'Imposta di registro', 'Imposte ipotecarie e catastali',
          'Tassa di concessione governativa', 'Tesse di circolazione', 'Tassa sui rifiuti', 'Altre imposte e tasse', 'Contributi ad associazioni sindacali di categoria',
          'Abbonamenti a riviste e giornali', 'Costi per la mensa gestita interamente', 'Sopravvenienze passive', 'Liberalità omaggi ed articoli promozionali',
          'Spese per deposito e pubblicazione di bilanci, verbali assemblee, etc', 'Oneri per multe, ammende e sanzioni', 'Borse di studio e premi',
          'Quote associative a federazioni, affiliazioni', 'Abbonamenti a giornali e riviste', 'Omaggi e spese di rappresentanza', 'Imposte e tasse',
          'Multe e ammende', 'Rimborso spese Volontari', 'Vitto', 'Alloggio', 'Trasporti', 'rimborso chilometrico auto propria',
          'Erogazione di denaro a sostegno di persone svantaggiate', 'Erogazione di denaro a ETS che svolgono attività a sostegno di persone svantaggiate',
          'Acquisto beni e servizi da donare', 'Altro',
        ],
        99: ['Altro'],
      },
    },
    ATTIVITA_DIVERSE: null,
    RACCOLTE_FONDI: {
      primary: [
        { code: 1, label: 'Uscite per raccolte fondi abituali' },
        { code: 2, label: 'Uscite per raccolte fondi occasionali' },
        { code: 3, label: 'Altre uscite' },
        { code: 99, label: 'Altro' },
      ],
      hideSecondary: true,
    },
    ATTIVITA_FINANZIARIA_PATRIMONIALE: {
      primary: [
        { code: 1, label: 'Su rapporti bancari' },
        { code: 2, label: 'Su investimenti finanziari' },
        { code: 3, label: 'Su patrimonio edilizio' },
        { code: 4, label: 'Su altri beni patrimoniali' },
        { code: 5, label: 'Altre uscite' },
        { code: 99, label: 'Altro' },
      ],
      secondary: {
        1: ['costi fissi bancari o postali', 'Commissioni bancarie o postali', 'interessi passivi', 'imposte', 'Altro'],
        2: ['Interessi su finanziamenti ottenuti da banche ed altri istituti di credito', 'Commissioni passive su finanziamenti', 'Interessi passivi su dilazioni ottenute da fornitori ed interessi di mora', 'Altro'],
        3: ['Manutenzioni straordinarie sul patrimonio edilizio', 'IMU', 'Spese condominiali', 'Altro'],
        4: ['Altro'],
        5: ['Altro'],
        99: ['Altro'],
      },
    },
    SUPPORTO_GENERALE: {
      primary: [
        { code: 1, label: 'Materie prime, sussidiarie, di consumo e di merci' },
        { code: 2, label: 'Servizi' },
        { code: 3, label: 'Godimento beni di terzi' },
        { code: 4, label: 'Personale' },
        { code: 5, label: 'Altre uscite' },
        { code: 99, label: 'Altro' },
      ],
      hideSecondary: true,
    },
    INVESTIMENTO_DISINVESTIMENTO: {
      primary: [
        { code: 1, label: 'Investimenti in immobilizzazioni inerenti alle attività di interesse generale' },
        { code: 2, label: 'Investimenti in immobilizzazioni inerenti alle attività diverse' },
        { code: 3, label: 'Investimenti in attività finanziarie e patrimoniali' },
        { code: 4, label: 'Rimborso di finanziamenti per quota capitale e di prestiti' },
        { code: 99, label: 'Altro' },
      ],
      secondary: {
        1: ['Acquisto beni strumentali di valore superiore 516 euro', 'Altro'],
        2: ['Acquisto beni strumentali di valore superiore 516 euro', 'Altro'],
        3: ['Immobili ad uso investimento', 'Titoli, azioni', 'Altro'],
        4: ['Quota capitale mutuo', 'Altro'],
        99: ['Altro'],
      },
    },
    IMPOSTE: {
      textOnly: true,
      primary: [{ code: null, label: 'IRAP pagate nell’esercizio' }],
    },
    COSTI_GENERALI: {
      primary: [
        { code: 1, label: 'Materie prime, sussidiarie, di consumo e di merci' },
        { code: 2, label: 'Servizi' },
        { code: 3, label: 'Godimento beni di terzi' },
        { code: 4, label: 'Personale' },
        { code: 5, label: 'Altre uscite' },
        { code: 99, label: 'Altro' },
      ],
      hideSecondary: true,
    },
  },
};

SCHEMA.USCITA.ATTIVITA_DIVERSE = JSON.parse(JSON.stringify(SCHEMA.USCITA.AIG));

const MACRO_LABELS = {
  AIG: 'Attività di interesse generale',
  ATTIVITA_DIVERSE: 'Attività diverse',
  RACCOLTE_FONDI: 'Raccolte fondi',
  ATTIVITA_FINANZIARIA_PATRIMONIALE: 'Attività finanziaria e patrimoniale',
  SUPPORTO_GENERALE: 'Supporto generale',
  INVESTIMENTO_DISINVESTIMENTO: 'Investimento e disinvestimento',
  IMPOSTE: 'Imposte',
  COSTI_GENERALI: 'Costi generali',
};

function buildPrompt({ tipologia, text, macroAttuale }) {
  return `Assumi il ruolo di commercialista italiano esperto di Enti del Terzo Settore e di rendiconto per cassa ETS.

Devi classificare una singola operazione usando ESCLUSIVAMENTE lo schema fornito.
La tipologia è già stata scelta dall'utente e NON va cambiata.

Regole obbligatorie:
- Parti dalla tipologia già scelta: ${tipologia}.
- Devi scegliere una macro presente nello schema disponibile per quella tipologia.
- Devi privilegiare prima la soluzione già esistente nello schema.
- Se manca la corrispondenza perfetta, scegli la collocazione più vicina prima per specifica di categoria e poi per categoria.
- Non inventare voci fuori schema.
- Se il caso riguarda banca, interessi, spese bancarie, commissioni, rapporti bancari o patrimonio, valuta con priorità ATTIVITA_FINANZIARIA_PATRIMONIALE.
- Se il testo descrive spese trasversali di struttura, segreteria, software, consulenze generali, affitto sede, utenze sede, valuta SUPPORTO_GENERALE o COSTI_GENERALI in modo prudente.
- Usa IMPOSTE solo se chiaramente riferito a IRAP pagata nell'esercizio.
- Usa INVESTIMENTO_DISINVESTIMENTO solo per acquisti/vendite di immobilizzazioni, investimenti finanziari o prestiti/finanziamenti quota capitale.
- Per il campo descrizioneDettaglio usa una voce già presente nello schema quando possibile; se non esiste, usa 'Altro' oppure una breve formulazione residuale compatibile.
- Il conto consigliato deve essere BANCA per bonifici, addebiti, banca, interessi, RID, assegni, finanziamenti; CASSA per contanti; se non è chiaro preferisci BANCA.
- descrizioneLiberaSuggerita deve essere una breve descrizione utile per l'utente.
- motivazioneBreve massimo 2 frasi.
- Restituisci SOLO JSON valido.

Macro attualmente selezionata nel form: ${macroAttuale || 'nessuna'}.

Schema disponibile per ${tipologia}:
${JSON.stringify(SCHEMA[tipologia], null, 2)}

Testo utente: ${text}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY non configurata su Vercel' });
    }

    const tipologia = String(req.body?.tipologia || '').trim();
    const text = String(req.body?.text || '').trim();
    const macroAttuale = String(req.body?.macroAttuale || '').trim() || null;

    if (tipologia !== 'ENTRATA' && tipologia !== 'USCITA') {
      return res.status(400).json({ error: 'Tipologia non valida' });
    }

    if (!text) {
      return res.status(400).json({ error: 'Testo mancante' });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.4',
        store: false,
        input: buildPrompt({ tipologia, text, macroAttuale }),
        text: {
          format: {
            type: 'json_schema',
            name: 'ets_movimento_classifier_v2',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                macro: {
                  type: 'string',
                  enum: tipologia === 'USCITA'
                    ? ['AIG', 'ATTIVITA_DIVERSE', 'RACCOLTE_FONDI', 'ATTIVITA_FINANZIARIA_PATRIMONIALE', 'SUPPORTO_GENERALE', 'INVESTIMENTO_DISINVESTIMENTO', 'IMPOSTE', 'COSTI_GENERALI']
                    : ['AIG', 'ATTIVITA_DIVERSE', 'RACCOLTE_FONDI', 'ATTIVITA_FINANZIARIA_PATRIMONIALE', 'SUPPORTO_GENERALE', 'INVESTIMENTO_DISINVESTIMENTO'],
                },
                macroLabel: { type: 'string' },
                descrizioneCode: { type: ['integer', 'null'] },
                descrizionePrimaryLabel: { type: ['string', 'null'] },
                descrizioneDettaglio: { type: ['string', 'null'] },
                descrizioneLiberaSuggerita: { type: ['string', 'null'] },
                conto: { type: 'string', enum: ['CASSA', 'BANCA'] },
                confidenza: { type: 'number' },
                exactMatch: { type: 'boolean' },
                motivazioneBreve: { type: 'string' },
              },
              required: [
                'macro',
                'macroLabel',
                'descrizioneCode',
                'descrizionePrimaryLabel',
                'descrizioneDettaglio',
                'descrizioneLiberaSuggerita',
                'conto',
                'confidenza',
                'exactMatch',
                'motivazioneBreve',
              ],
            },
            strict: true,
          },
        },
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: json?.error?.message || 'Errore OpenAI' });
    }

    let parsed = null;
    try {
      parsed = JSON.parse(json.output_text || '{}');
    } catch {
      return res.status(502).json({ error: 'Risposta AI non leggibile' });
    }

    const macro = parsed?.macro;
    parsed.macroLabel = MACRO_LABELS[macro] || parsed.macroLabel || macro || '';

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Errore interno' });
  }
}
