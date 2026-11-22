"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="error-page">
      <div className="error-mark">!</div>
      <p className="eyebrow">A LITTLE DETOUR</p>
      <h1>We couldn&apos;t load this page.</h1>
      <p>Your progress is saved. Try again in a moment.</p>
      <button className="button" onClick={() => reset()} type="button">Try again<span aria-hidden="true">→</span></button>
    </main>
  );
}
