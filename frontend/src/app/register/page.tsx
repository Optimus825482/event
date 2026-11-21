import { redirect } from "next/navigation";

// Herkese açık kayıt kapatıldı; kullanıcıları yalnızca yönetici oluşturur.
export default function RegisterPage() {
  redirect("/login");
}
