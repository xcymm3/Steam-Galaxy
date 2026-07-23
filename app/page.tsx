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
    <>
      <header className="siteHeader">
        <nav className="siteNav" aria-label="主导航">
          <a className="brand" href="#top" aria-label="WHERE DID THE HOURS GO?">
            <span className="brandLong">WHERE DID THE HOURS GO?</span>
            <span className="brandShort" aria-hidden="true">
              HOURS?
            </span>
          </a>
          <span className="phaseTag">PHASE 08</span>
        </nav>
      </header>

      <main id="top" className="pageShell">
        <section className="hero" aria-labelledby="page-title">
          <div className="heroCopy">
            <p className="eyebrow">Steam lifetime report</p>
            <h1 id="page-title">看看时间都去了哪里。</h1>
            <p className="lead">
              输入 SteamID，或通过 Steam
              登录确认身份。我们只读取当前公开资料与游戏详情，
              并将它们整理成一份可浏览、可分享的游戏生涯报告。
            </p>
            <ul className="trustList" aria-label="数据处理说明">
              <li>API Key 只存在于服务端</li>
              <li>OpenID 只确认 SteamID，不创建账户</li>
              <li>私密库存与空库存分别提示</li>
            </ul>
          </div>
          <SteamReportConsole authStatus={getAuthStatus(auth)} />
        </section>

        <footer id="principles" className="siteFooter">
          <span>不伪造历史 · 默认不留存 · 移动端优先</span>
          <span className="footerRule" aria-hidden="true" />
          <span>DATA CHECKPOINT / 08</span>
        </footer>
      </main>
    </>
  );
}
