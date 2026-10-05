# 初始源码清点证据

日期：2026-10-05；基线：b6115e6 + 当前工作树。方法：读取现有总图模型、工程引用、源码与历史报告，整理为模块功能事实/缺口/核查任务。**本轮未运行业务测试、真实模型或平台内核验收。**

输入素材：

- [Core素材](core-seeds.json)
- [App/Gateway素材](app-gateway-seeds.json)
- [Tools/质量/交付素材](tools-quality-seeds.json)
- [总图模型](../../00-overview/architecture-model.json)

素材是本次清点的来源记录；持续编辑事实以各模块STATUS/TODO为准。初始模块图为职责投影；这些素材不宣称全产品逐功能审计已完成。

文档覆盖、引用、ID和图形检查结果在[documentation-checks.json](documentation-checks.json)。

实际Edge渲染的总图交互与全部55模块SVG的XML/文字边界结果见[render-checks.json](../../00-overview/render-checks.json)，模块示例见[DmaEA截图](dmaea-module-preview.png)。这些结果验证文档和图形，不证明产品功能已经验收。

## 文档复核纠正

- 终端交互唯一持有于APP-DESKTOP-101，Delivery只验制品/依赖；Manager消费实现唯一持有于APP-SERVICES-102。
- WebFetch历史deadline失败属于待核查，不是产品范围边界。
- serviceManager使用规范化本地URL，接受localhost/127.0.0.1:48730和尾斜杠。
- POSIX一次性命令等待只链接timeout token的源码事实已记入TOOLS-COMMAND验收；尚无本轮真实取消复现，不宣告全链根因。
- 本目录种子JSON保留初始输入；最新事实与任务以模块正文为准。
