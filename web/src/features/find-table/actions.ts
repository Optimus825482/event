"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { FIND_TABLE_MISMATCH, submitFindTable } from "./submit";

export type FindTableFormState = { error: string | null };

/** Oturumsuz form eylemi: kod ve soyad yalnızca gövdede gider, hiçbir URL'ye yazılmaz. */
export async function findTableAction(_prev: FindTableFormState, formData: FormData): Promise<FindTableFormState> {
  const outcome = await submitFindTable(
    db,
    { code: formData.get("code"), lastName: formData.get("lastName") },
    await headers(),
  );
  if (outcome.kind === "found") redirect(`/masam/${encodeURIComponent(outcome.token)}`);
  if (outcome.kind === "limited") redirect(`/masam/limited?r=${outcome.retryAfterSeconds}`);
  return { error: FIND_TABLE_MISMATCH };
}
