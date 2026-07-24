# Library boundary

Steam 网关、标准化与报告分析等非 UI 模块放在此目录。业务模块不得依赖 React 组件。

当前 `steam/` 包含 Phase 2A 数据内核：

- `resolve-id.ts`：识别 SteamID64、自定义 ID 与受支持的个人资料 URL。
- `client.ts`：只访问硬编码 Steam Web API 主机的超时客户端。
- `schemas.ts`：第三方响应的 Zod 契约。
- `normalizers.ts`：玩家与游戏数据标准化。
- `get-snapshot.ts`：把身份解析、并行读取与隐私状态判断编排为稳定快照。
- `errors.ts`、`types.ts`：内部错误码与项目数据模型。
- `openid.ts`：固定 Steam OpenID 请求、一次性状态校验、断言二次验证与 SteamID 提取。
- `get-report.ts`：由已验证 SteamID 或手动输入共用的服务器端报告生成入口。

当前 `report/` 包含 Phase 3 纯函数分析引擎：

- `metrics.ts`：确定性排序、游戏分组、累计指标、集中度和 Steam 年龄。
- `titles.ts`：条件与文案分离的称号优先级规则。
- `analyze.ts`：把 `SteamSnapshot` 转换为唯一 `ReportData`。
- `types.ts`：`OwnedGame`、`ReportMetrics`、`PlayerTitle` 与 `ReportData` 契约。
- `galaxy.ts`：不依赖 React 的确定性星系模型、前 100 个独立天体与长尾聚合。
- `galaxy-scene.ts`：星系轨道、镜头焦点与批量渲染场景数据。
