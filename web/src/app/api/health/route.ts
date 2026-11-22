import { NextResponse } from "next/server";
import { pool } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pool.query("select 1");
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
