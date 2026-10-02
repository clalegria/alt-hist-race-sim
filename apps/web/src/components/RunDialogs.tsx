import { useState } from "react";
import { eraActionsFor, eraJumpTarget } from "../lib/run-bar.js";
import { isPlayable } from "../lib/seasons.js";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "./ui/alert-dialog.js";
import { Button } from "./ui/button.js";
import { YearPicker } from "./YearPicker.js";

/**
 * What the exit dialog says, by how the reader is leaving. Exit run and Back
 * past the run's first page are the same question; Start on a setup page is
 * the same consequence reached from the other side.
 */
export const EXIT_RUN_COPY = {
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
} as const;

/**
 * The one confirmation every way out of a run goes through: the overflow's
 * Exit run, a browser Back past the run's first page, and Start while a run
 * exists.
 *
 * A dialog rather than the inline confirm the rest of the bar uses, because a
 * browser navigation has to be held *while* the question is asked, and the
 * page the reader is leaving from may have no bar row to ask it in. Radix's
 * `AlertDialog` traps focus, closes on Escape — as a Cancel — and announces
 * itself as an alert, which is the platform contract for "this destroys
 * something". Controlled: the caller decides when it is open and what each
 * answer does.
 */
export function ExitRunDialog({
  open,
  variant,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  variant: keyof typeof EXIT_RUN_COPY;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const copy = EXIT_RUN_COPY[variant];
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
        <AlertDialogTitle>{copy.title}</AlertDialogTitle>
        <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="ghost">Cancel</Button>
          </AlertDialogCancel>
          {/*
            A plain button, not Radix's Action: Action also closes the dialog
            through `onOpenChange`, which is the Cancel path here. The caller
            closes it by answering.
          */}
          <Button onClick={onConfirm}>{copy.confirm}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * The overflow's Jump forward: pick a year ahead of the era, then run every
 * season up to it in one go.
 *
 * The same `YearPicker` the setup pages use, restricted to the years the era
 * has not reached and opening on the far end. What the button runs is
 * `eraJumpTarget`, so a year picked and then overtaken falls back to the far
 * end rather than reaching the store.
 */
export function JumpForwardDialog({
  open,
  lastCrowned,
  onJump,
  onCancel,
}: {
  open: boolean;
  lastCrowned: number;
  onJump: (through: number) => void;
  onCancel: () => void;
}) {
  // Which year is picked is about the question being asked, not the run, so it
  // stays here rather than in the store.
  const [chosen, setChosen] = useState<number | null>(null);
  const target = eraJumpTarget(lastCrowned, chosen);
  const { next } = eraActionsFor(lastCrowned);
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
        <AlertDialogTitle>Jump forward</AlertDialogTitle>
        <AlertDialogDescription>
          Every season from {lastCrowned + 1} on is simulated in one go, and the era stops on the
          year you pick.
        </AlertDialogDescription>
        {target === null ? null : (
          <YearPicker
            year={target}
            onSelect={setChosen}
            title="Jump forward to"
            lead="Nothing after it is run, so you can carry on from there."
            describeYear={(year) => `Simulate the era through to ${year}`}
            playable={(year) => isPlayable(year) && next !== null && year >= next}
          />
        )}
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
              Simulate through to {target}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
