// One-off cleanup for the move to Pluggy-synced cards.
//   node scripts/cleanup-legacy-card-data.mjs --backup <file.json>
//   node scripts/cleanup-legacy-card-data.mjs --apply
import { writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const sql = neon(process.env.DATABASE_URL);
const [mode, target] = process.argv.slice(2);

if (mode === "--backup") {
  if (!target) throw new Error("Usage: --backup <file.json>");
  const dump = {
    takenAt: new Date().toISOString(),
    cards: await sql`select * from cards`,
    transactions: await sql`select * from transactions`,
    recurring_templates: await sql`select * from recurring_templates`,
  };
  writeFileSync(target, JSON.stringify(dump, null, 2));
  console.log(
    `backup: ${target} (cards ${dump.cards.length}, transactions ${dump.transactions.length}, templates ${dump.recurring_templates.length})`,
  );
} else if (mode === "--apply") {
  const [linked] =
    await sql`select count(*)::int n from cards where pluggy_account_id is not null`;
  if (linked.n === 0) {
    throw new Error(
      "No Pluggy-linked cards yet: run the first sync before cleanup",
    );
  }
  const [transactions, templates, cards] = await sql.transaction([
    sql`delete from transactions returning id`,
    sql`delete from recurring_templates where card_id is not null returning id`,
    sql`delete from cards where pluggy_account_id is null returning id`,
  ]);
  console.log(
    `deleted: transactions ${transactions.length}, card templates ${templates.length}, legacy cards ${cards.length}`,
  );
} else {
  throw new Error("Usage: --backup <file.json> | --apply");
}
