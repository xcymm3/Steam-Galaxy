# WHERE DID THE HOURS GO?

一份面向中文 Steam 玩家的可分享游戏生涯报告。

用户可以输入 SteamID、个人资料链接或自定义 ID，也可以通过 Steam OpenID 确认 SteamID。网站读取玩家当前公开的游戏资料，将累计游玩数据组织成 10 个全屏故事页面，最后在浏览器本地生成一张带网站首页二维码的总结海报。

## 当前状态

**当前版本：互动星系与玩法画像已完成。** 当前仓库包含 Steam 身份解析、官方 API 客户端、Steam 商店元数据补全、响应校验、数据标准化、纯函数报告分析、十页移动端报告播放器、Three.js 互动星系、浏览器端 PNG 海报生成器、无账户的 Steam 登录链路，以及完整的前端错误与降级反馈。

播放器支持按钮、方向键和横向滑动翻页，包含进度、焦点管理、`sessionStorage` 标签页恢复、头像失败降级、安全区和减少动态效果。无效 ID、私密库存、空库存与 Steam 超时均会显示不同的可恢复操作；头像和海报外部图片失败时继续使用文字或首字降级，超长中文昵称在报告和海报中都会换行或省略而不会撑破布局。第 5 页以时长最高的 10 款游戏为样本，通过 Steam 商店逐 AppID 补全游戏类型与单人/多人/合作模式；商店异常时报告会明确标注未补全而不阻塞基础报告。第 6 页使用 Three.js 互动星系：前 10 款高时长游戏映射为太阳、八大行星与冥王星，星球体积严格与游玩时长成正比，并支持缩放、拖动和点击查看。Steam 登录使用一次性状态 Cookie 与 Steam 侧 `check_authentication` 校验；已验证的 SteamID 只通过两分钟 HttpOnly Cookie 进入已有报告接口，随后立即清除。

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

然后访问 [http://localhost:3000](http://localhost:3000)。在首页输入 SteamID、自定义 ID 或个人资料链接，读取成功后点击“进入十页报告”。报告仅写入当前标签页的 `sessionStorage`，不会发送到额外的数据存储；真实请求需要在 `.env.local` 配置 Steam Web API Key。

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

真实值只写入本地 `.env.local` 或部署平台的安全环境变量，禁止使用 `NEXT_PUBLIC_` 前缀，也不得提交到 Git。生产环境必须设置 `APP_ORIGIN` 为实际 HTTPS 首页地址，以固定 OpenID 的 `realm` 与回调地址；本机 `http://localhost` 开发可自动推导。`STEAM_STORE_COUNTRY_CODE` 与 `STEAM_STORE_LANGUAGE` 是可选项，用于第 5 页玩法画像的商店元数据本地化，默认分别为 `cn` 与 `schinese`。

## 已确定的产品边界

- 技术方向：TypeScript、React、Next.js App Router
- 使用语言：简体中文
- 核心终端：移动端 Web，同时兼容桌面端
- 报告范围：玩家当前可见数据形成的“完整生涯快照”
- 报告形式：10 个手动翻页的全屏故事页面
- 核心视觉：Three.js 互动太阳系，星球体积按累计游玩时长映射
- 分享形式：一张 1080 × 1440 PNG 总结海报
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
2. **一页一个结论。** 报告不是仪表盘，而是两分钟内完成的故事播放器。
3. **所有称号可解释。** 每个结论都能追溯到明确、可测试的计算规则。
4. **默认不留存。** SteamID、游戏库和生成结果不写入服务端数据库。
5. **移动端优先。** 触控、视口、安全区、性能和海报分享优先于桌面装饰。
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

浏览器端不得直接调用 Steam Web API 或 Steam 商店接口；`/api/steam/report` 是唯一的数据服务端边界，首页只调用该同源接口。
