import { useNavigate } from "react-router-dom";

export default function Help() {
  const nav = useNavigate();

  return (
    <div className="mobileShell">
      <header className="mHeader">
        <button
          className="iconBtn"
          onClick={() => nav(-1)}
          aria-label="Indietro"
        >
          ←
        </button>

        <div className="mHeaderText">
          <div className="mTitle">Help</div>
          <div className="mSubtitle">Guida alla compilazione</div>
        </div>

        <div className="mHeaderRight" />
      </header>

      <main className="mContent">
        <div className="cardBlock">
          {/* INCOLLA QUI IL TUO TESTO */}
          <div className="helpText">
            <h3>1. COSA FA ETS-FACILE</h3>
            <p>
              L’applicazione è uno strumento di gestione fiscale e di verifica
              della commercialità pensato per APS e ODV, sviluppato in
              conformità alle nuove regole del Codice del Terzo Settore.
            </p>
            <p>
              Il suo obiettivo è consentire agli enti di inserire, organizzare e
              analizzare i dati economici per verificare:
            </p>
            <ul>
              <li>la natura commerciale o non commerciale delle singole AIG</li>
              <li>
                il rispetto dei limiti delle attività diverse ex art. 6 CTS
              </li>
              <li>il test di commercialità complessivo dell’ente</li>
            </ul>

            <h3>2. DATI ANAGRAFICI DELL’ENTE</h3>
            <p>
              Al primo accesso, l’utente inserisce i dati strutturali dell’ente,
              modificabili in qualsiasi momento:
            </p>
            <ul>
              <li>Denominazione</li>
              <li>Codice Fiscale</li>
              <li>Partita IVA (se presente)</li>
              <li>
                Tipologia di ente: <b>APS</b> o <b>ODV</b>, importante per il
                diverso regime applicabile
              </li>
            </ul>

            <h3>3. GESTIONE DELLE ANNUALITÀ</h3>
            <p>
              L’app consente di creare una o più annualità di riferimento (es.
              2026, 2027, 2028).
            </p>
            <p>
              Ogni annualità è gestita in modo autonomo e contiene tutte le
              informazioni economiche relative a quell’esercizio.
            </p>

            <h3>4. GESTIONE DELLE AIG – ATTIVITÀ DI INTERESSE GENERALE</h3>
            <p>
              Per ogni annualità l’utente può creare una o più AIG. Ogni
              qualvolta l’associazione realizza un’attività riconducibile
              all’art. 5 CTS deve determinare con precisione le entrate e i
              costi diretti e indiretti.
            </p>
            <p>
              I costi indiretti e generali possono essere imputati
              percentualmente alla singola AIG. In fase di creazione l’utente
              indicherà:
            </p>
            <ul>
              <li>Nome AIG (es. “Doposcuola”, “Sport inclusivo”)</li>
              <li>
                Codice / descrizione (opzionale ma utile ai fini identificativi)
              </li>
            </ul>

            <h3>
              5. CALCOLO DELLA NATURA COMMERCIALE / NON COMMERCIALE DELLA AIG
            </h3>
            <p>
              Per ogni AIG, l’applicazione calcola automaticamente la natura
              commerciale o non commerciale, tenendo conto del rapporto tra:
            </p>
            <p>
              <b>Totale Entrate AIG</b> – <b>Totale Uscite AIG</b> e della
              soglia dei costi complessivi aumentati del 6%.
            </p>
            <ul>
              <li>
                Se le entrate superano la soglia → <b>AIG COMMERCIALE</b>
              </li>
              <li>
                Se le entrate sono pari o inferiori alla soglia →{" "}
                <b>AIG NON COMMERCIALE</b>
              </li>
            </ul>

            <h3>6. ATTIVITÀ DIVERSE EX ART. 6 CTS</h3>
            <p>
              Per ogni annualità l’utente può creare una o più attività diverse
              di cui all’art. 6 CTS, indicando nome e descrizione.
            </p>
            <p>
              Le attività diverse sono per loro natura attività commerciali. Tra
              queste rientrano anche le sponsorizzazioni delle AIG, che sono
              attività commerciali ma sono escluse dal test di commercialità
              complessivo dell’ente.
            </p>

            <h3>7. SECONDARIETÀ DELLE ATTIVITÀ DIVERSE</h3>
            <p>
              L’app verifica automaticamente il rispetto dei due limiti
              normativi previsti per qualificare le attività diverse come
              secondarie:
            </p>
            <ul>
              <li>
                Primo test: le entrate delle attività diverse devono essere ≤
                30% delle entrate complessive dell’ente
              </li>
              <li>
                Secondo test: le entrate delle attività diverse devono essere ≤
                66% dei costi complessivi dell’ente
              </li>
            </ul>

            <h3>8. RACCOLTE FONDI OCCASIONALI</h3>
            <p>
              Per ogni annualità possono essere create una o più raccolte fondi
              occasionali, con nome e descrizione obbligatoria.
            </p>

            <h3>9. ATTIVITÀ PER NATURA NON COMMERCIALI</h3>
            <p>
              Al di fuori di AIG, attività diverse e raccolte fondi, l’utente
              può inserire le seguenti entrate per natura non commerciali:
            </p>
            <ul>
              <li>Quote associative e apporti dei fondatori</li>
              <li>Erogazioni liberali</li>
              <li>Proventi del 5 per mille</li>
              <li>
                Contributi erogati dalla PA per sostenere l'associazione o un suo progetto, senza che l'ente pubblico riceva nulla in cambio
              </li>
            </ul>

            <h3>10. RIQUADRO RIASSUNTIVO E TEST DI COMMERCIALITÀ DELL’ENTE</h3>
            <p>
              Per ogni annualità l’app restituisce un quadro riepilogativo che
              include:
            </p>
            <ul>
              <li>Totale entrate da AIG commerciali</li>
              <li>Totale entrate da attività diverse (art. 6)</li>
              <li>Proventi da AIG non commerciali</li>
              <li>
                Altre entrate non commerciali (quote associative, erogazioni
                liberali, 5‰, convenzioni art. 56 e, per APS, anche le
                prestazioni ad associati)
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

