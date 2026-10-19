import { decadeTicks, type Stripe } from "../lib/barcode.js";
import { liveryFor } from "../lib/livery.js";
import { useLiveryYear } from "./Liveries.js";

/** The widest a stripe grows, so a short life is a short strip rather than a few wide blocks. */
const MAX_STRIPE_REM = 1.5;

/**
 * A team's colours over its life, one stripe per season: the primary over the
 * first accent, as authored like the badge, inside the badge's outline. A teal
 * caret marks `current`, the season the heading describes; a year the team sat
 * out is left empty. Hover names a stripe's year.
 *
 * CSS on `span`s, not an SVG, for the badge's reason: tests count flags by `<svg>`.
 */
export function LiveryBarcode({
  teamId,
  stripes,
  current,
}: {
  teamId: string;
  stripes: readonly Stripe[];
  current: number;
}) {
  const liveryYear = useLiveryYear();
  const first = stripes[0]?.year;
  const last = stripes.at(-1)?.year;
  if (first === undefined || last === undefined) {
    return null;
  }
  const at = (year: number) => `${((year - first) / stripes.length) * 100}%`;
  return (
    <div className="w-full" style={{ maxWidth: `${stripes.length * MAX_STRIPE_REM}rem` }}>
      <div
        role="img"
        aria-label={`Colours by season, ${first}–${last}`}
        className="border-badge-line flex h-3.5 border"
      >
        {stripes.map(({ year, raced }) => {
          const livery = raced ? liveryFor(teamId, liveryYear(teamId, year)) : undefined;
          return (
            <span
              key={year}
              data-year={year}
              title={raced ? String(year) : `${year}, not racing`}
              className="hover:outline-foreground relative flex-1 hover:z-10 hover:outline-2 hover:-outline-offset-1"
              style={
                livery === undefined
                  ? undefined
                  : {
                      background: `linear-gradient(${livery.primaryColor} 0 66%, ${livery.secondaryColor1} 66%)`,
                    }
              }
            >
              {year === current ? (
                <span
                  data-caret
                  className="border-t-primary absolute -top-2 left-1/2 -translate-x-1/2 border-[5px] border-transparent"
                />
              ) : null}
            </span>
          );
        })}
      </div>
      <div aria-hidden="true" className="relative mt-0.5 h-3">
        {decadeTicks(first, last).map(({ year, label }) => (
          <span
            key={year}
            className="border-subtle text-subtle absolute top-0 h-full border-l pl-0.5 font-mono text-[10px] leading-3 tabular-nums"
            style={{ left: at(year) }}
          >
            {label ? year : null}
          </span>
        ))}
      </div>
    </div>
  );
}
