import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { CardManager } from "./card-manager";

export default async function CardsPage() {
  const session = await auth();

  if (!session?.user) {
    return redirect("/login");
  }

  const userCards = await db
    .select()
    .from(cards)
    .where(eq(cards.userId, session.user.id))
    .orderBy(cards.createdAt);

  return <CardManager initialCards={userCards} />;
}
