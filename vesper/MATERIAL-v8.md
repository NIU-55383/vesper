# Vesper · 第 8 轮皮肤材质

保留第 7 版形体、15 根骨骼及 Idle / Walk 接口。本轮只调整角色配色、皮肤反射与角色补光；教堂建筑、原有灯光、后处理和玩法保持原样。

## 调整

| 项目 | 原值 | 当前值 |
| --- | --- | --- |
| 皮肤黄 | #f4bd34 | #f5d474 |
| 腹部奶油色 | #efd39a | #f2dfb4 |
| 手足橄榄棕 | #5b5234 | #685d40 |
| 皮肤粗糙度 | 0.64 | 0.42 |
| 折射率 / 镜面强度 | 1.5 / 1 | 1.43 / 0.85 |
| 清漆层 / 清漆粗糙度 | 0.015 / 0.6 | 0.12 / 0.45 |
| 角色随身补光 | #ffe3a0，1.4 | #beb4cd，0.6 |
| 皮肤环境反射 | 无 | 教堂内部一次性采样，128 分辨率，强度 1.1 |

身体与眼皮使用相同表面参数，形成更宽、更柔和的软胶反光。皮肤保持不透明、无自发光。这里的弹润感来自材质外观，不包含新的软体物理或挤压动画。

教堂的灰紫氛围通过角色补光与真实场景采样影响皮肤，不额外套用全屏滤镜。反射采样只绑定身体和眼皮，不改变 scene.environment；进入中性预览时移除教堂反射和随身补光，返回时恢复原纹理与强度。

## 同机位对照

- 中性全身：[修改前](assets/skin-study/before/neutral-quarter.jpg) · [修改后](assets/skin-study/final/neutral-quarter.jpg)
- 中性皮肤近景：[修改前](assets/skin-study/before/neutral-skin.jpg) · [修改后](assets/skin-study/final/neutral-skin.jpg)
- 原教堂全身：[修改前](assets/skin-study/before/church-quarter.jpg) · [修改后](assets/skin-study/final/church-quarter.jpg)
- 原教堂皮肤近景：[修改前](assets/skin-study/before/church-skin.jpg) · [修改后](assets/skin-study/final/church-skin.jpg)

每对使用相同相机、姿态和既有场景灯光；角色补光的变更属于本轮对照内容。截图为实际 Three.js 渲染。可用 node vesper/skin-study.cjs <新阶段名> 保存新对照，不覆盖历史阶段。

## 文件与验证

- character.js：顶点颜色、身体与眼皮物理材质、materialRevision 8 元信息。
- main.js：角色补光、静态教堂环境反射、中性预览往返恢复。
- skin-study.cjs：固定条件下的材质证据截图。
- assets/nailong.glb 及当前模型预览、动画演示：同步本轮材质。GLB 保留 Idle / Walk，导出原生 clearcoat / ior / specular 材质扩展；运行时教堂反射由 main.js 设置，不烘焙进独立角色。

[环境切换检查](assets/skin-study/environment-check.json)：28 项通过，连续 3 轮往返恢复纹理、补光和 FOV，预热后纹理数稳定，Idle / Walk 原骨骼采样正常，浏览器无异常。各阶段 manifest.json 保存材质值、源文件摘要与动画接口信息。

第 7 版的形体前后对照保留在 review-v7 中作为历史记录；当前材质应以本页的 final 截图为准。
最终交付验证：

- [GLB 导出检查](assets/skin-study/export-check.json)：20 项通过，与上一版导出逐项比对位置、法线、骨骼权重和动画数据均不变；新材质扩展值正确。
- character-review：几何、动画与脚底检查通过，当前静帧已刷新。
- focused browser regression：模型行走与返回、手记交互、真实触屏摇杆及暂停恢复通过。
- 当前行走录像已刷新：MP4 为 H.264、1280×800、30fps、7.6 秒；WebM 和 MP4 均完整解码通过。