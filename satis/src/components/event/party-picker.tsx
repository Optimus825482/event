import { Button } from "@/components/ui/button";
import { DEFAULT_PARTY_SIZE, PARTY_PARAM } from "@/features/plan/party";
import { partyOptions } from "./facts";

export function PartyPicker({
  eventId,
  maxSeatsPerOrder,
  selected,
}: {
  eventId: string;
  maxSeatsPerOrder: number;
  selected?: number;
}): React.JSX.Element {
  const options = partyOptions(maxSeatsPerOrder);
  const maxOption = options[options.length - 1] ?? 1;
  const chosen = Math.max(1, Math.min(selected ?? DEFAULT_PARTY_SIZE, maxOption));

  return (
    <form
      id="bilet-al"
      method="get"
      action={`/etkinlik/${eventId}#masa-secimi`}
      className="space-y-4 rounded-[16px] border border-line-gold bg-surface p-5"
    >
      <fieldset key={chosen} className="space-y-3">
        <legend className="text-sm font-semibold text-ivory">Kaç kişilik bilet alacaksınız?</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name={PARTY_PARAM}
                value={n}
                defaultChecked={n === chosen}
                className="peer sr-only"
              />
              <span className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line-gold bg-surface-raised px-4 text-sm font-semibold text-ivory transition-colors hover:border-gold peer-checked:border-gold peer-checked:bg-gold peer-checked:text-on-gold peer-focus-visible:outline-2 peer-focus-visible:outline-gold-bright">
                {`${n} Kişi`}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="submit" variant="gold" size="lg">
        Masa Seçimine Geç →
      </Button>
    </form>
  );
}
