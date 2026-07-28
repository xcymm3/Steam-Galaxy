# Steam Galaxy

Steam Galaxy 是一个面向公开 Steam 游戏库的交互式 3D 可视化应用。它将玩家游玩时长最高的游戏映射为可探索的星体，并结合 Steam 商店元数据提供游戏档案、类型和商店跳转。

用户可输入 SteamID、Steam 个人资料链接或自定义 ID，也可通过 Steam OpenID 登录确认身份。应用不创建账户；生成的报告只保存在当前浏览器标签页的 `sessionStorage` 中。

## 功能概览

- 支持 SteamID、个人资料 URL、自定义 ID 与 Steam OpenID 登录。
- 读取公开库存并在 Three.js 场景中绘制时长最高的 100 款游戏。
- 以累计时长映射星体体积：星体半径按时长立方根计算，因此体积与游玩时长成正比；零时长游戏保留最小可见尺寸。
- 支持旋转、缩放、点击选中、镜头聚焦，以及按累计时长范围筛选星图。
- 支持按游戏名或 AppID 搜索；搜索不会过滤星图，而是聚焦第一个匹配的星体。
- 点击星体后展示游戏档案，包括商店宣传图、累计时长、游戏类型与 Steam 商店链接。
- 从 Steam 商店宣传图提取色板，为对应星体提供主题色；其余商店元数据按需加载。
- 为私密库存、无效 ID、Steam 服务异常和不支持 WebGL 的环境提供独立的降级反馈。

## 技术栈

| 范畴       | 技术                                     |
| ---------- | ---------------------------------------- |
| 应用框架   | Next.js 16 App Router、React 19          |
| 开发语言   | TypeScript（严格模式）                   |
| 3D 渲染    | Three.js、OrbitControls                  |
| 数据校验   | Zod                                      |
| 测试与质量 | Vitest、ESLint、Prettier、GitHub Actions |
| 运行时     | Node.js 22、pnpm 11                      |

## 架构概要

浏览器仅访问本站 API；Steam Web API Key 始终保留在服务端。Steam OpenID 仅用于校验 SteamID，不存储账户或凭据。

| 层级                  | 职责                                       |
| --------------------- | ------------------------------------------ |
| `app/`                | Next.js 页面、路由与 API Route Handlers    |
| `components/landing/` | SteamID 输入、身份确认与状态反馈           |
| `components/report/`  | 星系工作台、Three.js 场景与游戏档案面板    |
| `lib/steam/`          | Steam Web API、OpenID 验证、商店元数据网关 |
| `lib/report/`         | 游戏库标准化、统计计算与纯函数星系模型     |
| `tests/`              | 单元测试与匿名 Steam 数据 fixtures         |

主要服务端接口：

| 接口                           | 用途                             |
| ------------------------------ | -------------------------------- |
| `POST /api/steam/report`       | 解析玩家身份并获取公开游戏库报告 |
| `GET /api/steam/store/[appId]` | 按需读取单个游戏的公开商店元数据 |
| `GET /api/auth/steam/start`    | 发起 Steam OpenID 登录           |
| `GET /api/auth/steam/callback` | 校验 OpenID 回调并返回应用       |

## 本地开发

### 前置条件

- Node.js `>=22.17.0 <23`
- pnpm `11.9.0`
- 一个 Steam Web API Key

### 安装与启动

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)。在 `.env.local` 中配置 `STEAM_WEB_API_KEY` 后，即可读取公开 Steam 库。

## 环境变量

```dotenv
# 必填。仅服务端使用，禁止添加 NEXT_PUBLIC_ 前缀。
STEAM_WEB_API_KEY=

# 生产环境必填，例如 https://steam-galaxy.example.com。
# 用于生成 Steam OpenID 的 realm 和回调地址。
APP_ORIGIN=

# 可选。Steam 商店元数据的地区和语言，默认 cn / schinese。
STEAM_STORE_COUNTRY_CODE=cn
STEAM_STORE_LANGUAGE=schinese
```

本地开发可不设置 `APP_ORIGIN`，应用会根据当前请求推导地址。生产部署应将其设为外部可访问的 HTTPS 站点根地址，且不要包含路径或尾部斜杠。所有敏感变量应在部署平台的环境变量管理中配置，不应提交到仓库。

## 质量检查

```powershell
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build

# 依次执行全部检查
pnpm check
```

GitHub Actions 会在推送到 `main` 分支和 Pull Request 时运行 `pnpm check`。

## 部署

该项目可部署至支持 Node.js 22 的服务平台，例如 Render。

| 配置项        | 建议值                                         |
| ------------- | ---------------------------------------------- |
| Build Command | `pnpm install --frozen-lockfile && pnpm build` |
| Start Command | `pnpm start`                                   |
| Node.js       | 22.x                                           |
| 必填环境变量  | `STEAM_WEB_API_KEY`、`APP_ORIGIN`              |

部署后，将 `APP_ORIGIN` 配置为实际公开域名，例如 `https://your-service.onrender.com`；该值必须与 Steam OpenID 回调时使用的域名一致。

## 许可证

本仓库当前未声明开源许可证。使用、分发或二次开发前请先联系仓库维护者。
