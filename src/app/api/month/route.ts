import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCurrentMonthRef, normalizeMonthRef } from "@/lib/finance-logic";
import { getMonthData } from "@/lib/month-data";

// GET instead of a server action: actions run one at a time, which would
// queue month prefetches behind each other
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const month = new URL(request.url).searchParams.get("month");
  const monthRef = normalizeMonthRef(month, getCurrentMonthRef());
  return NextResponse.json(await getMonthData(session.user.id, monthRef));
}
