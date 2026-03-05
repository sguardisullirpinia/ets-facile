import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Badge } from "../components/ui";
import * as XLSX from "xlsx";

type Qualifica = "FONDATORE" | "ORDINARIO" | "SOSTENITORE";

type Socio = {
  id: string;
  user_id: string;
  numero: number;

  nome: string;
  cognome: string;

  data_nascita: string | null;
  luogo_nascita: string | null;
  residenza: string | null;

  data_ammissione: string | null;
  data_cessazione: string | null;

  email: string | null;
  pec: string | null;

  qualifica: Qualifica | null;
};

type ProfileHeader = {
  denominazione: string;
  cf: string;
  piva: string;
  tipoEnte: string;
};

function fmtDate(d: string | null) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

function IconButton({
  title,
  onClick,
  children,
  className,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={className ? `iconBtn ${className}` : "iconBtn"}
      type="button"
    >
      {children}
    </button>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 6V4h8v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilBlueIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function RegistroSoci() {
  const annualitaId = localStorage.getItem("annualita_id");
  const annualitaAnno = localStorage.getItem("annualita_anno") || "";

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [soci, setSoci] = useState<Socio[]>([]);
  const [quotaMap, setQuotaMap] = useState<Record<string, boolean>>({}); // socio_id -> pagata

  // modal
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Socio | null>(null);

  // form
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [dataNascita, setDataNascita] = useState<string>("");
  const [luogoNascita, setLuogoNascita] = useState("");
  const [residenza, setResidenza] = useState("");
  const [dataAmmissione, setDataAmmissione] = useState<string>("");
  const [dataCessazione, setDataCessazione] = useState<string>("");
  const [email, setEmail] = useState("");
  const [pec, setPec] = useState("");
  const [qualifica, setQualifica] = useState<Qualifica>("ORDINARIO");

  const resetForm = () => {
    setNome("");
    setCognome("");
    setDataNascita("");
    setLuogoNascita("");
    setResidenza("");
    setDataAmmissione("");
    setDataCessazione("");
    setEmail("");
    setPec("");
    setQualifica("ORDINARIO");
  };

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setOpenModal(true);
  };

  const openEdit = (s: Socio) => {
    setEditing(s);
    setNome(s.nome || "");
    setCognome(s.cognome || "");
    setDataNascita(s.data_nascita || "");
    setLuogoNascita(s.luogo_nascita || "");
    setResidenza(s.residenza || "");
    setDataAmmissione(s.data_ammissione || "");
    setDataCessazione(s.data_cessazione || "");
    setEmail(s.email || "");
    setPec(s.pec || "");
    setQualifica((s.qualifica as Qualifica) || "ORDINARIO");
    setOpenModal(true);
  };

  const load = async () => {
    setError(null);
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Utente non autenticato.");
      setLoading(false);
      return;
    }

    // 1) carico soci (registro unico)
    const { data: sociData, error: errSoci } = await supabase
      .from("soci")
      .select(
        "id,user_id,numero,nome,cognome,data_nascita,luogo_nascita,residenza,data_ammissione,data_cessazione,email,pec,qualifica",
      )
      .eq("user_id", userData.user.id)
      .order("numero", { ascending: true });

    if (errSoci) {
      setError(errSoci.message);
      setLoading(false);
      return;
    }

    const sociList = (sociData || []) as Socio[];
    setSoci(sociList);

    // 2) carico quote della specifica annualità
    if (annualitaId) {
      const { data: quoteData, error: errQuote } = await supabase
        .from("soci_quote")
        .select("socio_id,pagata")
        .eq("user_id", userData.user.id)
        .eq("annualita_id", annualitaId);

      if (!errQuote) {
        const map: Record<string, boolean> = {};
        for (const q of quoteData || []) {
          map[(q as any).socio_id] = (q as any).pagata === true;
        }
        setQuotaMap(map);
      } else {
        setQuotaMap({});
      }
    } else {
      setQuotaMap({});
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annualitaId]);

  const saveSocio = async () => {
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return setError("Utente non autenticato.");

    if (!nome.trim() || !cognome.trim()) {
      setError("Nome e cognome sono obbligatori.");
      return;
    }

    setSaving(true);

    if (editing) {
      // UPDATE
      const { error: upErr } = await supabase
        .from("soci")
        .update({
          nome: nome.trim(),
          cognome: cognome.trim(),
          data_nascita: dataNascita || null,
          luogo_nascita: luogoNascita.trim() || null,
          residenza: residenza.trim() || null,
          data_ammissione: dataAmmissione || null,
          data_cessazione: dataCessazione || null,
          email: email.trim() || null,
          pec: pec.trim() || null,
          qualifica,
        })
        .eq("id", editing.id)
        .eq("user_id", userData.user.id);

      if (upErr) {
        setError(upErr.message);
        setSaving(false);
        return;
      }
    } else {
      // INSERT con numero progressivo
      const maxNumero = soci.reduce((m, s) => Math.max(m, Number(s.numero || 0)), 0);
      const numero = maxNumero + 1;

      const { error: insErr } = await supabase.from("soci").insert({
        user_id: userData.user.id,
        numero,
        nome: nome.trim(),
        cognome: cognome.trim(),
        data_nascita: dataNascita || null,
        luogo_nascita: luogoNascita.trim() || null,
        residenza: residenza.trim() || null,
        data_ammissione: dataAmmissione || null,
        data_cessazione: dataCessazione || null,
        email: email.trim() || null,
        pec: pec.trim() || null,
        qualifica,
      });

      if (insErr) {
        setError(insErr.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setOpenModal(false);
    await load();
  };

  const deleteSocio = async (s: Socio) => {
    const ok = confirm(`Vuoi eliminare il socio ${s.cognome} ${s.nome}?`);
    if (!ok) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return setError("Utente non autenticato.");

    const { error: delErr } = await supabase
      .from("soci")
      .delete()
      .eq("id", s.id)
      .eq("user_id", userData.user.id);

    if (delErr) {
      setError(delErr.message);
      return;
    }

    await load();
  };

  const toggleQuota = async (s: Socio) => {
    if (!annualitaId) {
      setError("Seleziona un’annualità per gestire la quota associativa.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return setError("Utente non autenticato.");

    const current = !!quotaMap[s.id];
    const next = !current;

    const { error: upErr } = await supabase.from("soci_quote").upsert(
      {
        user_id: userData.user.id,
        socio_id: s.id,
        annualita_id: annualitaId,
        pagata: next,
      },
      { onConflict: "socio_id,annualita_id" },
    );

    if (upErr) {
      setError(upErr.message);
      return;
    }

    setQuotaMap((m) => ({ ...m, [s.id]: next }));
  };

  // ✅ NUOVO: esporta excel con intestazione profilo sopra la tabella
  const downloadExcel = async () => {
    try {
      setError(null);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        setError("Utente non autenticato.");
        return;
      }

      // profilo per intestazione
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("denominazione, cf, piva, tipo_ente")
        .eq("id", userData.user.id)
        .single();

      // non blocco se profilo mancante: metto placeholder
      const header: ProfileHeader = {
        denominazione: (prof?.denominazione || "").trim(),
        cf: (prof?.cf || "").trim(),
        piva: (prof?.piva || "").trim(),
        tipoEnte: (prof?.tipo_ente || "").trim(),
      };

      // tabella soci
      const tableRows = soci.map((s) => {
        const paid = quotaMap[s.id] === true;

        return {
          "N. Socio": s.numero ?? "",
          Cognome: s.cognome ?? "",
          Nome: s.nome ?? "",
          Qualifica: s.qualifica ?? "",
          "Data nascita": fmtDate(s.data_nascita),
          "Luogo nascita": s.luogo_nascita ?? "",
          Residenza: s.residenza ?? "",
          "Data ammissione": fmtDate(s.data_ammissione),
          "Data cessazione": fmtDate(s.data_cessazione),
          Email: s.email ?? "",
          PEC: s.pec ?? "",
          "Quota associativa (annualità)": paid ? "Quota annuale SI" : "Quota annuale NO",
          
        };
      });

      const headerAoA: any[][] = [
        ["REGISTRO SOCI", ""],
        ["DENOMINAZIONE ENTE", header.denominazione || "—"],
        ["CODICE FISCALE", header.cf || "—"],
        ["PARTITA IVA", header.piva || "—"],
        ["TIPOLOGIA ENTE", header.tipoEnte || "—"],
        ["ANNUALITÀ", annualitaAnno || "—"],
        [], // riga vuota
      ];

      const ws = XLSX.utils.aoa_to_sheet(headerAoA);

      // aggiungo tabella sotto intestazione
      XLSX.utils.sheet_add_json(ws, tableRows, {
        origin: { r: headerAoA.length, c: 0 },
      });

      // larghezze colonne (opzionale)
      ws["!cols"] = [
        { wch: 9 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 12 },
        { wch: 18 },
        { wch: 22 },
        { wch: 13 },
        { wch: 13 },
        { wch: 26 },
        { wch: 26 },
        { wch: 26 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Registro Soci");

      const fileYear = annualitaAnno ? `_${annualitaAnno}` : "";
      const filename = `registro_soci${fileYear}.xlsx`;

      XLSX.writeFile(wb, filename);

      // opzionale: segnalo profilo mancante (senza bloccare)
      if (profErr) {
        // niente setError: excel già creato. Se vuoi, puoi mostrare un warning in UI.
        // console.warn("Profilo non disponibile:", profErr.message);
      }
    } catch (e: any) {
      setError(e?.message || "Errore durante l'esportazione Excel.");
    }
  };

  const help = useMemo(() => {
    return (
      "Gestisci il Registro Soci (unico, indipendente dall’annualità).\n" +
      "La Quota associativa (SI/NO) viene invece registrata per la sola annualità selezionata."
    );
  }, []);

  return (
    <Layout>
      {/* HEADER */}
      <div className="pageHeader" style={{ paddingTop: 15 }}>
        <div>
          <h2 className="pageTitle">REGISTRO SOCI</h2>
          <div className="pageHelp" style={{ whiteSpace: "pre-line" }}>
            {help}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <Badge tone="red">Errore</Badge>
          <div className="errorText">{error}</div>
        </div>
      )}

      {/* FAB (+) — alzato sopra la bottom bar */}
      <button
        className="fab"
        onClick={openCreate}
        type="button"
        aria-label="Nuovo socio"
        style={{ bottom: 86 }}
      >
        +
      </button>

      {/* LISTA SOCI */}
      <div className="section">
        <div className="sectionTitle">ELENCO</div>

        <div className="listBox">
          {loading ? (
            <div className="listRow">
              <div className="rowMain">
                <div className="rowSub">Caricamento…</div>
              </div>
            </div>
          ) : soci.length === 0 ? (
            <div className="listRow">
              <div className="rowMain">
                <div className="rowSub">
                  Nessun socio presente. Premi “+” per aggiungerne uno.
                </div>
              </div>
            </div>
          ) : (
            soci.map((s) => {
              const quota = !!quotaMap[s.id];

              return (
                <div key={s.id} className="listRow">
                  <div className="rowMain" style={{ display: "grid", gap: 6 }}>
                    <div
                      className="rowTitle"
                      style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                    >
                      <span style={{ fontWeight: 950 }}>
                        {s.numero}. {s.cognome} {s.nome}
                      </span>

                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          padding: "3px 8px",
                          borderRadius: 999,
                          border: "1px solid rgba(0,0,0,0.10)",
                          background: "rgba(0,0,0,0.03)",
                        }}
                      >
                        {s.qualifica || "—"}
                      </span>

                      {s.data_cessazione ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 900,
                            padding: "3px 8px",
                            borderRadius: 999,
                            border: "1px solid rgba(153,27,27,0.25)",
                            background: "rgba(153,27,27,0.06)",
                            color: "#991b1b",
                          }}
                        >
                          Cessato
                        </span>
                      ) : null}
                    </div>

                    <div className="rowSub" style={{ display: "grid", gap: 2 }}>
                      <div>
                        Nascita:{" "}
                        <b>
                          {fmtDate(s.data_nascita) || "—"}
                          {s.luogo_nascita ? ` • ${s.luogo_nascita}` : ""}
                        </b>
                      </div>

                      <div>
                        Residenza: <b>{s.residenza || "—"}</b>
                      </div>

                      <div>
                        Amm.: <b>{fmtDate(s.data_ammissione) || "—"}</b>
                        {" • "}
                        Cess.: <b>{fmtDate(s.data_cessazione) || "—"}</b>
                      </div>

                      <div>
                        Email: <b>{s.email || "—"}</b>
                        {" • "}
                        PEC: <b>{s.pec || "—"}</b>
                      </div>

                      <div style={{ marginTop: 4 }}>
                        <Badge tone={quota ? "green" : "amber"}>
                          Quota {annualitaAnno ? annualitaAnno : ""}:{" "}
                          <b>{quota ? "Quota annuale SI" : "Quota annuale NO"}</b>
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* AZIONI (quota + modifica + elimina) */}
                  <div style={{ display: "grid", justifyItems: "end", gap: 8 }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => toggleQuota(s)}
                      title="Cambia quota associativa (per annualità)"
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {quota ? "Quota annuale SI" : " Quota annuale NO"}
                    </button>

                    <div style={{ display: "flex", gap: 8 }}>
                      <IconButton
                        title="Modifica"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(s);
                        }}
                        className="iconBtn--sm"
                      >
                        <span style={{ color: "#2563eb" }}>
                          <PencilBlueIcon />
                        </span>
                      </IconButton>

                      <IconButton
                        title="Elimina"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSocio(s);
                        }}
                        className="iconBtn--sm"
                      >
                        <TrashIcon />
                      </IconButton>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* EXPORT (struttura identica a Entrate/Uscite) */}
      <div className="section" style={{ paddingBottom: 90 }}>
        <div className="sectionTitle">ESPORTA</div>
        <div className="listBox">
          <div className="listRow">
            <div className="rowMain">
              <div className="rowTitle">Scarica Registro Soci in Excel</div>
              <div className="rowSub">
                Include anagrafica completa + quota associativa della sola annualità selezionata.
              </div>
            </div>

            <button
              className="btn"
              type="button"
              onClick={() => downloadExcel()}
              disabled={!soci.length}
              title={!soci.length ? "Nessun dato da esportare" : "Scarica Excel"}
            >
              Scarica Excel
            </button>
          </div>
        </div>
      </div>

      {/* MODALE CREA/MODIFICA */}
      {openModal && (
        <div
          onClick={() => !saving && setOpenModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.40)",
            zIndex: 20000,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: 12,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 620,
              background: "#fff",
              borderRadius: 18,
              boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
              overflow: "hidden",
              maxHeight: "calc(100vh - 24px)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: 14, borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ fontWeight: 950, color: "#111827" }}>
                {editing ? "Modifica socio" : "Nuovo socio"}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                Compila i dati anagrafici e amministrativi del socio.
              </div>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 10, overflowY: "auto" }}>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                <input
                  className="input"
                  placeholder="Nome *"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Cognome *"
                  value={cognome}
                  onChange={(e) => setCognome(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#374151" }}>
                    Data di nascita
                  </div>
                  <input
                    className="input"
                    type="date"
                    value={dataNascita}
                    onChange={(e) => setDataNascita(e.target.value)}
                  />
                </div>

                <input
                  className="input"
                  placeholder="Luogo di nascita"
                  value={luogoNascita}
                  onChange={(e) => setLuogoNascita(e.target.value)}
                />
              </div>

              <input
                className="input"
                placeholder="Residenza"
                value={residenza}
                onChange={(e) => setResidenza(e.target.value)}
              />

              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#374151" }}>
                    Data di ammissione
                  </div>
                  <input
                    className="input"
                    type="date"
                    value={dataAmmissione}
                    onChange={(e) => setDataAmmissione(e.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#374151" }}>
                    Data di cessazione
                  </div>
                  <input
                    className="input"
                    type="date"
                    value={dataCessazione}
                    onChange={(e) => setDataCessazione(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
                <input
                  className="input"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="PEC"
                  value={pec}
                  onChange={(e) => setPec(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#374151" }}>
                  Qualifica
                </div>
                <select
                  className="input"
                  value={qualifica}
                  onChange={(e) => setQualifica(e.target.value as Qualifica)}
                >
                  <option value="FONDATORE">Fondatore</option>
                  <option value="ORDINARIO">Ordinario</option>
                  <option value="SOSTENITORE">Sostenitore</option>
                </select>
              </div>

              <button className="btn btn--block" type="button" onClick={saveSocio} disabled={saving}>
                {saving ? "Salvataggio…" : editing ? "Salva modifiche" : "Crea socio"}
              </button>
            </div>

            <div
              style={{
                padding: 12,
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button className="btn" type="button" onClick={() => !saving && setOpenModal(false)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
