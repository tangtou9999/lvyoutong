import { useMemo, useState } from 'react'
import {
  Compass, Map, Camera, Bookmark, Search, MapPin, Utensils,
  SlidersHorizontal, ChevronRight, LocateFixed, Clock3, ShieldCheck,
  Plus, Sparkles, X, Heart, Footprints
} from 'lucide-react'

type Tab = 'nearby' | 'map' | 'saved' | 'me'
type Category = '全部' | '小吃' | '餐馆' | '夜市' | '街边摊'

const categories: Category[] = ['全部', '小吃', '餐馆', '夜市', '街边摊']

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('nearby')
  const [category, setCategory] = useState<Category>('全部')
  const [query, setQuery] = useState('')
  const [showPublish, setShowPublish] = useState(false)

  const pageTitle = useMemo(() => ({
    nearby: '发现身边的真实味道',
    map: '把旅行装进地图',
    saved: '收藏的地方',
    me: '我的旅行足迹',
  })[activeTab], [activeTab])

  const navItems = [
    { id: 'nearby' as const, label: '发现', icon: Compass },
    { id: 'map' as const, label: '地图', icon: Map },
    { id: 'saved' as const, label: '收藏', icon: Bookmark },
    { id: 'me' as const, label: '我的', icon: Footprints },
  ]

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="旅游通首页" onClick={() => setActiveTab('nearby')}>
          <span className="brand-mark"><Compass size={21} strokeWidth={2.4} /></span>
          <span><strong>旅游通</strong><small>真实旅行地图</small></span>
        </a>
        <button className="location-pill" type="button" aria-label="选择城市">
          <MapPin size={15} /> 武汉 <span className="chevron">⌄</span>
        </button>
      </header>

      <main className="main-content">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" /> REAL EXPERIENCES, REAL JOURNEYS</span>
            <h1>{pageTitle}</h1>
            <p>不追网红热度，只看真实体验。</p>
          </div>
          <div className="hero-stamp" aria-hidden="true">
            <Compass size={35} strokeWidth={1.15} />
            <span>GO<br />LOCAL</span>
          </div>
        </section>

        <section className="search-wrap" aria-label="搜索">
          <Search size={19} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜街区、景点、小吃或店铺"
            aria-label="搜索街区、景点、小吃或店铺"
          />
          {query && <button className="clear-search" onClick={() => setQuery('')} aria-label="清除搜索"><X size={16} /></button>}
          <button className="filter-button" type="button" aria-label="筛选"><SlidersHorizontal size={18} /></button>
        </section>

        <section className="section-heading">
          <div>
            <span className="section-kicker">EXPLORE NEAR YOU</span>
            <h2>附近值得探索</h2>
          </div>
          <button className="text-action" type="button" onClick={() => setActiveTab('map')}>查看地图 <ChevronRight size={16} /></button>
        </section>

        <section className="category-row" aria-label="内容分类">
          {categories.map((item) => (
            <button
              className={category === item ? 'category-chip active' : 'category-chip'}
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >{item}</button>
          ))}
        </section>

        <section className="map-preview">
          <div className="map-grid" aria-hidden="true">
            <div className="map-road road-one" />
            <div className="map-road road-two" />
            <div className="map-road road-three" />
            <div className="map-water" />
            <div className="map-block block-one" />
            <div className="map-block block-two" />
            <div className="map-block block-three" />
            <div className="map-block block-four" />
          </div>
          <div className="map-label"><MapPin size={14} /> 地图预览</div>
          <div className="map-center">
            <span className="center-pulse" />
            <span className="center-dot" />
            <small>你在这里</small>
          </div>
          <div className="map-note">
            <span className="map-note-icon"><Map size={17} /></span>
            <span><strong>真实地图即将接入</strong><small>接入地图服务后展示真实商家与路线</small></span>
          </div>
          <button className="locate-button" type="button" aria-label="定位"><LocateFixed size={18} /></button>
        </section>

        <section className="trust-strip">
          <div className="trust-icon"><ShieldCheck size={18} /></div>
          <p><strong>先看证据，再看评价</strong><span>现场实拍 · 消费佐证 · 更新时间</span></p>
          <ChevronRight size={17} className="trust-arrow" />
        </section>

        <section className="empty-state">
          <div className="empty-illustration">
            <div className="plate"><Utensils size={28} /></div>
            <span className="spark spark-a">✳</span><span className="spark spark-b">✦</span>
          </div>
          <span className="section-kicker">A CITY FULL OF STORIES</span>
          <h3>这片区域还在等待第一份真实记录</h3>
          <p>去过一家店？拍下现场、记下价格，<br />让下一位旅行者少走一点弯路。</p>
          <button className="primary-button" type="button" onClick={() => setShowPublish(true)}>
            <Plus size={18} /> 记录我的第一次体验
          </button>
          <small className="empty-footnote"><Clock3 size={13} /> 不编造评分，不展示虚假热度</small>
        </section>
      </main>

      <button className="floating-camera" type="button" onClick={() => setShowPublish(true)} aria-label="发布体验">
        <Camera size={21} /><span>记录</span>
      </button>

      <nav className="bottom-nav" aria-label="主导航">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} className={activeTab === id ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab(id)} type="button">
            <Icon size={20} strokeWidth={activeTab === id ? 2.3 : 1.8} /><span>{label}</span>
          </button>
        ))}
      </nav>

      {showPublish && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowPublish(false)}>
          <section className="publish-sheet" role="dialog" aria-modal="true" aria-labelledby="publish-title" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <button className="sheet-close" onClick={() => setShowPublish(false)} aria-label="关闭"><X size={19} /></button>
            <span className="section-kicker">SHARE A REAL MOMENT</span>
            <h2 id="publish-title">记录一次真实体验</h2>
            <p>第一版正在搭建发布能力。正式开放后，你可以拍摄现场、匹配店铺并记录实际价格。</p>
            <div className="publish-steps">
              <span><Camera size={17} /> 现场拍摄</span>
              <ChevronRight size={15} />
              <span><MapPin size={17} /> 匹配地点</span>
              <ChevronRight size={15} />
              <span><Heart size={17} /> 分享体验</span>
            </div>
            <button className="primary-button full-width" onClick={() => setShowPublish(false)}>知道了</button>
          </section>
        </div>
      )}

      <footer className="page-footer"><Sparkles size={13} /> 旅游通 · 让每一次出发，都有真实参考</footer>
    </div>
  )
}

export default App
