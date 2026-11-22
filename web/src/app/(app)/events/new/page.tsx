import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { can } from "@/features/auth/policy";
import { requirePolicyActor } from "@/features/auth/permissions";
import { EventForm } from "@/features/events/components/event-form";

export const metadata: Metadata = { title: "Yeni etkinlik | EventFlow" };

export default async function NewEventPage() {
  const actor = await requirePolicyActor();
  if (!can(actor, "events", "create")) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold">Yeni etkinlik</h1>
      <EventForm />
    </div>
  );
}
