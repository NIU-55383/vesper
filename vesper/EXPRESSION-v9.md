# Vesper · 第 9 轮表情

按本轮用户提供的伤心表情参考，修改上眼皮、视线和嘴角。沿用第 7 版身体、第 8 轮浅奶黄色软胶材质、15 根骨骼及 Idle / Walk；教堂和玩法未改动。

- 上眼皮从近乎全睁，改为内侧抬起、外侧下垂的柔和曲线：归一化下边缘 y = 0.22 - 0.34 × side × x + 0.20 × x²。没有新增眉毛。
- 黑瞳中心向下：局部 y 从 -0.008 改为 -0.020 米；横向收敛偏移从 0.007 减为 0.003 米，避免过度对眼，瞳孔大小不变。
- 嘴角下垂量从 0.0025 增为 0.020 米，以 |u|^3.5 保留较平的中央嘴线，两端自然下弯；嘴缝仍为薄线。
- 眼皮比眼球表面前移 0.0022 米，瞳孔前移 0.0008 米，避免眨眼时共面闪烁。完整闭眼后恢复新的默认表情。

## 实际渲染

- [修改前正面](assets/expression-study/before/face.jpg) · [修改后正面](assets/nailong-expression.jpg)
- [中性光表情近景](assets/expression-study/final/neutral-skin.jpg)
- [教堂内表情近景](assets/expression-study/final/church-skin.jpg)
- [当前模型预览](../vesper.html?model=1&revision=9&inspect=1)

## 交付与检查

实际源码改动为 character.js 的五官部分与版本元信息；character-review.cjs 仅调整四分之三检查相机，避免裁掉头部。更新独立 nailong.glb、当前静帧和行走录像，未改动教堂资源。

character-review 的几何有限值、Idle / Walk、贴地检查通过。完整闭眼时双眼瞳孔采样点均被眼皮覆盖；睁眼后恢复新表情，见[眨眼与行走附着报告](assets/expression-study/blink/check.json)。眨眼为网页运行时效果，独立 GLB 包含新的默认表情和原有 Idle / Walk。