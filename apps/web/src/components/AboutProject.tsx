import type { ReactNode } from "react";
import { type AboutTab, type AboutTabLink, aboutHeading } from "../lib/about-tabs.js";
import { PLAYABLE_SEASONS } from "../lib/seasons.js";
import { cn, DISPLAY_CAPS } from "../lib/utils.js";
import { type Release, releaseDate } from "../lib/whats-new.js";
import { Flag } from "./Flag.js";
import { PageHeading } from "./PageHeading.js";
import { Tabs } from "./Tabs.js";

/**
 * The About page: who made this and why, what's new in each release, what is
 * known to be missing or wrong, and where to report a bug.
 *
 * The words are the author's, theirs to rewrite (`web-about.md`). Like the
 * season page, the tab and the releases are props, so it renders in a test
 * without a router or the real file.
 */
export function AboutProject({
  tab,
  tabs,
  releases,
  today = new Date(),
}: {
  tab: AboutTab;
  /** The tabs as links; absent in a test without a router. */
  tabs?: readonly AboutTabLink[];
  releases: readonly Release[];
  /** The day the author's age is counted on; a test fixes it. */
  today?: Date;
}) {
  return (
    <div className="flex flex-col gap-6 py-6 sm:py-10">
      <PageHeading title={aboutHeading(tab)} />
      {tabs === undefined ? null : <Tabs label="About" className="self-start" links={tabs} />}
      {tab === "about" ? (
        <About today={today} />
      ) : tab === "whats-new" ? (
        <WhatsNew releases={releases} />
      ) : tab === "known-issues" ? (
        <KnownIssues />
      ) : (
        <p className="text-muted-foreground">Not available yet.</p>
      )}
    </div>
  );
}

/**
 * Justified, hyphenating only words of ten letters or more, four either side of
 * the break, so a phone's narrow column neither opens wide gaps nor breaks often.
 */
const PROSE =
  "flex max-w-[65ch] flex-col gap-8 text-justify hyphens-auto [hyphenate-limit-chars:10_4_4]";

function Section({ heading, children }: { heading: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className={cn(DISPLAY_CAPS, "text-left text-2xl leading-none hyphens-none")}>
        {heading}
      </h2>
      {children}
    </section>
  );
}

/** A link out of the app, in running text: underlined, since colour alone is not enough. */
function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} rel="noreferrer" className="text-primary underline underline-offset-3">
      {children}
    </a>
  );
}

const REPOSITORY = "https://github.com/clalegria/alt-hist-race-sim";

/** The author's birthday, as year, month (1–12) and day. */
const AUTHOR_BORN = { year: 1986, month: 2, day: 25 } as const;

/**
 * How old someone born on `born` is on `today`, in the reader's own calendar:
 * a year older from their birthday on.
 */
export function yearsOld(
  born: { readonly year: number; readonly month: number; readonly day: number },
  today: Date,
): number {
  const month = today.getMonth() + 1;
  const birthdayPassed =
    month > born.month || (month === born.month && today.getDate() >= born.day);
  return today.getFullYear() - born.year - (birthdayPassed ? 0 : 1);
}

function About({ today }: { today: Date }) {
  return (
    <div className={PROSE}>
      <Section heading="Who I am">
        <p>
          I&rsquo;m <strong>Cláudio</strong>, a {yearsOld(AUTHOR_BORN, today)} year old software
          developer from Madeira Island, Portugal <Flag country="PT" />, specialised in legacy
          banking applications.
        </p>
        <p>
          In 2026 I got interested in AI vibe-coding and started a few hobby projects, this one
          included, to test how capable AI is at coding right now, how it copes as a project grows
          in scope and features, and to learn for myself how to work with AI and how modern web
          development works.
        </p>
      </Section>
      <Section heading="What is this? Is this a game?">
        <p>
          Maybe one day? Every time I show this to someone, they think I&rsquo;m developing a
          motorsport team management game. It <em>could</em> become that one day, but it&rsquo;s not
          quite there yet.
        </p>
        <p>
          For now, think of it as a game where you&rsquo;re not playing, but merely{" "}
          <strong>watching the AI teams play each other</strong>. You pick any season from
          motorsport history (from {PLAYABLE_SEASONS[0]} onwards) and watch the results play out in
          an alternate universe.
        </p>
      </Section>
      <Section heading="Right now, what can I use this for?">
        <p>
          Well, you could use it to <strong>simulate alternate realities</strong> where your
          favourite driver joined a better team at a certain point of his career. Or what if teams
          were stronger or weaker? Try out the pre-made scenarios, and/or edit the grid, and see
          what happens.
        </p>
        <p>
          You could also just leave it on default settings, and see what would happen if everything
          in the past was exactly the same as in real life, except luck fell for different teams and
          drivers in a different way.
        </p>
      </Section>
      <Section heading="How does it work?">
        <p>
          <strong>Drivers and teams have ratings</strong>, which were initially assigned with the
          help of AI and later tweaked by hand. Drivers get faster as they gain experience and
          slower as they age, until they retire. Car chassis and engines have their own numbers each
          season too. Then it all gets mashed together in a <strong>simulation engine</strong> that
          spits out qualifying and race results.
        </p>
        <p>
          For the more modern seasons, I&rsquo;ve refined the ratings extensively so results come
          very close to real life (using calibration scripts Claude generated for me), but the
          further back you go, the more mistakes you may find, as those were all initially generated
          by AI.
        </p>
        <p>
          Obviously, this is a rudimentary and entirely subjective way of representing performance:
          please don&rsquo;t get mad at me if you feel your favourite driver is undervalued. 🙂 A
          feature is planned so that anyone can edit the ratings.
        </p>
      </Section>
      <Section heading="What's next?">
        <p>
          Currently seasons play out very rigidly: even in the scenarios, drivers just move teams at
          random or without much logic.
        </p>
        <p>
          The next big feature I&rsquo;m planning is the <strong>advanced simulation mode</strong>,
          where a driver market moves drivers around according to events: a big team hiring a
          promising driver shining at a smaller team, or a big name getting fed up with lack of
          success and leaving his team.
        </p>
        <p>
          I&rsquo;d like to <strong>make this a game at some stage</strong>, where you take over a
          team and decide its fate, but I&rsquo;m struggling a bit to imagine what would make it
          fun. Management sims need A LOT of game mechanics to be interesting and engaging, and I
          simply don&rsquo;t have the time to build them all.
        </p>
        <p>
          For example, the race engine just spits out results, with no thought whatsoever to
          strategy or what happens lap by lap, and you just can&rsquo;t have a management game
          without strategy. Car development would need its own mini-games. Etc.
        </p>
        <p>
          Not sure I&rsquo;ve got the skill and time to give it the depth it would need, though I
          don&rsquo;t rule out making this a very simple game some day, where you merely hire and
          fire drivers, plus a couple of mini-games, and that&rsquo;s it.
        </p>
      </Section>
      <Section heading="How it was made">
        <p>
          Pretty much <strong>99% vibe-coded by Claude Code</strong> (mostly within the VS Code
          extension), though I touched the ratings files by hand a lot.
        </p>
        <p>
          It still took quite a bit of work, it wasn&rsquo;t a single one-shot prompt: by November
          2026, something around 800 to 1000 prompts. Lots of that went into making the UI usable on
          both desktop and mobile (and I&rsquo;m still not happy with it...)
        </p>
        <p>
          Architecture is mostly TypeScript, React, Vite, Tailwind, TanStack Router and Zustand. No
          database as of yet: all data lives in JSON files, loaded into the browser. You can check
          the codebase on my <Out href={REPOSITORY}>GitHub</Out>.
        </p>
      </Section>
      <Section heading="Credits">
        <p>
          See my <Out href={REPOSITORY}>GitHub</Out>. &copy; 2026 Cláudio Alegria, all rights
          reserved.
        </p>
        <p>
          Unofficial fan project, not connected to any championship, governing body, team or brand.
          Real names are used merely to give users a connection to motorsport history.
        </p>
        <p>
          The ratings data was checked and calibrated against real life motorsport data from{" "}
          <Out href="https://jolpi.ca">Jolpica</Out>, under{" "}
          <Out href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</Out>.
        </p>
      </Section>
    </div>
  );
}

function WhatsNew({ releases }: { releases: readonly Release[] }) {
  if (releases.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nothing yet: the first entry comes with the first release.
      </p>
    );
  }
  return (
    <div className={PROSE}>
      {releases.map((release) => (
        <Section
          key={release.date}
          heading={<time dateTime={release.date}>{releaseDate(release.date)}</time>}
        >
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {release.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
      ))}
    </div>
  );
}

/** What is known to be missing or wrong, each said once and plainly. A draft, the author's to rewrite. */
const KNOWN_ISSUES: readonly string[] = [
  "Drivers move between teams at random, or without much logic.",
  "The further back in history you go, the rougher the ratings: older seasons are mostly still AI's first drafts.",
  "Races are decided as a whole: there is no strategy, and nothing happens lap by lap.",
  "The layout on phones still needs work.",
  "Bug reports can't be sent from the app yet.",
];

function KnownIssues() {
  return (
    <div className={PROSE}>
      <ul className="flex list-disc flex-col gap-1.5 pl-5">
        {KNOWN_ISSUES.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}
