// LobeHub assembles its icon variants in client code.
"use client";

import Image from "next/image";
import {
  Antigravity,
  ClaudeCode,
  Codex,
  Cursor,
  GeminiCLI,
  GithubCopilot,
  OpenCode,
} from "@lobehub/icons";
import { cn } from "@/lib/cn";
import { SectionLabel } from "./section-label";

// Use each agent's own mark; the default variants inherit the row's text color.
const agents = [
  { name: "Claude Code", icon: ClaudeCode },
  { name: "Codex", icon: Codex },
  { name: "Cursor", icon: Cursor },
  { name: "Gemini CLI", icon: GeminiCLI },
  { name: "OpenCode", icon: OpenCode },
  { name: "Antigravity", icon: Antigravity },
  { name: "GitHub Copilot", icon: GithubCopilot },
];

const languages = [
  "TypeScript",
  "Python",
  "Go",
  "Rust",
  "JavaScript",
  "Java",
  "Ruby",
  "PHP",
  "Swift",
];

const marquee =
  "overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] motion-reduce:overflow-x-auto motion-reduce:[mask-image:none]";
const group =
  "flex flex-none items-center gap-16 px-8 py-3.5 max-sm:gap-10 max-sm:px-5 motion-reduce:aria-hidden:hidden";
const logo =
  "flex items-center gap-2.5 text-xl font-medium tracking-tight whitespace-nowrap text-neutral-300 max-sm:text-lg max-sm:[&>img]:size-6 max-sm:[&>svg]:size-6";

/** Duplicate each row for a seamless loop; hide the visual duplicates from screen readers. */
export function LogoMarquees() {
  return (
    <section
      className="mx-auto max-w-7xl pt-9 pb-11 max-xl:mx-8 max-sm:mx-5 max-sm:py-6"
      aria-label="Supported agents and languages"
    >
      <SectionLabel>Works with your stack</SectionLabel>
      <div className={marquee}>
        <div className="animate-scroll-logos flex w-max [animation-direction:reverse] [animation-duration:44s] motion-reduce:animate-none">
          {[0, 1].map((copy) => (
            <ul
              key={copy}
              className={group}
              aria-label={copy === 0 ? "Supported agents" : undefined}
              aria-hidden={copy === 1}
            >
              {agents.map((agent) => (
                <li key={agent.name} className={logo}>
                  <agent.icon size={27} className="opacity-80" aria-hidden />
                  <span>{agent.name}</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
      <div className={cn(marquee, "mt-4 max-sm:mt-2")}>
        <div className="animate-scroll-logos flex w-max motion-reduce:animate-none">
          {[0, 1].map((copy) => (
            <ul
              key={copy}
              className={group}
              aria-label={copy === 0 ? "Supported languages" : undefined}
              aria-hidden={copy === 1}
            >
              {languages.map((name) => (
                <li
                  key={name}
                  className={cn(
                    logo,
                    "text-base font-normal tracking-tight text-neutral-500 max-sm:text-sm",
                  )}
                >
                  <Image
                    className={cn(
                      "object-contain opacity-70",
                      name === "Rust" ? "invert" : "brightness-180 grayscale",
                    )}
                    src={`/logos/${name.toLowerCase()}.svg`}
                    alt=""
                    width={25}
                    height={25}
                  />
                  <span>{name}</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
