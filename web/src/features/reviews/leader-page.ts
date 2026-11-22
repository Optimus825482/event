import { notFound } from "next/navigation";
import { DomainError } from "@/lib/action";

/** Sayfa yüklemesi: kapsam dışı kayıt (`not_found`) 404 olur, diğer hatalar olduğu gibi yükselir. */
export async function orNotFound<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}
