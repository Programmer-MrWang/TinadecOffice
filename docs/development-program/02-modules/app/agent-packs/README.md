# App / AgentPack 内容与安装体验

模块ID：`APP-PACKS` · 初始基线：2026-10-05，b6115e6 + 当前工作树。

本模块目前处于**初始源码清点**，还未完成逐功能审计；下列介绍继承总图中已核对的职责，初始状态区分源码能力、范围与缺口。

## 文档入口

- [模块架构与边界](ARCHITECTURE.md) · [模块SVG](architecture.svg)
- [功能与完成情况](STATUS.md) · [本模块TODO](TODO.md)
- [全部模块](../../../MODULE-INDEX.md) · [总TODO](../../../01-program/MASTER-TODO.md)

## 功能介绍

### AgentPack 产品内容

App 携带包制品，Core 负责 preview/install、归属、启禁与不可变发布版本。Solo/Plan/Team/Review/Spec/Graph/Workflow 是包定义。

- GraphSeedPack · 七种模式
- 统一 meeting · 默认 Team

### 安装失败与显式重试（2026-10-09）

bootstrap 固定 `user` 存储作用域。Core 拥有配置校验与发布事实；Gateway 保留配置错误码和严格公开诊断，Desktop 通知详情显示 code/message/severity、行列与 trace_id。普通重连保留失败状态，不替用户再次安装；Retry 重新预览并经确认提交一次。当前窗口共享 pending 尝试，同 origin 窗口按 gateway/user/包版本/digest 共用锁，并同步失败终态；新窗口请求已有窗口的终态。广播仅是 UI 状态同步，不代替 Core 幂等/CAS 或宿主授权。

本轮不改包版本/digest，不清理真实用户根。实现与验证范围见 [APP-PACKS-102](TODO.md#app-packs-102) 和 [证据](../../../../../.tinadec_dev/evidence/2026-10-09-graphseed-fix/VALIDATION.md)；整体逐功能审计及三平台安装验收保持独立。

## 源码入口

- [apps/desktop/src/agentPacks/GraphSeedPack/manifest.json](../../../../../apps/desktop/src/agentPacks/GraphSeedPack/manifest.json)
- [apps/desktop/src/agentPacks/graphSeedPackBootstrap.ts](../../../../../apps/desktop/src/agentPacks/graphSeedPackBootstrap.ts)

## 相关模块

- [AgentConfiguration](../../core/AgentConfiguration/README.md)
- [三平台交付、Manager 与更新](../../cross-cutting/delivery-manager/README.md)

## 本模块的开发工作方式

先拆分STATUS中的功能、核对实际行为并定位缺口，再逐项执行TODO。每次实现同步功能状态、模块图和证据；目标行为与验收边界写清后才进入该任务的实施。核查任务完成不代表该模块所有能力已经完成。
