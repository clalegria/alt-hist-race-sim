import { MODES, type Mode, type ModeId } from "../lib/modes.js";
import { PARADE_COVER } from "../lib/parade.js";
import { PLAYABLE_SEASONS } from "../lib/seasons.js";
import { cn } from "../lib/utils.js";

/**
 * The opening screen, as a timing tower: the hero and the run in progress on
 * the left, the modes as a tower of rows on the right (one column on a phone).
 *
 * Props-driven like `SeasonView`, so every mode row renders through
 * `renderToStaticMarkup` without a DOM — including the unfinished ones, which
 * are the part most likely to be quietly broken by an edit elsewhere.
 */

/** A small label in mono capitals: the hero's eyebrow, the facts, the panels' head bands. */
export const MONO_LABEL =
  "text-muted-foreground font-mono text-[11px] font-medium tracking-widest uppercase";

/** How much history there is to run, off the seed data: never written down. */
function Facts() {
  const facts = [
    { label: "Seasons", value: PLAYABLE_SEASONS.length },
    { label: "First", value: PLAYABLE_SEASONS[0] },
    { label: "Latest", value: PLAYABLE_SEASONS.at(-1) },
  ];
  return (
    <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-2">
      {facts.map((fact) => (
        <div key={fact.label} className="flex flex-col-reverse">
          <dt className={MONO_LABEL}>{fact.label}</dt>
          <dd className="text-[1.375rem] leading-tight font-semibold tabular-nums">{fact.value}</dd>
        </div>
      ))}
    </dl>
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
  return (
    <div className="grid grid-cols-1 gap-6 py-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-x-10">
      <div className="flex flex-col gap-2.5">
        <header className="flex flex-col gap-2.5">
          <p className={MONO_LABEL}>Alternate history motorsport simulator</p>
          <h1 className="narrow text-5xl leading-[0.9] font-extrabold tracking-[0.01em] text-balance uppercase md:text-7xl">
            Rewrite motorsport history
          </h1>
          <p className="text-muted-foreground max-w-[46ch]">
            Pick a real season and race it again. The drivers and cars are the real ones; the
            results are new every time.
          </p>
        </header>
        <Facts />
        {resume === undefined ? null : <div className="mt-2.5">{resume}</div>}
      </div>

      <section {...PARADE_COVER} aria-label="Modes" className="bg-card border-border border">
        <div className="bg-card-header border-border flex justify-between border-b py-2 pr-3.5 pl-5">
          <span className={MONO_LABEL}>Mode</span>
          <span className={MONO_LABEL}>Status</span>
        </div>
        <div className="striped">
          {MODES.map((mode) => (
            <ModeRow key={mode.id} mode={mode} onChoose={onChoose} />
          ))}
        </div>
      </section>
    </div>
  );
}
