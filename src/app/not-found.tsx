import Link from "next/link";

export default function NotFound() {
  return (
    <main className="error-page">
      <div className="error-mark">?</div>
      <p className="eyebrow">OFF THE MAP</p>
      <h1>That page isn't here yet.</h1>
      <p>Head back to your learning journey and choose another path.</p>
      <Link className="button" href="/student">Back to EDUVERSE<span aria-hidden="true">→</span></Link>
    </main>
  );
}
