import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { AdminConsole } from "@/components/admin-console";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.roles.includes("ADMIN")) redirect("/student");

  const questions = await prisma.question.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      difficulty: true,
      points: true,
      topic: { select: { name: true, subject: { select: { name: true } } } },
      translations: { select: { locale: true, prompt: true } },
    },
  });

  return (
    <main className="console-page">
      <header className="topbar app-topbar">
        <Link className="brand" href="/">eduverse<span>.</span></Link>
        <nav className="app-nav" aria-label="Admin navigation">
          <Link href="/student">Student view</Link><Link href="/teacher">Teacher tools</Link>
          <LanguageToggle locale={user.preferredLocale} />
          <ThemeToggle label="Toggle color theme" /><LogoutButton />
        </nav>
      </header>
      <section className="console-heading"><p className="eyebrow"><span className="eyebrow-dot" /> ADMINISTRATION</p><h1>Shape the learning worlds.</h1><p>Manage the topic catalog, grant teacher access, and review bilingual questions before publication.</p></section>
      <AdminConsole initialQuestions={questions} />
    </main>
  );
}
