import { SteamReportConsole } from "@/components/landing/steam-report-console";

interface HomePageProps {
  searchParams: Promise<{ auth?: string }>;
}

function getAuthStatus(value: string | undefined) {
  return value === "success" ||
    value === "cancelled" ||
    value === "configuration" ||
    value === "expired" ||
    value === "failed" ||
    value === "timeout"
    ? value
    : undefined;
}

export default async function Home({ searchParams }: HomePageProps) {
  const { auth } = await searchParams;

  return (
    <div className="landingPage">
      <main id="top" className="pageShell">
        <section className="hero" aria-labelledby="page-title">
          <div className="heroCopy">
            <p className="eyebrow">Steam game galaxy</p>
            <h1 id="page-title">你的 Steam 游戏星系。</h1>
          </div>
          <SteamReportConsole authStatus={getAuthStatus(auth)} />
        </section>
      </main>
    </div>
  );
}
