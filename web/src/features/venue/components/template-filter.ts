export type TemplateTab = "all" | "public" | "private";

type Filterable = { name: string; description: string | null; createdByName: string | null; isPublic: boolean };

export type TemplateTabCounts = Record<TemplateTab, number>;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("tr");
}

function matchesQuery(t: Filterable, query: string): boolean {
  const q = normalize(query);
  if (q === "") return true;
  return [t.name, t.description ?? "", t.createdByName ?? ""].some((field) => normalize(field).includes(q));
}

/** Sekme sayıları aramayı da yansıtır: "Tümü (n)" görünen kartlarla tutarlı kalır. */
export function countTemplateTabs(templates: readonly Filterable[], query: string): TemplateTabCounts {
  const matching = templates.filter((t) => matchesQuery(t, query));
  return {
    all: matching.length,
    public: matching.filter((t) => t.isPublic).length,
    private: matching.filter((t) => !t.isPublic).length,
  };
}

export function filterTemplates<T extends Filterable>(templates: readonly T[], query: string, tab: TemplateTab): T[] {
  return templates.filter(
    (t) => matchesQuery(t, query) && (tab === "all" || (tab === "public" ? t.isPublic : !t.isPublic)),
  );
}
