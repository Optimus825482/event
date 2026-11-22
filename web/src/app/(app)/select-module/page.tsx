import { redirect } from "next/navigation";

/** Eski arayüzdeki `/select-module` adresi artık ana sayfadır. */
export default function SelectModulePage(): never {
  redirect("/");
}
