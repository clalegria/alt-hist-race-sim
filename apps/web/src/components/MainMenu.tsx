import { MODES, type Mode, type ModeId } from "../lib/modes.js";
import { PLAYABLE_SEASONS } from "../lib/seasons.js";
import { cn, MONO_LABEL } from "../lib/utils.js";

/**
 * The opening screen, as a timing tower: the hero and the run in progress on
 * the left, the modes as a tower of rows on the right (one column on a phone).
 *
 * Props-driven like `SeasonView`, so every mode row renders through
 * `renderToStaticMarkup` without a DOM — including the unfinished ones, which
 * are the part most likely to be quietly broken by an edit elsewhere.
 */

/**
 * A year in the hero's copy, set in the headline's face so the range stands
 * out. The range is the seed data's, never written down.
 */
function Year({ children }: { children: React.ReactNode }) {
  return (
    <span className="narrow text-foreground text-[1.375rem] leading-none font-extrabold tabular-nums lg:short:text-lg">
      {children}
    </span>
  );
}

function ModeRow({ mode, onChoose }: { mode: Mode; onChoose: (id: ModeId) => void }) {
  return (
    <button
      type="button"
      disabled={!mode.available}
      onClick={() => {
        onChoose(mode.id);
      }}
      className={cn(
        "border-border focus-visible:ring-ring grid min-h-16 w-full grid-cols-[0.375rem_minmax(0,1fr)_auto] items-center gap-3.5 border-t pr-3.5 text-left transition first:border-t-0 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
        mode.available ? "hover:bg-primary/12 cursor-pointer" : "cursor-not-allowed",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("self-stretch", mode.available ? "bg-primary" : "bg-border")}
      />
      <span className="flex min-w-0 flex-col py-2.5">
        <span
          className={cn(
            "narrow text-xl leading-tight font-extrabold uppercase",
            !mode.available && "text-muted-foreground",
          )}
        >
          {mode.title}
        </span>
        <span className="text-muted-foreground text-[0.8125rem]">{mode.blurb}</span>
      </span>
      {mode.available ? (
        <span className="bg-primary text-primary-foreground px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase">
          Ready
        </span>
      ) : (
        <span className="border-border text-muted-foreground border px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-wider uppercase">
          Soon
        </span>
      )}
    </button>
  );
}

export function MainMenu({
  onChoose,
  resume,
}: {
  onChoose: (mode: ModeId) => void;
  /** The run in progress, if there is one: drawn under the hero, since it is the likeliest next click. */
  resume?: React.ReactNode;
}) {
  // On a wide screen the page fills the window above the track (`Shell`'s
  // `fit`), so the two columns share one row of what is left. A short window
  // gets a headline sized to its height, smaller copy, a tighter run panel and
  // less padding; past that the modes scroll, and the hero too as a last
  // resort, rather than push the track off.
  return (
    <div className="grid grid-cols-1 gap-6 py-6 sm:py-10 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:grid-rows-[minmax(0,1fr)] lg:items-start lg:gap-x-10 lg:short:py-3">
      <div className="flex flex-col gap-2.5 lg:max-h-full lg:overflow-y-auto lg:short:gap-2">
        <header className="flex flex-col gap-2.5 lg:short:gap-2">
          <p className={MONO_LABEL}>Alternate history motorsport simulator</p>
          <h1 className="narrow text-5xl leading-[0.9] font-extrabold tracking-[0.01em] text-balance uppercase md:text-[clamp(2.75rem,12.2dvh_-_2rem,4.5rem)]">
            Rewrite motorsport history
          </h1>
          {/* Smaller on a short window, and the column's full width, so it takes fewer lines. */}
          <p className="text-muted-foreground max-w-[52ch] lg:short:max-w-none lg:short:text-sm">
            Re-live and re-race any season in motorsport history from{" "}
            <Year>{PLAYABLE_SEASONS[0]}</Year> to <Year>{PLAYABLE_SEASONS.at(-1)}</Year>. Try
            swapping drivers between teams to see how history could've played out differently, or
            try the settings to see how things could've changed in many other ways.
          </p>
        </header>
        {resume === undefined ? null : <div className="mt-2.5 lg:short:mt-0">{resume}</div>}
      </div>

      <section
        aria-label="Modes"
        className="bg-card border-border border lg:flex lg:max-h-full lg:flex-col"
      >
        <div className="bg-card-header border-border flex justify-between border-b py-2 pr-3.5 pl-5">
          <span className={MONO_LABEL}>Mode</span>
          <span className={MONO_LABEL}>Status</span>
        </div>
        <div className="striped lg:min-h-0 lg:overflow-y-auto">
          {MODES.map((mode) => (
            <ModeRow key={mode.id} mode={mode} onChoose={onChoose} />
          ))}
        </div>
      </section>
    </div>
  );
}
