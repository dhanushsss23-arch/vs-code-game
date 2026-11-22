import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing">
      <nav className="topbar" aria-label="Main navigation">
        <Link className="brand" href="/">eduverse<span>.</span></Link>
        <div className="nav-actions">
          <Link className="text-link" href="/login">Log in</Link>
          <Link className="button button-small" href="/register">Start learning</Link>
        </div>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> YOUR NEXT BIG ADVENTURE STARTS HERE</p>
          <h1>Curiosity takes<br />you <span>further.</span></h1>
          <p className="intro">Explore new worlds, solve clever challenges, and build real skills—one discovery at a time.</p>
          <div className="hero-actions">
            <Link className="button" href="/register">Create your free account <span aria-hidden="true">→</span></Link>
            <span className="language-note">Learn in English or தமிழ்</span>
          </div>
          <div className="trust-row"><span>✦</span> A new kind of learning journey</div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="planet">
            <div className="planet-ring" />
            <div className="planet-land land-one" />
            <div className="planet-land land-two" />
            <div className="planet-star">✦</div>
          </div>
          <div className="floating-card card-xp"><span className="card-icon">✧</span><span><b>Every step counts</b><small>Your progress, saved</small></span></div>
          <div className="floating-card card-language"><span className="language-icon">文</span><span><b>Two languages</b><small>உங்கள் பயணம் தொடங்கட்டும்</small></span></div>
          <div className="tiny-star star-a">✦</div><div className="tiny-star star-b">✧</div><div className="tiny-star star-c">·</div>
          <div className="art-caption">A universe of possibilities</div>
        </div>
      </section>
      <footer className="footer"><span>EDUVERSE</span><span>Made for minds that wonder.</span><span>English · தமிழ்</span></footer>
    </main>
  );
}
