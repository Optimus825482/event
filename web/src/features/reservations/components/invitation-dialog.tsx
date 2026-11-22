"use client";

import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Recipient } from "@/features/invitations/event-invitation";
import { SendPanel } from "@/features/invitations/components/send-panel";

/** E-Davetiye penceresi: misafirlere e-posta veya WhatsApp bağlantısıyla davetiye gönderme paneli. */
export function InvitationDialog({ recipients, canSend }: { recipients: Recipient[]; canSend: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Mail />
          E-Davetiye
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>E-Davetiye gönder</DialogTitle>
          <DialogDescription>
            Misafire e-postayla gönderin ya da WhatsApp bağlantısı oluşturun. Bağlantı yalnızca o misafirin davetiyesini gösterir.
          </DialogDescription>
        </DialogHeader>
        <SendPanel recipients={recipients} canSend={canSend} />
      </DialogContent>
    </Dialog>
  );
}
