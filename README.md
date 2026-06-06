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

## 逆地理编码

照片 EXIF 只能稳定提供经纬度。要得到酒店、景点、商场、街道等地点名，需要显式运行单独的逆地理编码脚本写入本地缓存，再重新生成照片清单。普通的 `npm run dev`、`npm run build`、`npm run generate:photos` 都不会调用逆地理编码 API。

```bash
npm run geocode:photos
npm run generate:photos
```

API 配置放在本地的 `config/location.env`，该目录已被 `.gitignore` 忽略，不会提交：

```bash
LOCATION_PROVIDER=amap
AMAP_WEB_SERVICE_KEY=your_key
# GEOAPIFY_API_KEY=your_key
# NOMINATIM_EMAIL=you@example.com
```

查询结果会缓存在 `src/generated/location-cache.json`，后续不会重复请求同一个经纬度。`npm run generate:photos` 会把缓存里的标准化地点合并到 `metadata.derived.location`，并把不同服务商结果放到 `metadata.derived.locationProviders`。

安全规则：

- 必须在环境变量或 `config/location.env` 里设置 `LOCATION_PROVIDER`，否则 `npm run geocode:photos` 会直接报错，不会联网。
- 同一经纬度、同一服务商如果已经有缓存，脚本默认跳过，不会重复调用 API。
- 只有设置 `LOCATION_FORCE=1` 时才会刷新已有缓存并再次调用 API。
- 可以用 `LOCATION_LIMIT=1` 只测试一个坐标，避免批量消耗额度。

## 第一版能力

- 自动扫描 `photos/` 目录
- 读取 EXIF GPS 和拍摄时间，生成展示清单
- 支持 HEIC 元数据读取，浏览器端转换 JPEG 预览
- 按拍摄时间排序
- 地图上显示完整轨迹和已播放轨迹
- 播放时当前点沿轨迹移动，地图跟随缩放
- 左下角同步显示当前照片
- 支持清爽、旅行、深色、标准四种地图样式
