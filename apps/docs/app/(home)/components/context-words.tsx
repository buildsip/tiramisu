import { words, tones } from "../context-content";
import { SectionLabel } from "./section-label";

/** Show the chosen context types before the supported agents and languages. */
export function ContextWords() {
  return (
    <section
      id="context"
      aria-labelledby="context-title"
      className="mx-auto max-w-7xl scroll-mt-24 px-5 pt-12 pb-16 text-center sm:px-8 sm:pt-16 sm:pb-20"
    >
      <SectionLabel id="context-title">Useful memories</SectionLabel>
      <ul
        aria-label="What you can remember"
        className="flex flex-wrap justify-center gap-x-6 gap-y-3 font-pixel text-2xl leading-tight sm:gap-x-8 sm:text-4xl"
      >
        {words.map((word) => (
          <li key={word.text} className={tones[word.tone]}>
            {word.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
