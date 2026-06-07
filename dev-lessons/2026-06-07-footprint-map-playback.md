# Footprint Map Playback

Date: 2026-06-07
Source: development conversation

## Product Outcomes

- 状态切换必须稳定：past/current/future 的切换不能产生卡顿、闪烁、残留高亮、点位偏移或不符合预期的重渲染感。
- 首屏进入必须有起点节奏：刷新页面后先完成初始 zoom，再显示 Step0 popover，停留 1 秒后才开始 Step0 -> Step1 移动。
- 路线运动必须连续：长距离虚线、active 路线和移动点要沿同一条视觉路径推进，不能出现虚线和实际移动不对齐。
- 点位停留必须干净：到达某个 Step 后，当前点不能再出现渐入、渐出、闪一下、尺寸切换或图层切换造成的视觉跳动。
- Popover 预览不能干扰地图：下一张 popover 可以提前出现，但不能触发路线重同步、播放卡顿或当前 step 提前提交。

## Implementation Principles

- 用一套路线几何驱动所有路线状态：past、future、active 和移动点共用大圆路线坐标，避免远距离段视觉分叉。
- 拆分 preview 和 commit：`previewIndex` 只服务 popover 预览，`currentIndex` 只在段末提交，避免播放中途触发地图状态重同步。
- 首屏播放要有显式门禁：等待初始 camera 的 `moveend` 后，再 reveal Step0 anchor/popover，再延迟启动移动。
- active 路线由 source 控制：不要用 opacity 渐变或可见性开关管理 active 显隐；进入 holding/moving 时先清空旧 active source。
- 当前点只用单一图层：移动和停留都更新 `point-current`，不要在 `point-current` 与 `point-moving` 之间切换同一个视觉对象。
- 默认禁用足迹状态 opacity transition：不要给 MapLibre line/circle opacity 增加默认过渡，除非已经验证不会引入闪烁或残影。

## Test Plan

- 运行 `npm run build`，确认 TypeScript 和生产打包通过。
- 刷新页面观察首屏：地图先完成初始 zoom，Step0 popover 后出现，等待 1 秒后才开始移动。
- 连续观察 Step0 -> Step1 -> Step2 -> Step3：路线无中途卡顿，上一段 active route 不在下一段开始时闪现。
- 到达每个 Step 后观察当前点：点位不应渐入渐出、变尺寸、偏移或从另一个图层闪现。
- 观察长距离段：虚线、active 线和移动点应沿同一条路径，不出现路径对不齐。
- 观察 popover 提前预览：popover 变化不能导致地图动画掉帧、路线重绘或当前 step 提前提交。

## Related Files Or Commands

- `src/FootprintMap.tsx`
- `src/footprintMapLayers.ts`
- `src/footprintMapVisualState.ts`
- `src/mapUtils.ts`
- `src/App.tsx`
- `npm run build`
