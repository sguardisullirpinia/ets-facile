import { supabase } from "./supabase";

export async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Not authenticated");
  return data.user.id;
}

export async function getEnteProfile() {
  const { data, error } = await supabase
    .from("ente_profiles")
    .select("denominazione,natura")
    .single();
  if (error) throw error;
  return data as { denominazione: string; natura: "APS" | "ODV" };
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

export async function listAig(annualitaId: string) {
  const { data, error } = await supabase
    .from("aig")
    .select(
      "id,nome,descrizione,entrate,costi_diretti,costi_fin,costi_supporto",
    )
    .eq("annualita_id", annualitaId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listArt6(annualitaId: string) {
  const { data, error } = await supabase
    .from("attivita_diverse")
    .select("id,nome,descrizione,entrate,uscite")
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
export async function getArt6ById(id: string) {
  const { data, error } = await supabase
    .from("attivita_diverse")
    .select("id, nome, descrizione, entrate, uscite")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as any;
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
  const { error } = await supabase
    .from("annualita")
    .delete()
    .eq("id", annualitaId);
  if (error) throw error;
}
