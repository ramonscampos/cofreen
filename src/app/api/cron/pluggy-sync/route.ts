import { NextResponse } from "next/server";
import { syncPluggyCards } from "@/lib/pluggy/sync";

export const maxDuration = 60;

export async function GET(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== expected
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await syncPluggyCards();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
