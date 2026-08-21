import { MODES, type Mode, type ModeId } from "../lib/modes.js";
import { cn } from "../lib/utils.js";

/**
 * The opening screen: what this is, and what can be run.
 *
 * Props-driven like `SeasonView`, so every mode card renders through
 * `renderToStaticMarkup` without a DOM — including the unfinished one, which is
 * the part most likely to be quietly broken by an edit elsewhere.
 */

function ModeCard({ mode, onChoose }: { mode: Mode; onChoose: (id: ModeId) => void }) {
  return (
    <button
      type="button"
      disabled={!mode.available}
      onClick={() => {
        onChoose(mode.id);
      }}
      className={cn(
        "bg-card border-border focus-visible:ring-ring flex flex-col items-start gap-2 rounded-xl border p-5 text-left shadow-sm transition focus-visible:ring-2 focus-visible:outline-none",
        mode.available
          ? "hover:border-primary/50 hover:bg-accent cursor-pointer"
          : "cursor-not-allowed opacity-55",
      )}
    >
      <span className="flex w-full items-center justify-between gap-3">
        <span className="text-base font-semibold tracking-tight">{mode.title}</span>
        {mode.available ? null : (
          <span className="border-border text-muted-foreground rounded border px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wider uppercase">
            Not yet
          </span>
        )}
      </span>
      <span className="text-muted-foreground text-sm">{mode.blurb}</span>
    </button>
  );
}

export function MainMenu({ onChoose }: { onChoose: (mode: ModeId) => void }) {
  return (
    <div className="flex flex-col gap-8 py-6 sm:py-10">
      <header className="flex flex-col gap-3">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Alternate history motorsport simulator
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Rewrite motorsport history
        </h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          Start from a real season, then let it run somewhere else. Every result is simulated from
          the drivers and cars as they were, so the history you get is plausible — and never the one
          that happened.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {MODES.map((mode) => (
          <ModeCard key={mode.id} mode={mode} onChoose={onChoose} />
        ))}
      </div>
    </div>
  );
}
