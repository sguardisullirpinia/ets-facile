const CATALOG = {
  entrata: {
    AIG: [
      { code: 1, label: 'Entrate dagli associati per attività mutuali' },
      { code: 2, label: 'Prestazioni e cessioni a iscritti, associati e fondatori' },
      { code: 3, label: 'Contributi da soggetti privati' },
      { code: 4, label: 'Prestazioni e cessioni a terzi' },
      { code: 5, label: 'Contributi da enti pubblici' },
      { code: 6, label: 'Entrate da contratti con enti pubblici' },
      { code: 7, label: 'Altri ricavi, rendite e proventi' },
      { code: 8, label: 'Rimanenze finali' },
      { code: 999, label: 'Altro' },
    ],
    ATTIVITA_DIVERSE: [
      { code: 1, label: 'Prestazioni ad associati' },
      { code: 2, label: 'Contributi privati' },
      { code: 3, label: 'Prestazioni a terzi' },
      { code: 4, label: 'Contributi pubblici' },
      { code: 5, label: 'Contratti pubblici' },
      { code: 6, label: 'Sponsorizzazioni' },
      { code: 7, label: 'Altre entrate' },
      { code: 999, label: 'Altro' },
    ],
    RACCOLTE_FONDI: [
      { label: 'Liberalità monetarie' },
      { label: 'Valore di mercato liberalità non monetarie' },
      { label: 'Altri proventi' },
      { label: 'Altro' },
    ],
    QUOTE_ASSOCIATIVE: [{ label: 'Solo importo' }],
    EROGAZIONI_LIBERALI: [{ label: 'Solo importo' }],
    PROVENTI_5X1000: [{ label: 'Solo importo' }],
    CONTRIBUTI_PA_SENZA_CORRISPETTIVO: [{ label: 'Solo importo' }],
    ALTRI_PROVENTI_NON_COMMERCIALI: [{ label: 'Solo importo' }],
  },
  uscita: {
    AIG: [
      { code: 1, label: 'Materie prime' },
      { code: 2, label: 'Servizi' },
      { code: 3, label: 'Godimento beni di terzi' },
      { code: 4, label: 'Personale' },
      { code: 5, label: 'Ammortamenti' },
      { code: 6, label: 'Accantonamenti' },
      { code: 7, label: 'Oneri e uscite diverse' },
      { code: 8, label: 'Rimanenze iniziali' },
      { code: 9, label: 'Costi su rapporti bancari' },
      { code: 10, label: 'Costi su prestiti' },
      { code: 999, label: 'Altro' },
    ],
    ATTIVITA_DIVERSE: [
      { code: 1, label: 'Materie prime' },
      { code: 2, label: 'Servizi' },
      { code: 3, label: 'Godimento beni di terzi' },
      { code: 4, label: 'Personale' },
      { code: 5, label: 'Uscite diverse' },
      { code: 999, label: 'Altro' },
    ],
    RACCOLTE_FONDI: [
      { label: 'Oneri per acquisto beni' },
      { label: 'Oneri per acquisto servizi' },
      { label: 'Oneri per noleggi, affitti o utilizzo attrezzature' },
      { label: 'Oneri promozionali per la raccolta' },
      { label: 'Oneri per lavoro dipendente o autonomo' },
      { label: 'Oneri per rimborsi a volontari' },
      { label: 'Altri oneri' },
      { label: 'Altro' },
    ],
    COSTI_GENERALI: [{ label: 'Costo generale unico' }],
  },
};

function buildPrompt(text) {
  return `Assumi il ruolo di commercialista italiano esperto di Enti del Terzo Settore.
Devi classificare una singola operazione contabile per l'app ETS-FACILE.

Regole:
- Interpreta il testo liberamente anche se impreciso, incompleto o colloquiale.
- Scegli SEMPRE una tipologia tra ENTRATA e USCITA.
- Scegli SEMPRE una macro tra quelle disponibili per la tipologia scelta.
- Se il testo non combacia bene con nessuna voce specifica, usa la voce residuale Altro dove disponibile.
- Se la macro è una di quelle a solo importo (QUOTE_ASSOCIATIVE, EROGAZIONI_LIBERALI, PROVENTI_5X1000, CONTRIBUTI_PA_SENZA_CORRISPETTIVO, ALTRI_PROVENTI_NON_COMMERCIALI), la descrizione codificata non serve.
- Per RACCOLTE_FONDI usa descrizione_code = null e valorizza descrizione_label.
- Per COSTI_GENERALI usa descrizione_code = null e descrizione_label = null.
- Scegli un conto consigliato: BANCA se è probabile un movimento su conto corrente o bonifico; CASSA se è probabile un movimento in contanti. Se non è chiaro, BANCA.
- Dai una spiegazione sintetica.
- Dai un livello di confidenza da 0 a 1.

Catalogo consentito:
${JSON.stringify(CATALOG, null, 2)}

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

    const text = String(req.body?.text || '').trim();
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
        input: buildPrompt(text),
        text: {
          format: {
            type: 'json_schema',
            name: 'ets_movimento_classifier',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                tipologia: { type: 'string', enum: ['ENTRATA', 'USCITA'] },
                macro: {
                  type: 'string',
                  enum: [
                    'AIG',
                    'ATTIVITA_DIVERSE',
                    'RACCOLTE_FONDI',
                    'QUOTE_ASSOCIATIVE',
                    'EROGAZIONI_LIBERALI',
                    'PROVENTI_5X1000',
                    'CONTRIBUTI_PA_SENZA_CORRISPETTIVO',
                    'ALTRI_PROVENTI_NON_COMMERCIALI',
                    'COSTI_GENERALI',
                  ],
                },
                descrizione_code: {
                  anyOf: [
                    { type: 'integer' },
                    { type: 'null' },
                  ],
                },
                descrizione_label: {
                  anyOf: [
                    { type: 'string' },
                    { type: 'null' },
                  ],
                },
                conto: { type: 'string', enum: ['CASSA', 'BANCA'] },
                spiegazione: { type: 'string' },
                confidenza: { type: 'number' },
              },
              required: [
                'tipologia',
                'macro',
                'descrizione_code',
                'descrizione_label',
                'conto',
                'spiegazione',
                'confidenza',
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

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Errore interno' });
  }
}
