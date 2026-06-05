# 照片足迹 MVP

本项目用于从 `photos/` 目录里的 Apple Photos 原图读取 GPS 和拍摄时间，并在地图上按时间顺序播放足迹轨迹。

## 使用

```bash
npm install
npm run dev
```

打开 `http://127.0.0.1:5173/`。页面会自动展示 `photos/` 目录里带有位置数据的照片。

更新照片后重新运行：

```bash
npm run generate:photos
```

或者直接重启开发服务，`npm run dev` 会自动重新扫描 `photos/`。

推荐从 macOS「照片」App 使用「导出未修改的原始照片」放入 `photos/`。

## 第一版能力

- 自动扫描 `photos/` 目录
- 读取 EXIF GPS 和拍摄时间，生成展示清单
- 支持 HEIC 元数据读取，浏览器端转换 JPEG 预览
- 按拍摄时间排序
- 地图上显示完整轨迹和已播放轨迹
- 播放时当前点沿轨迹移动，地图跟随缩放
- 左下角同步显示当前照片
- 支持清爽、旅行、深色、标准四种地图样式
