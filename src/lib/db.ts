import { supabase } from "./supabase";

export async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

/**
 * Ritorna il profilo dell'ente dell'utente loggato.
 * IMPORTANTISSIMO: filtra per user_id, così non rischi errori quando esistono più righe in ente_profiles.
 */
export async function getEnteProfile() {
  const user_id = await requireUserId();

  const { data, error } = await supabase
    .from("ente_profiles")
    .select("user_id,denominazione,natura")
    .eq("user_id", user_id)
    .single();

  if (error) throw error;

  return data as {
    user_id: string;
    denominazione: string;
    natura: "APS" | "ODV";
  };
}

export async function getAnnualita(annualitaId: string) {
  const { data, error } = await supabase
    .from("annualita")
    .select("id, anno, extra")
    .eq("id", annualitaId)
    .single();
  if (error) throw error;
  return data as { id: string; anno: number; extra: any };
}
export async function getArt6ById(art6Id: string) {
  const { data, error } = await supabase
    .from("attivita_diverse")
    .select("id,nome,descrizione,entrate,uscite,occasionale,annualita_id,created_at")
    .eq("id", art6Id)
    .single();

  if (error) throw error;
  return data;
}


export async function listAig(annualitaId: string) {
  const { data, error } = await supabase
    .from("aig")
    .select("id,nome,descrizione,entrate,costi_diretti,costi_fin,costi_supporto")
    .eq("annualita_id", annualitaId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listArt6(annualitaId: string) {
  const { data, error } = await supabase
    .from("attivita_diverse")
    .select("id,nome,descrizione,entrate,uscite,occasionale")
    .eq("annualita_id", annualitaId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listRaccolte(annualitaId: string) {
  const { data, error } = await supabase
    .from("raccolte_fondi")
    .select("id,nome,descrizione,entrate,uscite")
    .eq("annualita_id", annualitaId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createAig(
  annualitaId: string,
  nome: string,
  descrizione: string,
) {
  const { data, error } = await supabase
    .from("aig")
    .insert({
      annualita_id: annualitaId,
      nome,
      descrizione,
      entrate: {},
      costi_diretti: {},
      costi_fin: {},
      costi_supporto: {},
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

export async function createArt6(
  annualitaId: string,
  nome: string,
  descrizione: string,
) {
  const { data, error } = await supabase
    .from("attivita_diverse")
    .insert({
      annualita_id: annualitaId,
      nome,
      descrizione,
      entrate: {},
      uscite: {},
      occasionale: false, // ✅ aggiunto
    })
    .select("id")
    .single();

  if (error) throw error;
  return data!.id as string;
}

export async function createRaccolta(
  annualitaId: string,
  nome: string,
  descrizione: string,
) {
  const { data, error } = await supabase
    .from("raccolte_fondi")
    .insert({
      annualita_id: annualitaId,
      nome,
      descrizione,
      entrate: {},
      uscite: {},
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

export async function updateAnnualitaExtra(annualitaId: string, extra: any) {
  const { error } = await supabase
    .from("annualita")
    .update({ extra })
    .eq("id", annualitaId);
  if (error) throw error;
}

export async function getAigById(aigId: string) {
  const { data, error } = await supabase
    .from("aig")
    .select(
      "id, annualita_id, nome, descrizione, entrate, costi_diretti, costi_fin, costi_supporto",
    )
    .eq("id", aigId)
    .single();
  if (error) throw error;
  return data as any;
}

export async function updateAig(
  aigId: string,
  patch: Partial<{
    nome: string;
    descrizione: string;
    entrate: any;
    costi_diretti: any;
    costi_fin: any;
    costi_supporto: any;
  }>,
) {
  const { error } = await supabase.from("aig").update(patch).eq("id", aigId);
  if (error) throw error;
}

export async function updateArt6(id: string, patch: any) {
  const { error } = await supabase
    .from("attivita_diverse")
    .update(patch)
    .eq("id", id);

  if (error) throw error;
}

export async function getRfById(id: string) {
  const { data, error } = await supabase
    .from("raccolte_fondi")
    .select("id, nome, descrizione, entrate, uscite")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as any;
}

export async function updateRf(id: string, patch: any) {
  const { error } = await supabase
    .from("raccolte_fondi")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAnnualita(annualitaId: string) {
  const { error } = await supabase.from("annualita").delete().eq("id", annualitaId);
  if (error) throw error;
}


export async function getIresByAnnualitaId(annualitaId: string) {
  const { data, error } = await supabase
    .from("ires")
    .select("*")
    .eq("annualita_id", annualitaId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertIresByAnnualitaId(annualitaId: string, payload: any) {
  const row = {
    annualita_id: annualitaId,
    imponibile: Number(payload?.imponibile ?? 0),
    aliquota: Number(payload?.aliquota ?? 24),
    imposta_lorda: Number(payload?.imposta_lorda ?? 0),
    imposta_netta: Number(payload?.imposta_netta ?? 0),
    acconti_versati: Number(payload?.acconti_versati ?? 0),
    ritenute: Number(payload?.ritenute ?? 0),
    saldo: Number(payload?.saldo ?? 0),
    note: payload?.note ?? "",
  };

  const { error } = await supabase
    .from("ires")
    .upsert(row, { onConflict: "annualita_id" });

  if (error) throw error;
}








