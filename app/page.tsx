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
            <div className="heroMeta">
              <p>
                声明：本项目为个人开源项目，非 Steam
                官方，用户所有数据仅留在当前浏览器会话，不会以任何形式保存。
              </p>
              <a
                href="https://github.com/xcymm3/Steam-Galaxy"
                target="_blank"
                rel="noreferrer"
              >
                GitHub · xcymm3/Steam-Galaxy
              </a>
            </div>
          </div>
          <SteamReportConsole authStatus={getAuthStatus(auth)} />
        </section>
      </main>
    </div>
  );
}
