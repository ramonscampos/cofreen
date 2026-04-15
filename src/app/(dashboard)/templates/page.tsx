import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { recurringTemplates } from "@/db/schema";
import { TemplateManager } from "./template-manager";

export default async function TemplatesPage() {
  const session = await auth();

  if (!session?.user) {
    return redirect("/login");
  }

  const templates = await db
    .select()
    .from(recurringTemplates)
    .where(eq(recurringTemplates.userId, session.user.id))
    .orderBy(recurringTemplates.dayOfMonth);

  return <TemplateManager initialTemplates={templates} />;
}
