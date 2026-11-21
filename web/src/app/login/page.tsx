import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActor } from "@/features/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Giriş | EventFlow",
};

export default async function LoginPage() {
  if (await getActor()) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm rounded-(--radius) border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="mb-6 text-center text-xl font-semibold">EventFlow&apos;a giriş</h1>
        <LoginForm />
      </div>
    </main>
  );
}
