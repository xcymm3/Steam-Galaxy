# WHERE DID THE HOURS GO?

一座面向中文 Steam 玩家的互动游戏星系。

用户可以输入 SteamID、个人资料链接或自定义 ID，也可以通过 Steam OpenID 确认 SteamID。网站读取玩家当前公开的游戏资料，将整个游戏库存展开为一座可缩放、拖动和点选的 3D 星系。

## 当前状态

**当前版本：单页游戏星系工作台已完成。** 当前仓库包含 Steam 身份解析、官方 API 客户端、Steam 商店元数据补全、响应校验、数据标准化、纯函数星系模型、Three.js 互动星系、无账户的 Steam 登录链路，以及完整的前端错误与降级反馈。

时长最高的 100 款游戏会以可点击的独立天体出现，其余库存收束为长尾档案信号，因此完整游戏库仍被表达而不会拖垮移动端渲染。星体体积严格按累计时长映射：1000 小时对应 100 小时的 10 倍体积。可用游戏名或 AppID 搜索，并按点亮状态与累计时长筛选这些独立星体；拖动、缩放、点击或通过原生键盘星体列表均可展开名称、封面、时长和本地缓存的商店元数据。商店数据按需请求，失败时仍保留基础信息与可重试入口。报告只保存在当前标签页的 `sessionStorage`。Steam 登录使用一次性状态 Cookie 与 Steam 侧 `check_authentication` 校验；已验证的 SteamID 只通过两分钟 HttpOnly Cookie 进入已有报告接口，随后立即清除。

## 技术基线

- Node.js 22.23.1
- pnpm 11.9.0
- Next.js 16 App Router
- React 19
- TypeScript 严格模式
- ESLint、Prettier、Vitest 与 GitHub Actions

## 本地启动

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

然后访问 [http://localhost:3000](http://localhost:3000)。在首页输入 SteamID、自定义 ID 或个人资料链接，读取成功后点击“打开游戏星系”。报告仅写入当前标签页的 `sessionStorage`，不会发送到额外的数据存储；真实请求需要在 `.env.local` 配置 Steam Web API Key。

## 质量命令

```powershell
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

`pnpm check` 与 CI 使用同一套完整质量门禁。

## 环境变量

`.env.example` 定义服务端环境变量契约：

```dotenv
STEAM_WEB_API_KEY=
APP_ORIGIN=https://report.example
STEAM_STORE_COUNTRY_CODE=cn
STEAM_STORE_LANGUAGE=schinese
```

真实值只写入本地 `.env.local` 或部署平台的安全环境变量，禁止使用 `NEXT_PUBLIC_` 前缀，也不得提交到 Git。生产环境必须设置 `APP_ORIGIN` 为实际 HTTPS 首页地址，以固定 OpenID 的 `realm` 与回调地址；本机 `http://localhost` 开发可自动推导。`STEAM_STORE_COUNTRY_CODE` 与 `STEAM_STORE_LANGUAGE` 是可选项，用于星体详情的商店元数据本地化，默认分别为 `cn` 与 `schinese`。

## 已确定的产品边界

- 技术方向：TypeScript、React、Next.js App Router
- 使用语言：简体中文
- 核心终端：移动端 Web，同时兼容桌面端
- 报告范围：玩家当前可见数据形成的“完整生涯快照”
- 产品形式：一个可持续探索的互动游戏星系工作台
- 核心视觉：Three.js 互动星系，前 100 款游戏为独立天体，长尾为聚合档案信号
- 交互方式：缩放、拖动、点击或原生键盘星体列表聚焦，按需展开详情
- 数据策略：无数据库，不长期保存玩家报告
- 身份入口：SteamID 输入与 Steam OpenID 登录
- MVP 称号：只根据可验证的库存和累计时长指标生成

## 文档索引

- [系统架构](docs/architecture.md)
- [报告规格](docs/report-spec.md)
- [实施路线图](docs/roadmap.md)
- [ADR-0001：采用无数据库运行时](docs/decisions/0001-stateless-runtime.md)
- [ADR-0002：限定 Steam 数据叙事边界](docs/decisions/0002-steam-data-boundary.md)

## 核心原则

1. **不伪造历史。** 不把累计时长包装成逐年游玩时间线。
2. **星体只表达可验证数据。** 体积、轨道、明暗和档案状态都来自确定的游戏库字段。
3. **所有称号可解释。** 每个结论都能追溯到明确、可测试的计算规则。
4. **默认不留存。** SteamID、游戏库和生成结果不写入服务端数据库。
5. **移动端优先。** 触控、视口、安全区和性能优先于桌面装饰。
6. **失败也要说人话。** 私密库存、无效 ID 和 Steam 服务异常必须有不同提示。

## 当前目录边界

```text
app/          Next.js 路由、布局与应用级样式
components/   可复用 React 组件
lib/          Steam 网关与纯业务模块
styles/       样式边界说明
tests/        单元测试、匿名 fixtures 与端到端测试
tokens.css    颜色、字体、间距与动效令牌
```

浏览器端不得直接调用 Steam Web API 或 Steam 商店接口；`/api/steam/report` 与按需读取公开 AppID 元数据的 `/api/steam/store/[appId]` 是同源服务端边界。
