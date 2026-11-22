import { redirect } from "next/navigation";
import Link from "next/link";
import { Locale, QuestionStatus } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";
import { QuizStart } from "@/components/quiz-start";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { LeaderboardPanel } from "@/components/leaderboard-panel";
import { prisma } from "@/lib/prisma";

const copy = {
  EN: {
    welcome: "Ready for your next discovery?", dashboard: "Your learning journey",
    xp: "EXPERIENCE", level: "LEVEL", streak: "DAY STREAK", coins: "COINS",
    subjects: "Choose your next step", topics: "Topics", noTopics: "No published lessons yet. Your teacher will add learning adventures here.",
    recent: "Recent sessions", noSessions: "Your completed quizzes will appear here.",     transactions: "Coin history", mastery: "Your progress", answered: "answered",
    score: "Score", profile: "Profile", teacher: "Teacher space", admin: "Admin",
    due: "Published questions", theme: "Theme",
  },
  TA: {
    welcome: "அடுத்த கண்டுபிடிப்புக்குத் தயாரா?", dashboard: "உங்கள் கற்றல் பயணம்",
    xp: "அனுபவம்", level: "நிலை", streak: "தொடர் நாட்கள்", coins: "நாணயங்கள்",
    subjects: "அடுத்த படியைத் தேர்ந்தெடுக்கவும்", topics: "தலைப்புகள்", noTopics: "வெளியிடப்பட்ட பாடங்கள் இன்னும் இல்லை. ஆசிரியர் பாடங்களைச் சேர்த்ததும் இங்கே காணலாம்.",
    recent: "சமீபத்திய அமர்வுகள்", noSessions: "நீங்கள் முடித்த வினாடி வினாக்கள் இங்கே தோன்றும்.",     transactions: "நாணய வரலாறு", mastery: "உங்கள் முன்னேற்றம்", answered: "பதிலளித்தவை",
    score: "மதிப்பெண்", profile: "சுயவிவரம்", teacher: "ஆசிரியர் பகுதி", admin: "நிர்வாகம்",
    due: "வெளியிடப்பட்ட கேள்விகள்", theme: "தோற்றம்",
  },
};

export default async function StudentPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.roles.includes("STUDENT")) redirect("/teacher");

  const locale = user.preferredLocale;
  const text = copy[locale];
  const [student, topics] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { userId: user.id },
      include: {
        wallet: {
          include: {
            transactions: {
              orderBy: { createdAt: "desc" },
              take: 6,
              select: { id: true, type: true, amount: true, balanceAfter: true, createdAt: true },
            },
          },
        },
        quizSessions: {
          orderBy: { startedAt: "desc" },
          take: 5,
          select: {
            id: true,
            status: true,
            score: true,
            startedAt: true,
            _count: { select: { questions: true } },
          },
        },
        progress: {
          orderBy: { updatedAt: "desc" },
          take: 8,
          select: {
            id: true,
            mastery: true,
            questionsAnswered: true,
            correctAnswers: true,
            topic: { select: { name: true, subject: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.topic.findMany({
      where: {
        subject: { active: true },
        questions: { some: { status: QuestionStatus.PUBLISHED } },
      },
      orderBy: [{ subject: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      select: {
        id: true,
        name: true,
        subject: { select: { name: true } },
        _count: { select: { questions: { where: { status: QuestionStatus.PUBLISHED } } } },
      },
    }),
  ]);
  if (!student) redirect("/login");

  const groupedTopics = topics.reduce<Record<string, typeof topics>>((groups, topic) => {
    (groups[topic.subject.name] ??= []).push(topic);
    return groups;
  }, {});

  return (
    <main className="student-page">
      <header className="topbar app-topbar">
        <Link className="brand" href="/">eduverse<span>.</span></Link>
        <nav className="app-nav" aria-label="Student navigation">
          {user.roles.includes("TEACHER") && <Link href="/teacher">{text.teacher}</Link>}
          {user.roles.includes("ADMIN") && <Link href="/admin">{text.admin}</Link>}
          <LanguageToggle locale={locale} />
          <ThemeToggle label={text.theme} />
          <LogoutButton />
        </nav>
      </header>
      <section className="dashboard-welcome">
        <div><p className="eyebrow"><span className="eyebrow-dot" /> {text.dashboard}</p><h1>{text.welcome}</h1><p>{user.displayName}</p></div>
        <div className="avatar-orb" aria-hidden="true">✦</div>
      </section>
      <section className="stat-grid" aria-label={text.dashboard}>
        <article className="stat-card stat-xp"><span>{text.xp}</span><strong>{student.xp.toLocaleString(locale === "TA" ? "ta-IN" : "en-US")}</strong><small>✧ {text.level} {student.level}</small></article>
        <article className="stat-card stat-streak"><span>{text.streak}</span><strong>{student.currentStreak}</strong><small>Best: {student.longestStreak}</small></article>
        <article className="stat-card stat-coins"><span>{text.coins}</span><strong>{student.wallet?.balance ?? 0}</strong><small>Earned by learning</small></article>
      </section>
      {student.progress.length > 0 && <section className="progress-section">
        <div className="section-heading"><div><p className="eyebrow">{text.mastery}</p><h2>{locale === "TA" ? "தலைப்பு வாரியான முன்னேற்றம்" : "Growing skill by skill"}</h2></div></div>
        <div className="progress-grid">{student.progress.map((item) => <article className="progress-card" key={item.id}>
          <div className="progress-card-heading"><span>{item.topic.subject.name} · {item.topic.name}</span><b>{Math.round(item.mastery * 100)}%</b></div>
          <div className="progress-track"><span style={{ width: `${Math.min(100, Math.max(0, item.mastery * 100))}%` }} /></div>
          <small>{item.correctAnswers} / {item.questionsAnswered} {text.answered}</small>
        </article>)}</div>
      </section>}
      <section className="learning-section">
        <div className="section-heading"><div><p className="eyebrow">{text.subjects}</p><h2>{text.topics}</h2></div></div>
        {Object.keys(groupedTopics).length === 0 ? (
          <div className="empty-panel"><span className="empty-icon">✦</span><h3>{locale === "TA" ? "புதிய உலகங்கள் விரைவில்" : "New worlds are on their way"}</h3><p>{text.noTopics}</p></div>
        ) : Object.entries(groupedTopics).map(([subject, subjectTopics], subjectIndex) => (
          <div className="subject-group" key={subject}>
            <h3 className="subject-title"><span className={`subject-symbol subject-${subjectIndex % 4}`}>{["✧", "◈", "⌘", "✦"][subjectIndex % 4]}</span>{subject}</h3>
            <div className="topic-grid">
              {subjectTopics.map((topic, topicIndex) => (
                <article className="topic-card" key={topic.id}>
                  <div className="topic-card-top"><span className={`topic-mark topic-mark-${topicIndex % 4}`}>{["01", "02", "03", "04"][topicIndex % 4]}</span><span className="question-count">{topic._count.questions} {text.due}</span></div>
                  <h4>{topic.name}</h4>
                  <QuizStart topicId={topic.id} locale={locale} />
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section className="recent-section">
        <div className="section-heading"><div><p className="eyebrow">{text.recent}</p><h2>{locale === "TA" ? "உங்கள் முன்னேற்றம்" : "Keep your momentum"}</h2></div></div>
        {student.quizSessions.length === 0 ? <div className="empty-panel recent-empty"><p>{text.noSessions}</p></div> : (
          <div className="session-list">
            {student.quizSessions.map((session) => <article className="session-row" key={session.id}>
              <span className="session-icon">✧</span><span className="session-description">{session.status === "COMPLETED" ? (locale === "TA" ? "முடிக்கப்பட்ட வினாடி வினா" : "Completed quiz") : (locale === "TA" ? "தொடராத அமர்வு" : "Unfinished session")}<small>{new Date(session.startedAt).toLocaleDateString(locale === "TA" ? "ta-IN" : "en-US")}</small></span>
              {session.status === "IN_PROGRESS" ? <Link className="resume-link" href={`/quiz/${session.id}`}>{locale === "TA" ? "தொடர்க" : "Resume"} →</Link> : <strong>{session.score} {text.score}</strong>}
            </article>)}
          </div>
        )}
      </section>
      <section className="recent-section">
        <div className="section-heading"><div><p className="eyebrow">{text.transactions}</p><h2>{locale === "TA" ? "உங்கள் நாணயங்கள்" : "Coins you've earned"}</h2></div></div>
        {!student.wallet?.transactions.length ? <div className="empty-panel recent-empty"><p>{locale === "TA" ? "சரியான பதில்களுக்கு நாணயங்களைப் பெறுங்கள்." : "Answer questions correctly to start earning coins."}</p></div> : (
          <div className="session-list">
            {student.wallet.transactions.map((transaction) => <article className="session-row" key={transaction.id}>
              <span className="session-icon coin-icon">◈</span>
              <span className="session-description">{locale === "TA" ? "வினாடி வினா வெகுமதி" : transaction.type.replaceAll("_", " ").toLowerCase()}<small>{new Date(transaction.createdAt).toLocaleDateString(locale === "TA" ? "ta-IN" : "en-US")}</small></span>
              <strong>+{transaction.amount} · {transaction.balanceAfter}</strong>
            </article>)}
          </div>
        )}
      </section>
      <LeaderboardPanel locale={locale} />
      <footer className="dashboard-footer">EDUVERSE · Learn a little. Grow a lot.</footer>
    </main>
  );
}
