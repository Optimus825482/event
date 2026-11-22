import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/features/auth/next-path";
import { getActor } from "@/features/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Giriş | EventFlow",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const rawNext = typeof next === "string" ? next : null;
  if (await getActor()) redirect(safeNextPath(rawNext));

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Image
            src="/eventflowprologo.png"
            alt="EventFlow PRO"
            width={200}
            height={52}
            className="mx-auto mb-4"
            priority
          />
          <h1 className="mt-2 text-base font-normal text-slate-400">Hesabınıza giriş yapın</h1>
        </div>
        <LoginForm next={rawNext} />
        <div className="mt-6 rounded-xl bg-slate-800/50 p-4">
          <p className="text-xs text-slate-500">Hesabınız yoksa admin ile iletişime geçin.</p>
        </div>
      </div>
    </main>
  );
}
