# ADR-0002：限定 Steam 数据叙事边界

- 状态：Accepted
- 日期：2026-07-21

## 背景

产品最初设想包含逐年口味变化、夜间游玩、购买与游玩落差、好友共同游戏时期等叙事。但 Steam 面向此类网站的公开接口主要提供当前可见的玩家资料、游戏库和累计游玩信息，不能完整还原历史游玩时间线或购买动机。

Steam OpenID 能确认用户的 SteamID，但不应被描述成授予私密游戏库访问权。

## 决策

MVP 只陈述能够由当前公开数据直接支持或明确计算的结论。

允许使用：

- 当前公开的玩家昵称和头像。
- 当前可见的游戏库。
- 每款游戏的累计游玩分钟。
- 由累计时长计算出的排名、占比和集中度。
- 0 小时与低于明确阈值的游戏数量。
- 可选的账号创建时间。

禁止使用：

- 逐年或逐月游玩时间线。
- 夜间游玩次数或“最多夜晚”。
- 购买时间、购买价格和购买动机。
- 从 FPS 转向 RPG 等历史类型变化。
- 好友共同游戏时期。
- 把 Steam 登录描述成隐私授权。
- 把缺失的私密游戏当作未拥有。

## 游戏类型数据

MVP 不实现“FPS 狂魔”等类型称号。

原因：官方商店应用列表不提供足够的类型信息；依赖未正式承诺的数据源会增加大量请求、延迟和降级分支。基础称号系统改用累计时长、集中度和库存规模。

如果未来实验类型称号：

- 只丰富 Top 20 游戏。
- 静态 AppID 元数据可以缓存，但不得与玩家报告绑定保存。
- 类型接口失败时必须回退到基础称号。
- 页面需区分“Steam 数据”和“外部元数据推断”。

## 私密库存

当游戏详情不可见时：

1. 不生成有限版或猜测版报告。
2. 告知用户需要公开 Steam 的游戏详情。
3. 链接到 Steam 官方隐私设置说明。
4. 提醒单独标记为私密的游戏仍不会进入报告。
5. 提供“我已修改，重新检测”动作。

参考资料：

- Steam IPlayerService：<https://partner.steamgames.com/doc/webapi/IPlayerService?language=english>
- Steam OpenID：<https://partner.steamgames.com/doc/features/auth?l=english>
- Steam Store Service：<https://partner.steamgames.com/doc/webapi/IStoreService>
- Steam Profile Privacy：<https://help.steampowered.com/en/faqs/view/588C-C67D-0251-C276>
- Steam Private Games：<https://help.steampowered.com/en/faqs/view/1150-C06F-4D62-4966>

## 结果

优点：

- 报告中的每句话都能解释和测试。
- 不会因为漂亮叙事而制造错误历史。
- Steam 接口变化时降级路径更清晰。
- 基础分析只需要少量请求。

代价：

- 报告无法表达真实的时间演化。
- 称号在 MVP 中缺少类型维度。
- 私密库存用户必须修改 Steam 设置后才能生成报告。

## 未来重新评估条件

- Steam 官方提供可靠的历史游玩或类型接口。
- 用户主动上传经过明确授权的数据导出。
- 项目加入本地采集器，并重新完成隐私与安全评审。
