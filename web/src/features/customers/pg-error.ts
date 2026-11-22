/** Hata zincirinde (`error`, `error.cause`, ...) verilen alanı bulur (pg: `code`, `constraint`). */
function findField(error: unknown, field: "code" | "constraint"): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth += 1) {
    const value: unknown = field in current ? Reflect.get(current, field) : undefined;
    if (typeof value === "string") return value;
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

export const pgCodeOf = (error: unknown) => findField(error, "code");
export const pgConstraintOf = (error: unknown) => findField(error, "constraint");
