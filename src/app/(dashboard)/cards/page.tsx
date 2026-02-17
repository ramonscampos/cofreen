import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CardManager } from "./card-manager";

export default async function CardsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const { data: cards } = await supabase
    .from("cards")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <CardManager
      user={user}
      initialCards={cards || []}
    />
  );
}
