# 2026-10-10 接口回归证据索引

唯一任务：[APP-HOME-107](../../../docs/development-program/02-modules/app/home/TODO.md#app-home-107)。完整结论与提交：[总报告](../../reports/2026-10-10-interface-regression.zh-CN.md)。

- `core-api-validation.md`与`core-agent-mode-errors.md`：Core分批17去重场景；初次trace失败、测试前置误判与各自修复证据分开。
- [verification-tests.json](verification-tests.json)：提交可复核的最终测试/构建摘要及本机原始输出SHA-256。以下 `.log` 均为忽略的本机输出，不随Git发布。
- `gateway-full-final-summary.log`：最终103/0，16文件；`gateway-typecheck.log`为既有mock类型诊断，不算全部类型成功。
- `desktop-final-full.log`：最终1215通过/14跳过。`desktop-final-node.log`：最终180通过/1跳过；`desktop-dev-recovery-final.log`为启动器超时恢复的5/5定向。
- `desktop-final-targeted.log`：9文件97通过；`desktop-home-final.log`：最后读取异常捕获的43项通过。
- `desktop-final-build.log`：最后类型检查与生产构建退出0，Vite7m06s；以总报告登记的源码树为准。旧`desktop-build.log`发生在最后补丁前，仅历史结果。
- `desktop-full.log`、`desktop-final.log`与各followup/transport/typecheck日志：保留失败到修复的过程，不混成一次全绿。
- `graphseed-real/VALIDATION.md`及JSON/截图：真实Core/Gateway/安装组件400→201，重连/重启/用户哈希、失败无部分写入；脚本为上级graphseed-real-*文件。
- `workspace-real/`：真实main/preload、Core/Gateway和工作区组件；只有目录返回值、随机端点及外部启动生命周期适配。初轮创建/409原因与最终已有根补验均保留；followup记录真实编辑/已有打开、控制器创建重命名及reload通过，不把早先UI timeout当作成功。
- `../2026-10-10-host-readiness/README.zh-CN.md`：真实生产宿主状态/IPC/HMAC夹具；HTTP transport、服务生命周期和原生选择由fixture替代。

独立临时用户根和随机端口，现有用户数据保留。所有复现脚本运行时生成凭据；证据不存token、真实TOML全文或数据库。完整App/安装器、非Windows及PostgreSQL本轮未验收；浏览器attach timeout没有实际点击成功证据。
