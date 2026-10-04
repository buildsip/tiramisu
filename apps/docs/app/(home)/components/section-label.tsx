import type { ReactNode } from "react";

/** Keep the memory and stack labels consistent in size, color, and spacing. */
export function SectionLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="mb-6 text-center font-sans text-sm font-medium tracking-widest text-neutral-400 uppercase"
    >
      {children}
    </h2>
  );
}
