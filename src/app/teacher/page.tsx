import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { TeacherConsole } from "@/components/teacher-console";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";

export default async function TeacherPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.roles.includes("TEACHER") && !user.roles.includes("ADMIN")) redirect("/student");

  return (
    <main className="console-page">
      <header className="topbar app-topbar">
        <Link className="brand" href="/">eduverse<span>.</span></Link>
        <nav className="app-nav" aria-label="Teacher navigation">
          <Link href="/student">Student view</Link>
          {user.roles.includes("ADMIN") && <Link href="/admin">Admin</Link>}
          <LanguageToggle locale={user.preferredLocale} />
          <ThemeToggle label="Toggle color theme" />
          <LogoutButton />
        </nav>
      </header>
      <section className="console-heading"><p className="eyebrow"><span className="eyebrow-dot" /> TEACHER WORKSPACE</p><h1>Build the next big question.</h1><p>Create bilingual learning content. Questions from teachers go to an administrator for review before students can play.</p></section>
      <TeacherConsole isAdmin={user.roles.includes("ADMIN")} />
    </main>
  );
}
