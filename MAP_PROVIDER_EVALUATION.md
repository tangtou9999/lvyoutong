# 中国大陆地图服务评估

## 决策
- 第一候选：高德地图 JS API 2.0 + Web 服务 API。
- 暂不创建生产 Key 或接入真实地图；先完成商业许可、运营主体、配额和合规确认。
- 百度地图作为备选；腾讯位置服务待完成同口径核验。
- 前端只依赖内部 MapAdapter；供应商 SDK 类型不得扩散到业务模块。
- 坐标必须带 CRS 标识，严禁混用 WGS84、GCJ-02、BD-09。
- 旅游通自己的 Place ID 是主键；供应商 POI ID 仅用于辅助匹配。

## 官方资料与判断
1. 高德 JS API 2.0 是面向 Web 的地图渲染引擎，支持 PC/移动端适配：
   https://developer.amap.com/api/javascript-api-v2/summary
2. 高德 JS API Key 需要按 Web 端 JS API 类型创建，并配置安全密钥：
   https://lbs.amap.com/api/javascript-api-v2/prerequisites
3. 高德个人与企业认证的 Web 服务配额存在差异，地点搜索配额需要重点核算：
   https://lbs.amap.com/faq/account/certification/39670
4. 高德服务协议区分个人研究学习与商业目的。组织将服务用于直接/间接获取收益、或为第三方开发系统等商业场景，可能需要事先购买技术服务许可。旅游通未来有商业化计划，不得把个人免费配额视为商用授权：
   https://developer.amap.com/pages/terms/
5. 高德服务配额、价格及流量包会调整，采购前必须以控制台和书面商务确认结果为准：
   https://lbs.amap.com/upgrade
6. 百度 Web 服务 API 提供 POI 检索、地理编码、路线规划等 HTTP 能力；其官方页面说明商业应用需遵循使用须知：
   https://api.map.baidu.com/lbsapi/cloud/webservice.htm
7. 《地图管理条例》规定互联网地图服务涉及定位、地理信息上传标注、地图数据库开发等活动时，应依法取得相应测绘资质；地图数据服务器应在境内，并落实地图数据安全管理：
   https://xzfgw.moj.gov.cn/front/law/detail?LawID=421
8. 武汉市自然资源和城乡建设局法规入口：
   https://zrzyhgh.wuhan.gov.cn/zwgk_18/zcfgyjd/gtzyl/202204/t20220424_1960907.shtml

## 设计边界
- MapRenderer：底图、视口、标记、地图点击、销毁。
- MapSearchProvider：POI 搜索、地理编码、逆地理编码；服务端代理持有 Web API 密钥。
- locateUser 只能由用户主动操作触发，并经过浏览器定位授权；不做持续跟踪。
- 地图加载失败时仍可浏览附近列表和地点详情。
- 供应商 POI 只作检索/匹配辅助，不直接作为旅游通主档案。
- 新增地点先进入候选匹配与审核，不自动公开成地图标注。
- 使用供应商许可的底图、标注和版权信息，不自行抓取/拼接未经许可的瓦片。
- Key 通过密钥管理配置；Web JS Key 按供应商要求限制域名，服务端 Key 不下发浏览器。
- 用户定位和消费证据按最小必要原则处理，明确目的、方式、范围并依法取得同意。

## 上线前必须完成
- 确认运营主体、地图技术服务许可和商业终端使用场景。
- 确认涉及的测绘资质及平台责任边界。
- 确认 Key 安全、域名白名单、调用配额和预算。
- 确认地图数据、个人位置数据的境内存储和安全方案。
- 核验供应商关于 POI 数据缓存、展示、留存和二次使用的限制。
