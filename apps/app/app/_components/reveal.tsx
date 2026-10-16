import { Suspense, ViewTransition } from "react";

// Suspense whose skeleton slides away as the content slides in, instead of a hard swap.
export function Reveal({ fallback, children }: { fallback: React.ReactNode; children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <ViewTransition exit="slide-down" default="none">
          <div>{fallback}</div>
        </ViewTransition>
      }
    >
      <ViewTransition enter="slide-up" default="none">
        <div>{children}</div>
      </ViewTransition>
    </Suspense>
  );
}
