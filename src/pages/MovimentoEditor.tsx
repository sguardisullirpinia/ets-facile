import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Badge, Card, PrimaryButton, SecondaryButton } from "../components/ui";

type Tipologia = "ENTRATA" | "USCITA" | "AVANZO_CASSA_T_1" | "AVANZO_BANCA_T_1";
type Conto = "CASSA" | "BANCA";
type Regime = "FORFETTARIO" | "ORDINARIO";

type Macro =
  | "AIG"
  | "ATTIVITA_DIVERSE"
  | "RACCOLTE_FONDI"
  | "QUOTE_ASSOCIATIVE"
  | "EROGAZIONI_LIBERALI"
  | "PROVENTI_5X1000"
  | "CONTRIBUTI_PA_SENZA_CORRISPETTIVO"
  | "ALTRI_PROVENTI_NON_COMMERCIALI"
  | "COSTI_GENERALI"
  | "ATTIVITA_FINANZIARIA_PATRIMONIALE"
  | "SUPPORTO_GENERALE"
  | "INVESTIMENTO_DISINVESTIMENTO"
  | "IMPOSTE";

type DetailItem = {
  key: string;
  label: string;
};

type GroupItem = {
  key: string;
  code: number;
  label: string;
  saveMacro?: Macro;
  details: DetailItem[];
};

type SectionItem = {
  key: string;
  label: string;
  saveMacro?: Macro;
  groups: GroupItem[];
};

type Catalog = Record<"ENTRATA" | "USCITA", SectionItem[]>;

type FlatPath = {
  sectionKey: string;
  groupKey: string;
  detailKey: string;
  sectionLabel: string;
  groupLabel: string;
  detailLabel: string;
  saveMacro: Macro;
  descrizioneCode: number;
  descrizioneLabel: string;
};

type ChoiceOption = {
  value: string;
  label: string;
  keywords?: string;
};

const COMMON_USCITE_MATERIE: DetailItem[] = [
  { key: "acquisti-beni", label: "Acquisti di beni" },
  { key: "cancelleria", label: "Cancelleria e stampati" },
  { key: "carburanti", label: "Carburanti e lubrificanti" },
  { key: "riscaldamento", label: "Combustibile per riscaldamento" },
  { key: "trasporti-accessori", label: "Costi accessori di acquisto di beni" },
  { key: "imballaggi", label: "Imballaggi" },
  { key: "indumenti", label: "Indumenti da lavoro e divise" },
  { key: "materiale-pulizia", label: "Materiale di consumo per manutenzioni e pulizie" },
  { key: "materie-prime", label: "Materie prime / sussidiarie / semilavorati" },
  { key: "alimentari", label: "Generi alimentari, vestiario, igiene" },
  { key: "sanitari", label: "Medicinali e presidi sanitari" },
  { key: "animali", label: "Cibo per animali" },
  { key: "automezzo", label: "Carburante automezzo associativo" },
  { key: "ferramenta", label: "Casalinghi e ferramenta" },
  { key: "dpi", label: "Dispositivi di protezione individuale" },
  { key: "attrezzature-basso-valore", label: "Attrezzature e macchinari fino a € 516,46" },
  { key: "altro", label: "Altro" },
];

const COMMON_USCITE_SERVIZI: DetailItem[] = [
  { key: "formazione", label: "Aggiornamento e formazione" },
  { key: "assicurazioni", label: "Assicurazioni varie" },
  { key: "assistenza-tecnica", label: "Canoni di assistenza tecnica" },
  { key: "commissioni-pagamento", label: "Commissioni per servizi di pagamento" },
  { key: "organo-controllo", label: "Compensi organo di controllo / revisore" },
  { key: "organo-amministrativo", label: "Compenso organo amministrativo" },
  { key: "cococo", label: "Collaborazioni coordinate e continuative" },
  { key: "consulenze", label: "Consulenze amministrative, legali, del lavoro" },
  { key: "mensa-terzi", label: "Costi per mensa gestita da terzi" },
  { key: "utenze", label: "Energia elettrica, acqua, gas, telefono" },
  { key: "rimborsi-trasferta", label: "Rimborsi spese e trasferte documentate" },
  { key: "manutenzioni", label: "Servizi di manutenzione e riparazione" },
  { key: "pulizia", label: "Servizi di pulizia" },
  { key: "smaltimento", label: "Servizi di smaltimento rifiuti" },
  { key: "vigilanza", label: "Servizi di vigilanza" },
  { key: "elaborazione-dati", label: "Servizi di elaborazione dati" },
  { key: "pubblicita", label: "Pubblicità e promozione" },
  { key: "laboratorio", label: "Analisi, prove di laboratorio, lavorazioni esterne" },
  { key: "postali", label: "Spese postali e spedizione" },
  { key: "viaggi", label: "Viaggi, vitto, alloggio, taxi, treni, aerei" },
  { key: "condominio", label: "Spese condominio" },
  { key: "pedaggio", label: "Pedaggio autostradale automezzo associativo" },
  { key: "tipografici", label: "Servizi tipografici e grafici" },
  { key: "fideiussione", label: "Spese accensione fideiussione" },
  { key: "polizza-volontari", label: "Polizza RC / infortunio / malattia" },
  { key: "lavoro-autonomo", label: "Lavoro autonomo occasionale / parcelle professionisti" },
  { key: "servizi-bancari", label: "Altri servizi bancari e finanziari non da finanziamento" },
  { key: "altro", label: "Altro" },
];

const COMMON_USCITE_GODIMENTO: DetailItem[] = [
  { key: "affitti", label: "Affitti e locazioni" },
  { key: "noleggi", label: "Noleggio attrezzature, impianti, autoveicoli" },
  { key: "leasing", label: "Leasing" },
  { key: "oneri-accessori", label: "Oneri accessori agli affitti" },
  { key: "software-licenze", label: "Software, licenze, marchi, diritti d’autore, SIAE" },
  { key: "usufrutto", label: "Usufrutto / enfiteusi / diritto di superficie" },
  { key: "royalties", label: "Royalties / utilizzo brevetti" },
  { key: "sale", label: "Noleggio sale e spazi" },
  { key: "altro", label: "Altro" },
];

const COMMON_USCITE_PERSONALE: DetailItem[] = [
  { key: "retribuzioni", label: "Retribuzioni in denaro" },
  { key: "benefit", label: "Retribuzioni in natura / benefit" },
  { key: "premi", label: "Premi e altri elementi simili" },
  { key: "previdenziali", label: "Oneri previdenziali" },
  { key: "assistenziali", label: "Oneri assistenziali / INAIL" },
  { key: "tfr", label: "TFR" },
  { key: "quiescenza", label: "Trattamenti di quiescenza e simili" },
  { key: "transazioni", label: "Transazioni con i dipendenti" },
  { key: "sanitario", label: "Servizio sanitario" },
  { key: "quote-dipendenti", label: "Quote associative a favore dei dipendenti" },
  { key: "sussidi", label: "Sussidi occasionali" },
  { key: "borse", label: "Borse di studio per dipendenti e familiari" },
  { key: "omaggi", label: "Omaggi a dipendenti" },
  { key: "esodo", label: "Incentivi all’esodo" },
  { key: "interinale", label: "Lavoro interinale" },
  { key: "ritenute", label: "Ritenute e contributi pagati" },
  { key: "altro", label: "Altro" },
];

const COMMON_USCITE_DIVERSE: DetailItem[] = [
  { key: "imposte-bollo", label: "Imposte di bollo" },
  { key: "tributi-locali", label: "Tributi locali" },
  { key: "imposta-registro", label: "Imposta di registro" },
  { key: "imposte-ipocat", label: "Imposte ipotecarie e catastali" },
  { key: "concessione", label: "Tassa di concessione governativa" },
  { key: "circolazione", label: "Tassa di circolazione" },
  { key: "rifiuti", label: "Tassa rifiuti" },
  { key: "altre-imposte", label: "Altre imposte e tasse" },
  { key: "quote-affiliazioni", label: "Quote associative / federazioni / affiliazioni" },
  { key: "giornali", label: "Abbonamenti a giornali e riviste" },
  { key: "sopravvenienze", label: "Sopravvenienze passive" },
  { key: "omaggi", label: "Liberalità, omaggi e articoli promozionali" },
  { key: "depositi-bilanci", label: "Deposito e pubblicazione bilanci / verbali" },
  { key: "multe", label: "Multe, ammende e sanzioni" },
  { key: "borse-premi", label: "Borse di studio e premi" },
  { key: "rimborsi-volontari", label: "Rimborsi spese volontari" },
  { key: "vitto", label: "Vitto" },
  { key: "alloggio", label: "Alloggio" },
  { key: "trasporti", label: "Trasporti" },
  { key: "rimborso-km", label: "Rimborso chilometrico auto propria" },
  { key: "sostegno-persone", label: "Erogazione di denaro a sostegno di persone svantaggiate" },
  { key: "sostegno-ets", label: "Erogazione di denaro a ETS che sostengono persone svantaggiate" },
  { key: "beni-donare", label: "Acquisto beni e servizi da donare" },
  { key: "altro", label: "Altro" },
];

const CATALOG: Catalog = {
  ENTRATA: [
    {
      key: "AIG",
      label: "Attività di interesse generale (AIG)",
      saveMacro: "AIG",
      groups: [
        {
          key: "quote-associative",
          code: 1,
          label: "Entrate da quote associative e apporti dei fondatori",
          saveMacro: "QUOTE_ASSOCIATIVE",
          details: [
            { key: "quota-annuale", label: "Quota annuale" },
            { key: "quota-ammissione", label: "Quota di ammissione" },
            { key: "quota-sostenitore", label: "Quota socio sostenitore" },
            { key: "apporto-fondatore", label: "Apporto del fondatore" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "attivita-mutuali",
          code: 2,
          label: "Entrate dagli associati per attività mutuali",
          saveMacro: "AIG",
          details: [
            { key: "fondo-mutuale", label: "Versamento a fondo mutuale" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "prestazioni-associati",
          code: 3,
          label: "Entrate per prestazioni e cessioni ad associati e fondatori",
          saveMacro: "AIG",
          details: [
            { key: "prestazioni-servizi", label: "Prestazioni di servizi a soci" },
            { key: "cessione-beni", label: "Cessione di beni a soci" },
            { key: "rimborso-spese", label: "Rimborso spese da soci" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "erogazioni-liberali",
          code: 4,
          label: "Erogazioni liberali",
          saveMacro: "EROGAZIONI_LIBERALI",
          details: [
            { key: "senza-vincolo", label: "Liberali senza vincolo" },
            { key: "vincolate", label: "Liberali vincolate" },
            { key: "condizionate", label: "Liberali condizionate" },
          ],
        },
        {
          key: "cinque-per-mille",
          code: 5,
          label: "Entrate del 5 per mille",
          saveMacro: "PROVENTI_5X1000",
          details: [
            { key: "incasso-5xmille", label: "Incasso 5 per mille" },
          ],
        },
        {
          key: "contributi-privati",
          code: 6,
          label: "Contributi da soggetti privati",
          saveMacro: "AIG",
          details: [
            { key: "fondazioni", label: "Contributo da fondazione / impresa / ente privato" },
            { key: "progetto", label: "Contributo per progetto o iniziativa" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "prestazioni-terzi",
          code: 7,
          label: "Entrate per prestazioni e cessioni a terzi",
          saveMacro: "AIG",
          details: [
            { key: "servizi-terzi", label: "Prestazioni di servizi a terzi" },
            { key: "cessione-terzi", label: "Cessione di beni a terzi" },
            { key: "rimborso-terzi", label: "Rimborso spese da terzi" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "contributi-pubblici",
          code: 8,
          label: "Contributi da enti pubblici",
          saveMacro: "CONTRIBUTI_PA_SENZA_CORRISPETTIVO",
          details: [
            { key: "contributo-comune", label: "Contributo senza corrispettivo da ente pubblico" },
            { key: "sovvenzione", label: "Sovvenzione / aiuto pubblico" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "contratti-pubblici",
          code: 9,
          label: "Entrate da contratti con enti pubblici",
          saveMacro: "AIG",
          details: [
            { key: "convenzione", label: "Convenzione continuativa" },
            { key: "servizio-pubblico", label: "Corrispettivo per servizio reso a ente pubblico" },
            { key: "trasporto", label: "Servizio di trasporto con ente pubblico" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "altre-entrate",
          code: 10,
          label: "Altre entrate",
          saveMacro: "ALTRI_PROVENTI_NON_COMMERCIALI",
          details: [{ key: "altro", label: "Altro" }],
        },
      ],
    },
    {
      key: "ATTIVITA_DIVERSE",
      label: "Attività diverse",
      saveMacro: "ATTIVITA_DIVERSE",
      groups: [
        {
          key: "prestazioni-associati",
          code: 1,
          label: "Entrate per prestazioni e cessioni ad associati e fondatori",
          details: [
            { key: "prestazioni-servizi", label: "Prestazioni di servizi ad associati" },
            { key: "cessione-beni", label: "Cessione di beni ad associati" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "contributi-privati",
          code: 2,
          label: "Contributi da soggetti privati",
          details: [
            { key: "contributo", label: "Contributo da soggetto privato" },
            { key: "sponsorizzazione", label: "Sponsorizzazione" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "prestazioni-terzi",
          code: 3,
          label: "Entrate per prestazioni e cessioni a terzi",
          details: [
            { key: "servizi-terzi", label: "Prestazioni a terzi" },
            { key: "sponsorizzazioni", label: "Sponsorizzazioni" },
            { key: "vendita", label: "Vendita beni / servizi" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "contributi-pubblici",
          code: 4,
          label: "Contributi da enti pubblici",
          details: [
            { key: "contributo-pubblico", label: "Contributo pubblico" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "contratti-pubblici",
          code: 5,
          label: "Entrate da contratti con enti pubblici",
          details: [
            { key: "corrispettivo", label: "Corrispettivo da contratto / convenzione" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "altre-entrate",
          code: 6,
          label: "Altre entrate",
          details: [{ key: "altro", label: "Altro" }],
        },
      ],
    },
    {
      key: "RACCOLTE_FONDI",
      label: "Raccolte fondi",
      saveMacro: "RACCOLTE_FONDI",
      groups: [
        {
          key: "abituali",
          code: 1,
          label: "Entrate da raccolte fondi abituali",
          details: [
            { key: "liberalita", label: "Liberalità / donazioni" },
            { key: "contributi-progetto", label: "Contributo per progetto" },
            { key: "lasciti", label: "Lasciti" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "occasionali",
          code: 2,
          label: "Entrate da raccolte fondi occasionali",
          details: [
            { key: "evento", label: "Evento / celebrazione / ricorrenza" },
            { key: "somministrazione", label: "Somministrazione occasionale alimenti e bevande" },
            { key: "campagna", label: "Campagna di sensibilizzazione" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "altre-entrate",
          code: 3,
          label: "Altre entrate",
          details: [
            { key: "vendita-beni-donati", label: "Vendita beni ricevuti gratuitamente" },
            { key: "vendita-beni-assistiti", label: "Vendita beni prodotti da assistiti / volontari" },
            { key: "altro", label: "Altro" },
          ],
        },
      ],
    },
    {
      key: "ATTIVITA_FINANZIARIA_PATRIMONIALE",
      label: "Attività finanziaria e patrimoniale",
      saveMacro: "ATTIVITA_FINANZIARIA_PATRIMONIALE",
      groups: [
        {
          key: "rapporti-bancari",
          code: 1,
          label: "Da rapporti bancari",
          details: [
            { key: "interessi-attivi", label: "Interessi attivi" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "investimenti-finanziari",
          code: 2,
          label: "Da altri investimenti finanziari",
          details: [
            { key: "cedole", label: "Interessi / cedole" },
            { key: "plusvalenze", label: "Plusvalenze da cessione titoli" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "patrimonio-edilizio",
          code: 3,
          label: "Da patrimonio edilizio",
          details: [
            { key: "affitti", label: "Affitti attivi" },
            { key: "riaddebito", label: "Riaddebito spese aree condivise" },
            { key: "credito-imposta", label: "Benefici fiscali / crediti di imposta" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "altri-beni",
          code: 4,
          label: "Da altri beni patrimoniali",
          details: [
            { key: "noleggi", label: "Locazioni attive / noleggio beni" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "altre-entrate",
          code: 5,
          label: "Altre entrate",
          details: [{ key: "altro", label: "Altro" }],
        },
      ],
    },
    {
      key: "SUPPORTO_GENERALE",
      label: "Supporto generale",
      saveMacro: "SUPPORTO_GENERALE",
      groups: [
        {
          key: "distacco-personale",
          code: 1,
          label: "Entrate da distacco del personale",
          details: [
            { key: "distacco", label: "Riaddebito per distacco personale" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "altre-entrate",
          code: 2,
          label: "Altre entrate di supporto generale",
          details: [{ key: "altro", label: "Altro" }],
        },
      ],
    },
    {
      key: "INVESTIMENTO_DISINVESTIMENTO",
      label: "Investimento e disinvestimento",
      saveMacro: "INVESTIMENTO_DISINVESTIMENTO",
      groups: [
        {
          key: "disinvestimenti-aig",
          code: 1,
          label: "Disinvestimenti di immobilizzazioni inerenti alle attività di interesse generale",
          details: [
            { key: "vendita-bene-aig", label: "Vendita bene strumentale AIG" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "disinvestimenti-ad",
          code: 2,
          label: "Disinvestimenti di immobilizzazioni inerenti alle attività diverse",
          details: [
            { key: "vendita-bene-ad", label: "Vendita bene strumentale attività diverse" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "disinvestimenti-finanziari",
          code: 3,
          label: "Disinvestimenti di attività finanziarie e patrimoniali",
          details: [
            { key: "vendita-titoli", label: "Vendita titoli / investimenti" },
            { key: "vendita-immobile", label: "Vendita immobile ad uso investimento" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "ricevimento-finanziamenti",
          code: 4,
          label: "Ricevimento di finanziamenti e di prestiti",
          details: [
            { key: "mutuo", label: "Mutuo / prestito ricevuto" },
            { key: "finanziamento-corrente", label: "Finanziamento corrente" },
            { key: "altro", label: "Altro" },
          ],
        },
      ],
    },
  ],
  USCITA: [
    {
      key: "AIG",
      label: "Uscite da attività di interesse generale (AIG)",
      saveMacro: "AIG",
      groups: [
        { key: "materie", code: 1, label: "Materie prime, sussidiarie, di consumo e merci", details: COMMON_USCITE_MATERIE },
        { key: "servizi", code: 2, label: "Servizi", details: COMMON_USCITE_SERVIZI },
        { key: "godimento", code: 3, label: "Godimento beni di terzi", details: COMMON_USCITE_GODIMENTO },
        { key: "personale", code: 4, label: "Personale", details: COMMON_USCITE_PERSONALE },
        { key: "diverse", code: 5, label: "Uscite diverse di gestione", details: COMMON_USCITE_DIVERSE },
      ],
    },
    {
      key: "ATTIVITA_DIVERSE",
      label: "Uscite da attività diverse",
      saveMacro: "ATTIVITA_DIVERSE",
      groups: [
        { key: "materie", code: 1, label: "Materie prime, sussidiarie, di consumo e merci", details: COMMON_USCITE_MATERIE },
        { key: "servizi", code: 2, label: "Servizi", details: COMMON_USCITE_SERVIZI },
        { key: "godimento", code: 3, label: "Godimento beni di terzi", details: COMMON_USCITE_GODIMENTO },
        { key: "personale", code: 4, label: "Personale", details: COMMON_USCITE_PERSONALE },
        { key: "diverse", code: 5, label: "Uscite diverse di gestione", details: COMMON_USCITE_DIVERSE },
      ],
    },
    {
      key: "RACCOLTE_FONDI",
      label: "Uscite da attività di raccolta fondi",
      saveMacro: "RACCOLTE_FONDI",
      groups: [
        {
          key: "abituali",
          code: 1,
          label: "Uscite per raccolte fondi abituali",
          details: [
            { key: "spese-dirette", label: "Spese dirette raccolta fondi abituale" },
            { key: "spese-indirette", label: "Spese indirette imputate" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "occasionali",
          code: 2,
          label: "Uscite per raccolte fondi occasionali",
          details: [
            { key: "evento", label: "Spese per evento / celebrazione / campagna" },
            { key: "somministrazione", label: "Spese per somministrazione occasionale" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "altre-uscite",
          code: 3,
          label: "Altre uscite",
          details: [{ key: "altro", label: "Altro" }],
        },
      ],
    },
    {
      key: "ATTIVITA_FINANZIARIA_PATRIMONIALE",
      label: "Uscite da attività finanziarie e patrimoniali",
      saveMacro: "ATTIVITA_FINANZIARIA_PATRIMONIALE",
      groups: [
        {
          key: "rapporti-bancari",
          code: 1,
          label: "Su rapporti bancari",
          details: [
            { key: "costi-fissi", label: "Costi fissi bancari o postali" },
            { key: "commissioni", label: "Commissioni bancarie o postali" },
            { key: "interessi-passivi", label: "Interessi passivi" },
            { key: "imposte", label: "Imposte su rapporti bancari" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "investimenti-finanziari",
          code: 2,
          label: "Su investimenti finanziari",
          details: [
            { key: "interessi-finanziamenti", label: "Interessi su finanziamenti ottenuti" },
            { key: "commissioni-finanziamenti", label: "Commissioni passive su finanziamenti" },
            { key: "mora-fornitori", label: "Interessi passivi su dilazioni / mora" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "patrimonio-edilizio",
          code: 3,
          label: "Su patrimonio edilizio",
          details: [
            { key: "manutenzione-straordinaria", label: "Manutenzioni straordinarie" },
            { key: "imu", label: "IMU" },
            { key: "condominiali", label: "Spese condominiali" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "altri-beni", code: 4, label: "Su altri beni patrimoniali", details: [{ key: "altro", label: "Altro" }] },
        {
          key: "altre-uscite", code: 5, label: "Altre uscite", details: [{ key: "altro", label: "Altro" }] },
      ],
    },
    {
      key: "SUPPORTO_GENERALE",
      label: "Uscite di supporto generale",
      saveMacro: "COSTI_GENERALI",
      groups: [
        { key: "materie", code: 1, label: "Materie prime, sussidiarie, di consumo e merci", details: COMMON_USCITE_MATERIE },
        { key: "servizi", code: 2, label: "Servizi", details: COMMON_USCITE_SERVIZI },
        { key: "godimento", code: 3, label: "Godimento beni di terzi", details: COMMON_USCITE_GODIMENTO },
        { key: "personale", code: 4, label: "Personale", details: COMMON_USCITE_PERSONALE },
        { key: "diverse", code: 5, label: "Altre uscite", details: COMMON_USCITE_DIVERSE },
      ],
    },
    {
      key: "INVESTIMENTO_DISINVESTIMENTO",
      label: "Investimento e disinvestimento",
      saveMacro: "INVESTIMENTO_DISINVESTIMENTO",
      groups: [
        {
          key: "investimenti-aig",
          code: 1,
          label: "Investimenti in immobilizzazioni inerenti alle attività di interesse generale",
          details: [
            { key: "bene-strumentale", label: "Acquisto bene strumentale oltre € 516,46" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "investimenti-ad",
          code: 2,
          label: "Investimenti in immobilizzazioni inerenti alle attività diverse",
          details: [
            { key: "bene-strumentale", label: "Acquisto bene strumentale oltre € 516,46" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "investimenti-finanziari",
          code: 3,
          label: "Investimenti in attività finanziarie e patrimoniali",
          details: [
            { key: "immobile-investimento", label: "Immobile ad uso investimento" },
            { key: "titoli", label: "Titoli / azioni / altri investimenti" },
            { key: "altro", label: "Altro" },
          ],
        },
        {
          key: "rimborso-prestiti",
          code: 4,
          label: "Rimborso di finanziamenti per quota capitale e di prestiti",
          details: [
            { key: "quota-capitale-mutuo", label: "Quota capitale mutuo" },
            { key: "rimborso-prestito", label: "Rimborso prestito" },
            { key: "altro", label: "Altro" },
          ],
        },
      ],
    },
    {
      key: "IMPOSTE",
      label: "Imposte",
      saveMacro: "IMPOSTE",
      groups: [
        {
          key: "imposte",
          code: 1,
          label: "Imposte",
          details: [
            { key: "irap", label: "IRAP pagata nell’esercizio" },
            { key: "altro", label: "Altro" },
          ],
        },
      ],
    },
  ],
};

const LEGACY_MACRO_LABELS: Record<string, string> = {
  QUOTE_ASSOCIATIVE: "Entrate da quote associative e apporti dei fondatori",
  EROGAZIONI_LIBERALI: "Erogazioni liberali",
  PROVENTI_5X1000: "Entrate del 5 per mille",
  CONTRIBUTI_PA_SENZA_CORRISPETTIVO: "Contributi da enti pubblici",
  ALTRI_PROVENTI_NON_COMMERCIALI: "Altre entrate",
  COSTI_GENERALI: "Uscite di supporto generale",
};

function normalizeText(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isValidMoney(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function isValidIva(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0;
}

function buildFlatPaths(tipologia: "ENTRATA" | "USCITA"): FlatPath[] {
  const sections = CATALOG[tipologia];
  const flat: FlatPath[] = [];

  sections.forEach((section, sectionIndex) => {
    section.groups.forEach((group) => {
      group.details.forEach((detail, detailIndex) => {
        const saveMacro = group.saveMacro || section.saveMacro || (section.key as Macro);
        const descrizioneCode = (sectionIndex + 1) * 10000 + group.code * 100 + (detailIndex + 1);
        flat.push({
          sectionKey: section.key,
          groupKey: group.key,
          detailKey: detail.key,
          sectionLabel: section.label,
          groupLabel: group.label,
          detailLabel: detail.label,
          saveMacro,
          descrizioneCode,
          descrizioneLabel: `${group.label} • ${detail.label}`,
        });
      });
    });
  });

  return flat;
}

function findPathByStoredValues(
  tipologia: "ENTRATA" | "USCITA",
  macro: string | null | undefined,
  descrizioneLabel: string | null | undefined,
  descrizioneCode: number | null | undefined,
) {
  const flat = buildFlatPaths(tipologia);

  const byCode = flat.find((item) => item.descrizioneCode === descrizioneCode);
  if (byCode) return byCode;

  const normalizedLabel = normalizeText(descrizioneLabel || "");
  if (normalizedLabel) {
    const byLabel = flat.find((item) => {
      const labels = [
        item.descrizioneLabel,
        item.detailLabel,
        item.groupLabel,
        `${item.sectionLabel} ${item.groupLabel} ${item.detailLabel}`,
      ];
      return labels.some((label) => normalizeText(label) === normalizedLabel);
    });
    if (byLabel) return byLabel;
  }

  if (macro) {
    const normalizedMacroHint = normalizeText(LEGACY_MACRO_LABELS[macro] || macro);
    const byMacro = flat.find((item) => {
      if (item.saveMacro === macro) return true;
      if (!normalizedMacroHint) return false;
      return (
        normalizeText(item.sectionLabel).includes(normalizedMacroHint) ||
        normalizeText(item.groupLabel).includes(normalizedMacroHint)
      );
    });
    if (byMacro) return byMacro;
  }

  return null;
}

function DatalistField({
  id,
  label,
  placeholder,
  value,
  options,
  disabled,
  onChange,
  onClear,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  options: ChoiceOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
  onClear?: () => void;
}) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  const optionMap = useMemo(() => {
    const map = new Map<string, ChoiceOption>();
    options.forEach((option) => {
      map.set(option.label, option);
      map.set(option.value, option);
    });
    return map;
  }, [options]);

  const filtered = useMemo(() => {
    const q = normalizeText(text);
    if (!q) return options.slice(0, 50);
    return options
      .filter((option) => {
        const haystack = normalizeText(
          `${option.label} ${option.value} ${option.keywords || ""}`,
        );
        return haystack.includes(q);
      })
      .slice(0, 50);
  }, [options, text]);

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{label}</div>
      <input
        list={id}
        value={text}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          const found = optionMap.get(next);
          if (found) onChange(found.value);
        }}
        onBlur={() => {
          const found = optionMap.get(text);
          if (found) {
            setText(found.label);
            onChange(found.value);
            return;
          }

          const normalized = normalizeText(text);
          const firstPartial = options.find((option) => {
            const haystack = normalizeText(`${option.label} ${option.keywords || ""}`);
            return haystack.includes(normalized);
          });
          if (firstPartial && normalized) {
            setText(firstPartial.label);
            onChange(firstPartial.value);
            return;
          }

          if (!text.trim()) {
            onClear?.();
          }
        }}
        placeholder={placeholder}
        className="input"
        autoComplete="off"
      />
      <datalist id={id}>
        {filtered.map((option) => (
          <option key={option.value} value={option.label} />
        ))}
      </datalist>
      <div className="rowSub" style={{ marginTop: 8 }}>
        Scrivi per filtrare l’elenco e poi seleziona la voce proposta.
      </div>
    </div>
  );
}

export default function MovimentoEditor() {
  const annualitaId = localStorage.getItem("annualita_id");
  const editId = localStorage.getItem("movimento_edit_id");
  const presetTipologia =
    (localStorage.getItem("movimento_tipologia") as Tipologia | null) || "";

  const [loading, setLoading] = useState(!!editId);
  const [error, setError] = useState<string | null>(null);

  const [tipologia, setTipologia] = useState<Tipologia | "">(presetTipologia);
  const [data, setData] = useState("");
  const [conto, setConto] = useState<Conto>("CASSA");
  const [importo, setImporto] = useState("");
  const [iva, setIva] = useState("0");
  const [descrOperazione, setDescrOperazione] = useState("");
  const [regime, setRegime] = useState<Regime>("ORDINARIO");

  const [sectionKey, setSectionKey] = useState("");
  const [groupKey, setGroupKey] = useState("");
  const [detailKey, setDetailKey] = useState("");

  const hydratedRef = useRef(false);

  const isEntrataOrUscita = tipologia === "ENTRATA" || tipologia === "USCITA";
  const isAvanzo =
    tipologia === "AVANZO_CASSA_T_1" || tipologia === "AVANZO_BANCA_T_1";
  const showIvaField = isEntrataOrUscita && regime === "ORDINARIO";

  const tipologiaCatalog = useMemo(() => {
    if (tipologia !== "ENTRATA" && tipologia !== "USCITA") return [];
    return CATALOG[tipologia];
  }, [tipologia]);

  const selectedSection = useMemo(
    () => tipologiaCatalog.find((section) => section.key === sectionKey) || null,
    [tipologiaCatalog, sectionKey],
  );

  const selectedGroup = useMemo(
    () => selectedSection?.groups.find((group) => group.key === groupKey) || null,
    [selectedSection, groupKey],
  );

  const selectedDetail = useMemo(
    () => selectedGroup?.details.find((detail) => detail.key === detailKey) || null,
    [selectedGroup, detailKey],
  );

  const sectionOptions = useMemo<ChoiceOption[]>(() => {
    return tipologiaCatalog.map((section) => ({
      value: section.key,
      label: section.label,
      keywords: `${section.key} ${section.groups.map((g) => g.label).join(" ")}`,
    }));
  }, [tipologiaCatalog]);

  const groupOptions = useMemo<ChoiceOption[]>(() => {
    if (!selectedSection) return [];
    return selectedSection.groups.map((group) => ({
      value: group.key,
      label: group.label,
      keywords: group.details.map((detail) => detail.label).join(" "),
    }));
  }, [selectedSection]);

  const detailOptions = useMemo<ChoiceOption[]>(() => {
    if (!selectedGroup) return [];
    return selectedGroup.details.map((detail) => ({
      value: detail.key,
      label: detail.label,
      keywords: `${selectedGroup.label} ${selectedSection?.label || ""}`,
    }));
  }, [selectedGroup, selectedSection]);

  const selectedPath = useMemo<FlatPath | null>(() => {
    if (!selectedSection || !selectedGroup || !selectedDetail) return null;

    const flat = buildFlatPaths(tipologia as "ENTRATA" | "USCITA");
    return (
      flat.find(
        (item) =>
          item.sectionKey === selectedSection.key &&
          item.groupKey === selectedGroup.key &&
          item.detailKey === selectedDetail.key,
      ) || null
    );
  }, [tipologia, selectedSection, selectedGroup, selectedDetail]);

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

  useEffect(() => {
    if (!editId) {
      setLoading(false);
      return;
    }

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
      setConto((row.conto as Conto) || "CASSA");
      setImporto(String(row.importo ?? ""));
      setIva(String(row.iva ?? 0));
      setDescrOperazione((row.descrizione_operazione ?? "").toString());

      if (row.tipologia === "ENTRATA" || row.tipologia === "USCITA") {
        const hydrated = findPathByStoredValues(
          row.tipologia,
          row.macro,
          row.descrizione_label,
          row.descrizione_code,
        );
        if (hydrated) {
          hydratedRef.current = true;
          setSectionKey(hydrated.sectionKey);
          setGroupKey(hydrated.groupKey);
          setDetailKey(hydrated.detailKey);
        }
      }

      setLoading(false);
    };

    load();
  }, [editId]);

  useEffect(() => {
    if (editId || hydratedRef.current) {
      hydratedRef.current = false;
      return;
    }

    setData("");
    setConto("CASSA");
    setImporto("");
    setIva("0");
    setDescrOperazione("");
    setSectionKey("");
    setGroupKey("");
    setDetailKey("");
  }, [tipologia, editId]);

  useEffect(() => {
    if (!selectedSection) {
      setGroupKey("");
      setDetailKey("");
      return;
    }

    if (selectedSection.groups.every((group) => group.key !== groupKey)) {
      setGroupKey("");
      setDetailKey("");
    }
  }, [selectedSection, groupKey]);

  useEffect(() => {
    if (!selectedGroup) {
      setDetailKey("");
      return;
    }

    if (selectedGroup.details.every((detail) => detail.key !== detailKey)) {
      setDetailKey("");
    }
  }, [selectedGroup, detailKey]);

  const salva = async () => {
    setError(null);

    if (!annualitaId) {
      setError("Annualità non selezionata");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Utente non autenticato");
      return;
    }

    if (!tipologia) {
      setError("Seleziona la tipologia");
      return;
    }

    if (isEntrataOrUscita) {
      if (!data) {
        setError("Seleziona la data");
        return;
      }

      if (!selectedSection || !selectedGroup || !selectedDetail || !selectedPath) {
        setError("Completa categoria, sottocategoria e posta di dettaglio");
        return;
      }

      if (!descrOperazione.trim()) {
        setError("Inserisci la descrizione dell’operazione");
        return;
      }

      if (!isValidMoney(importo)) {
        setError("Importo non valido");
        return;
      }

      if (showIvaField && !isValidIva(iva)) {
        setError("IVA non valida");
        return;
      }
    }

    if (isAvanzo && !isValidMoney(importo)) {
      setError("Importo non valido");
      return;
    }

    const payload: Record<string, unknown> = {
      user_id: userData.user.id,
      annualita_id: annualitaId,
      tipologia,
      data: isAvanzo ? null : data || null,
      conto: isAvanzo
        ? tipologia === "AVANZO_CASSA_T_1"
          ? "CASSA"
          : "BANCA"
        : conto,
      importo: Number(importo),
      iva: showIvaField ? Number(iva || 0) : 0,
      descrizione_operazione: isAvanzo
        ? tipologia === "AVANZO_CASSA_T_1"
          ? "Avanzo cassa t-1"
          : "Avanzo banca t-1"
        : descrOperazione.trim(),
      macro: isAvanzo ? null : selectedPath?.saveMacro || null,
      descrizione_code: isAvanzo ? null : selectedPath?.descrizioneCode || null,
      descrizione_label: isAvanzo ? null : selectedPath?.descrizioneLabel || null,
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
          <h2 className="pageTitle">{editId ? "Modifica movimento" : "Nuovo movimento"}</h2>
          <div className="pageHelp">
            Ho riorganizzato l’inserimento seguendo la logica del Mod. D: categoria,
            sottocategoria e posta di dettaglio, con ricerca dentro ogni elenco.
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

          <Card title="3️⃣ Categoria rendiconto">
            <DatalistField
              id="mov-section"
              label="Categoria"
              placeholder="Cerca la categoria…"
              value={selectedSection?.label || ""}
              options={sectionOptions}
              onChange={(value) => {
                setSectionKey(value);
                setGroupKey("");
                setDetailKey("");
              }}
              onClear={() => {
                setSectionKey("");
                setGroupKey("");
                setDetailKey("");
              }}
            />
          </Card>

          {selectedSection && (
            <Card title="4️⃣ Sottocategoria">
              <DatalistField
                id="mov-group"
                label="Sottocategoria"
                placeholder="Cerca la sottocategoria…"
                value={selectedGroup?.label || ""}
                options={groupOptions}
                onChange={(value) => {
                  setGroupKey(value);
                  setDetailKey("");
                }}
                onClear={() => {
                  setGroupKey("");
                  setDetailKey("");
                }}
              />
            </Card>
          )}

          {selectedGroup && (
            <Card title="5️⃣ Posta di dettaglio">
              <DatalistField
                id="mov-detail"
                label="Posta"
                placeholder="Cerca la posta di dettaglio…"
                value={selectedDetail?.label || ""}
                options={detailOptions}
                onChange={(value) => setDetailKey(value)}
                onClear={() => setDetailKey("")}
              />
            </Card>
          )}

          {selectedPath && (
            <Card title="Riepilogo classificazione">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <Badge>{selectedSection?.label}</Badge>
                <Badge>{selectedGroup?.label}</Badge>
                <Badge>{selectedDetail?.label}</Badge>
              </div>
              <div className="rowSub">
                Questa combinazione verrà salvata con una descrizione coerente con il rendiconto
                per cassa.
              </div>
            </Card>
          )}

          <Card title="6️⃣ Banca / Cassa">
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

      {tipologia && (
        <>
          <Card title="7️⃣ Importo">
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
            <Card title="8️⃣ IVA (solo regime ordinario)">
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
                Inserisci 0 se il movimento non prevede IVA.
              </div>
            </Card>
          )}

          {isEntrataOrUscita && (
            <Card title="9️⃣ Descrizione operazione">
              <input
                value={descrOperazione}
                onChange={(e) => setDescrOperazione(e.target.value)}
                className="input"
                placeholder="Es. fattura commercialista, bolletta luce, quota socio, donazione…"
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
        <PrimaryButton onClick={salva}>{editId ? "Salva modifiche" : "Salva"}</PrimaryButton>
        <SecondaryButton onClick={() => history.back()}>Annulla</SecondaryButton>
      </div>
    </Layout>
  );
}
