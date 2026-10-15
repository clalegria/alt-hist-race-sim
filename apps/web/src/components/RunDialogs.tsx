import { useState } from "react";
import { type JumpPoint, jumpPlace, jumpTarget, jumpYears } from "../lib/run-bar.js";
import { comparePlaces, type Place } from "../lib/timeline.js";
import { MONO_LABEL } from "../lib/utils.js";
import { cursorPlace, type Run } from "../store/season.js";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog.js";
import { Button } from "./ui/button.js";
import { Segmented } from "./ui/segmented.js";
import { YearPicker } from "./YearPicker.js";

/**
 * What the confirmation says, by what is about to be thrown away. Exit run and
 * Back past the run's first page are the same question; Start on a setup page
 * is the same consequence reached from the other side; the two restarts throw
 * away results but keep the run; Clear all edits throws away a grid.
 */
export const RUN_CONFIRM_COPY = {
  exit: {
    title: "Exit this run?",
    description: "It will be discarded. There is no way to get it back.",
    confirm: "Exit run",
  },
  replace: {
    title: "Start a new run?",
    description: "This will end your current run. It will be discarded.",
    confirm: "End it and start",
  },
  restartSeason: {
    title: "Restart this season?",
    description: "The season is raced again from the same grid, with new results.",
    confirm: "Restart season",
  },
  clearEdits: {
    // Not "the real one": a reseat or the run's own cars are where the season
    // started, and clearing keeps them.
    title: "Clear your grid edits?",
    description:
      "Every change you made is undone, and the grid goes back to how the season started.",
    confirm: "Clear edits",
  },
  restartEra: {
    title: "Restart the era?",
    description:
      "Every season so far is thrown away and the era starts again from its first grid, with new results.",
    confirm: "Restart era",
  },
} as const;

export type RunConfirm = keyof typeof RUN_CONFIRM_COPY;

/**
 * The one confirmation for everything that throws work away: Exit run, a
 * browser Back past the run's first page, Start while a run exists, and both
 * restarts.
 *
 * A dialog because a browser navigation has to be held *while* the question is
 * asked, and then the same dialog for the rest, so throwing a run away always
 * looks the same. Radix's `AlertDialog` traps focus, closes on Escape — as a
 * Cancel — and announces itself as an alert, which is the platform contract for
 * "this destroys something". Controlled: the caller decides when it is open and
 * what each answer does.
 */
export function RunConfirmDialog({
  open,
  variant,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  variant: RunConfirm;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const copy = RUN_CONFIRM_COPY[variant];
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogBody>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogBody>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="ghost">Cancel</Button>
          </AlertDialogCancel>
          {/*
            A plain button, not Radix's Action: Action also closes the dialog
            through `onOpenChange`, which is the Cancel path here. The caller
            closes it by answering.
          */}
          <Button variant="destructive" onClick={onConfirm}>
            {copy.confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** What the jump's two landing points are called, and what each is for. */
const POINTS: readonly { readonly point: JumpPoint; readonly label: string }[] = [
  { point: "start", label: "Start of the season" },
  { point: "end", label: "End of the season" },
];

/**
 * Jump to…: pick a year ahead, and whether to stop at its start — its grid, to
 * set it up — or at its end, its summary. Every season up to there is run in
 * one go and crowned unread.
 *
 * The same `YearPicker` the setup pages use, restricted to the years a jump can
 * reach. What the button runs is `jumpTarget`, so a choice the run has since
 * overtaken falls back to one still ahead rather than reaching the store.
 */
export function JumpDialog({
  open,
  run,
  onJump,
  onCancel,
}: {
  open: boolean;
  run: Run;
  onJump: (target: Place) => void;
  onCancel: () => void;
}) {
  // The question being asked, not the run, so it stays here rather than in
  // the store.
  const [chosen, setChosen] = useState<{ year: number | null; point: JumpPoint }>({
    year: null,
    point: "end",
  });
  const years = jumpYears(run);
  const target = jumpTarget(run, chosen);
  const cursor = cursorPlace(run);
  return (
    <AlertDialog
      open={open && target !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent className="max-w-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Jump to…</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogBody>
          <AlertDialogDescription>
            Every season up to the one you pick is raced in one go. Stop at its start, to change its
            grid, or at its end.
          </AlertDialogDescription>
          {target === null ? null : (
            <>
              <YearPicker
                year={target.year}
                onSelect={(year) => {
                  setChosen((current) => ({ ...current, year }));
                }}
                title="Season"
                lead="Only seasons you haven't reached yet."
                describeYear={(year) => `Jump to ${year}`}
                playable={(year) => years.includes(year)}
              />
              <div className="flex flex-col gap-2">
                <span className={MONO_LABEL}>Stop at</span>
                <Segmented
                  label="Stop at"
                  className="self-start"
                  segment="h-9 px-4 text-sm font-medium"
                  items={POINTS.map(({ point, label }) => ({
                    key: point,
                    label,
                    selected: target.beat.kind === (point === "start" ? "grid" : "summary"),
                    // The start of a year already begun is behind the run.
                    disabled: comparePlaces(jumpPlace(target.year, point), cursor) <= 0,
                    onPick: () => {
                      setChosen((current) => ({ ...current, point }));
                    },
                  }))}
                />
              </div>
            </>
          )}
        </AlertDialogBody>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="ghost">Cancel</Button>
          </AlertDialogCancel>
          {target === null ? null : (
            <Button
              onClick={() => {
                onJump(target);
              }}
            >
              {target.beat.kind === "grid"
                ? `Simulate to the ${target.year} grid`
                : `Simulate through ${target.year}`}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
