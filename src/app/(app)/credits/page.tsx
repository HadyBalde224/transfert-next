import { Credits } from "@/components/Credits";
import { createClient } from "@/lib/supabase/server";
import { exigerPatron, lireReglages } from "@/lib/session";
import { toCredit, type CreditRow } from "@/lib/types";

export const metadata = { title: "Crédits & dettes" };

export default async function PageCredits() {
  await exigerPatron();
  const { decimales } = await lireReglages();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("credits")
    .select("*, remboursements(*)")
    .order("date_creation", { ascending: false })
    .overrideTypes<CreditRow[], { merge: false }>();
  if (error) throw new Error(error.message);

  return (
    <Credits credits={data.map(toCredit)} decimales={decimales} />
  );
}
