"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { UserSummary } from "../types";
import { DeleteUserDialog } from "./delete-user-dialog";

/** Ayrıntı sayfasındaki sil düğmesi; uygunluk kontrolü sunucu sayfasında yapılır. */
export function UserDeleteButton({ user }: { user: UserSummary }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
        aria-label={`${user.username} kullanıcısını sil`}
        onClick={() => setOpen(true)}
      >
        Kullanıcıyı sil
      </Button>
      <DeleteUserDialog
        user={open ? user : null}
        onClose={() => setOpen(false)}
        onDeleted={() => router.push("/admin/users")}
      />
    </>
  );
}
