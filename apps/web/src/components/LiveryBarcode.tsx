import { decadeTicks, type Stripe } from "../lib/barcode.js";
import { liveryFor } from "../lib/livery.js";
import { useTeamNameIn } from "./EntryNames.js";
import { useLiveryYear } from "./Liveries.js";
import { barcodeBackground } from "./TeamBadge.js";

/** The widest a stripe grows, so a short life is a short strip rather than a few wide blocks. */
const MAX_STRIPE_REM = 1.5;

/**
 * Colours over a life, one stripe per season in that season's team's livery,
 * drawn as its badge is (`barcodeBackground`): the badge's stripes as a band
 * along the bottom, as many accents as the badge has. Inside the badge's outline. A teal caret marks
 * `current`, the year the run has reached; a year sat out is a chequer
 * (`.barcode-gap`). Hover names a stripe's year, and its team's name where the
 * strip has more than one or `nameEvery` asks for it, as a driver's does.
 *
 * CSS on `span`s, not an SVG, for the badge's reason: tests count flags by `<svg>`.
 */
export function LiveryBarcode({
  stripes,
  current,
  nameEvery = false,
}: {
  stripes: readonly Stripe[];
  current: number;
  nameEvery?: boolean;
}) {
  const liveryYear = useLiveryYear();
  const teamNameIn = useTeamNameIn();
  const first = stripes[0]?.year;
  const last = stripes.at(-1)?.year;
  if (first === undefined || last === undefined) {
    return null;
  }
  const names = new Map(
    stripes.flatMap(({ year, teamId }) =>
      teamId === undefined ? [] : [[year, teamNameIn(teamId, year)] as const],
    ),
  );
  const named = nameEvery || new Set(names.values()).size > 1;
  const at = (year: number) => `${((year - first) / stripes.length) * 100}%`;
  return (
    <div className="w-full" style={{ maxWidth: `${stripes.length * MAX_STRIPE_REM}rem` }}>
      <div
        role="img"
        aria-label={`Colours by season, ${first}–${last}`}
        className="border-badge-line flex h-3.5 border"
      >
        {stripes.map(({ year, teamId }) => {
          const livery =
            teamId === undefined ? undefined : liveryFor(teamId, liveryYear(teamId, year));
          const name = names.get(year);
          return (
            <span
              key={year}
              data-year={year}
              title={
                teamId === undefined
                  ? `${year}, not racing`
                  : named && name !== undefined
                    ? `${year} (${name})`
                    : String(year)
              }
              className={`hover:outline-foreground relative flex-1 hover:z-10 hover:outline-2 hover:-outline-offset-1${livery === undefined ? " barcode-gap" : ""}`}
              style={livery === undefined ? undefined : { background: barcodeBackground(livery) }}
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
            // 10px: a tick label under a 12px rail; the scale has no size this small.
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
