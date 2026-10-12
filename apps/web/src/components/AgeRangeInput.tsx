import { AGE_RANGE, type AgeBand, type RatingMode, withAge } from "@alt-hist/data";
import { useState } from "react";
import { Input } from "./ui/input.js";

/**
 * The age to commit while the reader types `text`: one the range can hold as
 * it stands, or null to hold the text and keep the range's last value — an
 * empty box, or the "2" on the way to "25".
 */
export function typedAge(text: string): number | null {
  const value = Number(text);
  return text.trim() !== "" &&
    Number.isInteger(value) &&
    value >= AGE_RANGE.min &&
    value <= AGE_RANGE.max
    ? value
    : null;
}

/**
 * The age to commit when the reader leaves a box holding `text`: anything
 * typed that was held, to be clamped (`withAge`); null for an empty box or
 * one that is not a number, which goes back to the range's value, or for an
 * age already committed.
 */
export function leftAge(text: string): number | null {
  const value = Number(text);
  return text.trim() === "" || !Number.isFinite(value) || typedAge(text) !== null ? null : value;
}

/** One end of the range: `typedAge` while typing, `leftAge` on leaving. */
function AgeInput({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  // What the reader has typed, or null to show the range's own value.
  const [typed, setTyped] = useState<string | null>(null);
  return (
    <Input
      type="number"
      aria-label={label}
      min={AGE_RANGE.min}
      max={AGE_RANGE.max}
      value={typed ?? value}
      onChange={(event) => {
        const text = event.target.value;
        setTyped(text);
        const age = typedAge(text);
        if (age !== null) {
          onCommit(age);
        }
      }}
      onBlur={() => {
        const age = typed === null ? null : leftAge(typed);
        if (age !== null) {
          onCommit(age);
        }
        setTyped(null);
      }}
      className="h-7 w-14 px-1.5 text-center text-xs"
    />
  );
}

/**
 * An age range as two number boxes, "Aged [18] to [42]": the grid editor's
 * filter and the run settings' *Drivers who can be signed* alike. The ends
 * cannot cross (`withAge` pushes the other one along). Under `peak` the ages
 * are each driver's age at their best, and it says so: a bare "Aged 18 to 42"
 * beside a 1980 season is read as 1980 ages.
 */
export function AgeRangeInput<Band extends AgeBand>({
  band,
  ratingMode,
  onChange,
}: {
  band: Band;
  ratingMode: RatingMode;
  /** Absent in tests, where nothing is typed. */
  onChange?: (band: Band) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span>{ratingMode === "peak" ? "Peak age" : "Aged"}</span>
      <AgeInput
        label="Youngest age"
        value={band.minAge}
        onCommit={(age) => onChange?.(withAge(band, "min", age))}
      />
      <span>to</span>
      <AgeInput
        label="Oldest age"
        value={band.maxAge}
        onCommit={(age) => onChange?.(withAge(band, "max", age))}
      />
    </div>
  );
}
