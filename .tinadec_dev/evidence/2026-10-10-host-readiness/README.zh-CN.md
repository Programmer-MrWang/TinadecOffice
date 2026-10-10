# 宿主连接恢复专项验收（2026-10-10）

关联本轮应用接口回归修复。原始结果：`host-readiness.json`；程序：`host-readiness.probe.cjs`。最终生产 `electron/main.cjs`、`preload.cjs` 与宿主状态机经过 Windows Electron 43.3.0 隔离执行。

## 验收范围

- 初次服务断连后有限退避重试并恢复 ready。
- 周期验证失败撤销业务授权，重新验证成功后恢复。
- 服务身份证明错误保持 rejected；显式重试可以重新开始验证。
- 使用真实 preload 事件订阅、IPC、WebFrameMain 和 HMAC 角色/nonce校验。
- 主页面通过验证后可调用目录选择；iframe不能读取状态或重试宿主。
- 固定可信主frame在 ready/撤权/恢复期间的私有头授权判定正确。
- renderer没有私有token；测试使用独立临时用户根，不监听产品端口48730/48731。

## 明确边界

服务生命周期、身份HTTP传输和原生目录对话框返回值由夹具替代。实际生产 main/preload、状态机、身份HMAC算法与IPC授权均执行；头签发条件使用真实 WebFrameMain 验证，但本夹具不向真实 Core/Gateway 发起业务 HTTP。`host-ready.png`来自夹具页面，不能作为完整产品界面或新增HostAvailabilityBanner视觉验收。组件行为由对应Vitest覆盖。

本目录不代表真实工作区创建/读取、AgentPack安装、安装器或其他平台已通过；这些由本轮独立证据记录。宿主自动恢复采用有限退避，预算耗尽需要显式重试。
