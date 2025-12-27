"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Loader2 } from "lucide-react";
import { eventsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";

// Heavy component - dynamic import ile lazy load
const InvitationEditor = dynamic(
  () =>
    import("@/components/invitations/InvitationEditor").then(
      (mod) => mod.InvitationEditor
    ),
  {
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    ),
    ssr: false,
  }
);

export default function EventInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const res = await eventsApi.getOne(eventId);
        setEvent(res.data);
      } catch (err) {
        console.error("Etkinlik yüklenemedi:", err);
        router.push("/events");
      } finally {
        setLoading(false);
      }
    };
    loadEvent();
  }, [eventId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="icon"
            asChild
            className="border-slate-700 bg-slate-800"
          >
            <Link href={`/events/${eventId}`}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              E-Davetiye Tasarımı
            </h1>
            <p className="text-slate-400">{event?.name}</p>
          </div>
        </div>

        {/* Editor */}
        <div className="h-[calc(100vh-150px)]">
          <InvitationEditor
            eventId={eventId}
            eventData={{
              name: event?.name || "",
              description: event?.description,
              eventDate: event?.eventDate,
              eventTime: event?.eventTime,
              location: event?.location,
              hasReservations:
                event?.reservations?.length > 0 || event?.hasReservations,
            }}
            onSave={() => {
              router.push(`/events/${eventId}`);
            }}
          />
        </div>
      </div>
    </div>
  );
}
