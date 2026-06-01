'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

// =====================================================
// DESIGN TOKENS — Obsidian dark theme
// =====================================================
const T = {
  bg0:    '#0A0A0B',
  bg1:    '#111113',
  bg2:    '#18181B',
  bg3:    '#1E1E22',
  bg4:    '#252529',
  border: 'rgba(255,255,255,0.07)',
  borderHi: 'rgba(255,255,255,0.14)',
  text0:  '#F2F2F4',
  text1:  '#A8A8B0',
  text2:  '#6B6B75',
  text3:  '#3D3D45',
  blue:   '#5B8FF9',
  blueDim:'rgba(91,143,249,0.15)',
  teal:   '#36D9A0',
  tealDim:'rgba(54,217,160,0.15)',
  amber:  '#F5A623',
  amberDim:'rgba(245,166,35,0.12)',
  red:    '#F16060',
  redDim: 'rgba(241,96,96,0.12)',
  green:  '#5EC269',
  greenDim:'rgba(94,194,105,0.12)',
  purple: '#9B87F5',
  purpleDim:'rgba(155,135,245,0.12)',
  coral:  '#F0876C',
  coralDim:'rgba(240,135,108,0.12)',
}

const font = `'DM Sans', 'Segoe UI', system-ui, sans-serif`
const mono = `'JetBrains Mono', 'Fira Code', monospace`

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=JetBrains+Mono:wght@400;500&display=swap');
  @import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/dist/tabler-icons.min.css');
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes fadeUp { from { opacity:0;transform:translateY(12px)} to { opacity:1;transform:none } }
  @keyframes ring { from { stroke-dashoffset: var(--circ) } }
  * { box-sizing: border-box; margin:0; padding:0 }
  body { background: ${T.bg0}; color: ${T.text0}; font-family: ${font}; -webkit-font-smoothing:antialiased }
  ::-webkit-scrollbar { width:4px; height:4px }
  ::-webkit-scrollbar-track { background: ${T.bg1} }
  ::-webkit-scrollbar-thumb { background: ${T.bg4}; border-radius:4px }
  input, select { font-family: ${font} }
  input::placeholder { color: ${T.text2} }
`

const fmtBytes = (b) => {
  if (!b || b === 0) return '0 B'
  const k = 1024, s = ['B','KB','MB','GB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return (b / Math.pow(k, i)).toFixed(1) + ' ' + s[i]
}
const fmtMs  = (ms) => ms ? Math.round(ms) + 'ms' : '—'
const fmtSec = (ms) => ms ? (ms/1000).toFixed(2) + 's' : '—'
const clamp  = (v,mn,mx) => Math.min(mx,Math.max(mn,v))
const pct    = (v,t) => t > 0 ? Math.round((v/t)*100) : 0

const typeColor = {
  script: T.purple, style: T.teal, image: T.amber,
  font: T.coral, document: T.blue, fetch: T.green,
  xhr: '#D4537E', other: T.text2,
}
const typeIcon = {
  script:'brand-javascript', style:'palette', image:'photo', font:'typography',
  document:'file-code', fetch:'arrows-exchange', xhr:'api', other:'file',
}

// =====================================================
// PRIMITIVE COMPONENTS
// =====================================================

function Pill({ children, color = T.blue, dimColor }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'3px 9px', borderRadius:6, fontSize:11, fontWeight:500,
      background: dimColor || color + '22', color,
      border:`1px solid ${color}33`, letterSpacing:'0.02em'
    }}>{children}</span>
  )
}

function StatusDot({ status }) {
  const c = status === 'pass' ? T.green : status === 'fail' ? T.red : T.amber
  return <span style={{ width:6, height:6, borderRadius:'50%', background:c, display:'inline-block', flexShrink:0 }} />
}

function MiniBar({ value, max, color = T.blue, height = 4 }) {
  const w = clamp(pct(value, max || 1), 0, 100)
  return (
    <div style={{ background:T.bg4, borderRadius:4, height, overflow:'hidden', marginTop:4 }}>
      <div style={{ background:color, width:`${w}%`, height:'100%', borderRadius:4, transition:'width 0.8s cubic-bezier(.4,0,.2,1)' }} />
    </div>
  )
}

function DataRow({ label, value, status, icon, mono: useMono }) {
  const color = status === 'pass' ? T.green : status === 'fail' ? T.red : status === 'warn' ? T.amber : T.text0
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:`1px solid ${T.border}` }}>
      <span style={{ fontSize:12, color:T.text1, display:'flex', alignItems:'center', gap:6 }}>
        {icon && <i className={`ti ti-${icon}`} aria-hidden="true" style={{ fontSize:13, color:T.text2 }} />}
        {label}
      </span>
      <span style={{ fontSize:12, fontWeight:500, color, maxWidth:'55%', textAlign:'right', wordBreak:'break-all', fontFamily: useMono ? mono : font }}>
        {value}
      </span>
    </div>
  )
}

function AlertChip({ type, message }) {
  const conf = {
    pass:  { bg:T.greenDim,  border:T.green  + '40', color:T.green,  icon:'circle-check' },
    warn:  { bg:T.amberDim,  border:T.amber  + '40', color:T.amber,  icon:'alert-triangle' },
    fail:  { bg:T.redDim,    border:T.red    + '40', color:T.red,    icon:'circle-x' },
  }
  const c = conf[type] || conf.warn
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'8px 12px', borderRadius:8, background:c.bg, border:`1px solid ${c.border}`, color:c.color, fontSize:12, marginBottom:6, lineHeight:1.5 }}>
      <i className={`ti ti-${c.icon}`} aria-hidden="true" style={{ marginTop:1, flexShrink:0 }} />
      <span style={{ color:T.text0 }}>{message}</span>
    </div>
  )
}

function Section({ children, title, icon, style: sx = {} }) {
  return (
    <div style={{
      background:T.bg1, border:`1px solid ${T.border}`, borderRadius:14, padding:'1.25rem',
      animation:'fadeUp 0.35s ease both', ...sx
    }}>
      {title && (
        <div style={{ fontSize:11, fontWeight:600, color:T.text2, marginBottom:'1rem', display:'flex', alignItems:'center', gap:7, textTransform:'uppercase', letterSpacing:'0.08em' }}>
          {icon && <i className={`ti ti-${icon}`} aria-hidden="true" style={{ fontSize:14, color:T.text1 }} />}
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

function VitalBox({ name, value, good, poor, unit, desc }) {
  const cls = !value ? 'n' : value <= good ? 'g' : value <= poor ? 'w' : 'b'
  const label = !value ? 'No data' : value <= good ? 'Good' : value <= poor ? 'Needs work' : 'Poor'
  const conf = {
    g: { bg:T.greenDim,  color:T.green,  border:T.green  + '40' },
    w: { bg:T.amberDim,  color:T.amber,  border:T.amber  + '40' },
    b: { bg:T.redDim,    color:T.red,    border:T.red    + '40' },
    n: { bg:T.bg3,       color:T.text2,  border:T.border },
  }
  const c = conf[cls]
  return (
    <div style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:12, padding:'1.1rem', textAlign:'center' }}>
      <div style={{ fontSize:10, color:c.color, marginBottom:4, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase' }}>{name}</div>
      <div style={{ fontSize:28, fontWeight:300, color:c.color, letterSpacing:'-0.02em' }}>
        {value ? (unit === 's' ? fmtSec(value) : value.toFixed(3)) : '—'}
      </div>
      <div style={{ fontSize:11, color:c.color, marginTop:4, fontWeight:500 }}>{label}</div>
      <div style={{ fontSize:10, color:T.text2, marginTop:2 }}>{desc}</div>
    </div>
  )
}

function ScoreRing({ score }) {
  const [animated, setAnimated] = useState(0)
  const r = 42, circ = 2 * Math.PI * r
  const color = score >= 85 ? T.green : score >= 65 ? T.amber : T.red
  const glow  = score >= 85 ? '#5EC26944' : score >= 65 ? '#F5A62344' : '#F1606044'

  useEffect(() => {
    const t = setInterval(() => setAnimated(prev => {
      if (prev >= score) { clearInterval(t); return score }
      return prev + 2
    }), 14)
    return () => clearInterval(t)
  }, [score])

  return (
    <div style={{ position:'relative', width:100, height:100, flexShrink:0 }}>
      <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform:'rotate(-90deg)' }}>
        <defs>
          <filter id="glow">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={glow} />
          </filter>
        </defs>
        <circle cx="50" cy="50" r={r} stroke={T.bg3} strokeWidth="6" fill="none" />
        <circle cx="50" cy="50" r={r} stroke={color} strokeWidth="6" fill="none"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - animated / 100)}
          strokeLinecap="round"
          filter="url(#glow)"
          style={{ transition:'stroke-dashoffset 0.05s' }} />
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
        <div style={{ fontSize:24, fontWeight:300, color:T.text0, letterSpacing:'-0.02em' }}>{animated}</div>
      </div>
    </div>
  )
}

// =====================================================
// SCORE CALC
// =====================================================
function calcScore(d) {
  let pts = 0, max = 0
  const add = (ok, w) => { pts += ok ? w : 0; max += w }
  const a = d.audit, t = d.tech
  add(a.meta.title.length >= 30 && a.meta.title.length <= 60, 10)
  add(a.meta.description.length >= 120 && a.meta.description.length <= 160, 8)
  add(!!a.meta.canonical, 6); add(!!a.meta.viewport, 5); add(t.isHttps, 8)
  add(t.robotsStatus === 200, 5); add(t.sitemapStatus === 200, 5)
  add(a.headings.h1Count === 1, 8); add(a.images.missingAlt === 0, 6)
  add(!!a.social.ogTitle, 4); add(!!a.social.ogImage, 4); add(!!a.schema, 6)
  add(a.vitals?.LCP < 2500, 8); add(a.vitals?.CLS < 0.1, 6)
  add(a.vitals?.FCP < 1800, 5); add(d.loadTime < 3000, 6)
  add(t.ssrLength > 5000, 4); add(a.content.wordCount > 300, 4)
  add(d.uxIssues.filter(u => u.severity === 'critical').length === 0, 5)
  return Math.round((pts / max) * 100)
}

// =====================================================
// TABS
// =====================================================
const TABS = [
  { id:'overview',   label:'Overview',    icon:'layout-dashboard' },
  { id:'perf',       label:'Performance', icon:'activity' },
  { id:'resources',  label:'Resources',   icon:'database' },
  { id:'ux',         label:'UX & A11y',   icon:'eye' },
  { id:'optimize',   label:'Optimize',    icon:'rocket' },
  { id:'meta',       label:'Meta',        icon:'tag' },
  { id:'content',    label:'Content',     icon:'file-text' },
  { id:'tech',       label:'Technical',   icon:'server' },
  { id:'screenshot', label:'Screenshot',  icon:'camera' },
]

// =====================================================
// INPUT SCREEN
// =====================================================
function InputScreen({ url, setUrl, device, setDevice, keyword, setKeyword, onRun }) {
  return (
    <div style={{ minHeight:'100vh', background:T.bg0, display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', fontFamily:font }}>
      <style>{CSS}</style>

      {/* Background grid */}
      <div style={{ position:'fixed', inset:0, backgroundImage:`linear-gradient(${T.border} 1px,transparent 1px),linear-gradient(90deg,${T.border} 1px,transparent 1px)`, backgroundSize:'40px 40px', pointerEvents:'none' }} />

      <div style={{ maxWidth:580, width:'100%', position:'relative', zIndex:1, animation:'fadeUp 0.5s ease' }}>
        {/* Logo mark */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:'2.5rem', justifyContent:'center' }}>
          <div style={{ width:40, height:40, borderRadius:12, background:`linear-gradient(135deg,${T.blue},${T.purple})`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <i className="ti ti-search-check" style={{ fontSize:20, color:'#fff' }} aria-hidden="true" />
          </div>
          <span style={{ fontSize:22, fontWeight:300, color:T.text0, letterSpacing:'-0.02em' }}>SEO <strong style={{ fontWeight:600 }}>Audit</strong></span>
        </div>

        <div style={{ background:T.bg1, border:`1px solid ${T.border}`, borderRadius:18, padding:'2rem', backdropFilter:'blur(20px)' }}>
          <p style={{ fontSize:13, color:T.text2, marginBottom:'1.5rem', textAlign:'center', letterSpacing:'0.02em' }}>
            Full technical + performance + UX analysis
          </p>

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <label style={{ fontSize:11, color:T.text2, display:'block', marginBottom:6, letterSpacing:'0.06em', textTransform:'uppercase', fontWeight:600 }}>URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && onRun()}
                placeholder="https://example.com"
                style={{ width:'100%', padding:'11px 14px', border:`1px solid ${T.border}`, borderRadius:10, fontSize:14, background:T.bg2, color:T.text0, outline:'none', fontFamily:font }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label style={{ fontSize:11, color:T.text2, display:'block', marginBottom:6, letterSpacing:'0.06em', textTransform:'uppercase', fontWeight:600 }}>Device</label>
                <select value={device} onChange={e => setDevice(e.target.value)}
                  style={{ width:'100%', padding:'11px 12px', border:`1px solid ${T.border}`, borderRadius:10, fontSize:13, background:T.bg2, color:T.text0, outline:'none', cursor:'pointer' }}>
                  <option value="desktop">Desktop</option>
                  <option value="mobile">Mobile</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, color:T.text2, display:'block', marginBottom:6, letterSpacing:'0.06em', textTransform:'uppercase', fontWeight:600 }}>Keyword</label>
                <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Optional"
                  style={{ width:'100%', padding:'11px 12px', border:`1px solid ${T.border}`, borderRadius:10, fontSize:13, background:T.bg2, color:T.text0, outline:'none', fontFamily:font }} />
              </div>
            </div>
            <button onClick={onRun} style={{
              padding:'13px', background:`linear-gradient(135deg,${T.blue},${T.purple})`, color:'#fff', border:'none', borderRadius:12,
              fontSize:14, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              letterSpacing:'0.02em', marginTop:4, transition:'opacity 0.2s'
            }}>
              <i className="ti ti-rocket" aria-hidden="true" /> Run Audit
            </button>
          </div>
        </div>

        <p style={{ fontSize:11, color:T.text3, textAlign:'center', marginTop:'1.5rem' }}>
          Powered by headless Chromium · Googlebot user-agent
        </p>
      </div>
    </div>
  )
}

// =====================================================
// MAIN DASHBOARD
// =====================================================
export default function SEODashboard() {
  const [url, setUrl]         = useState('https://example.com')
  const [device, setDevice]   = useState('desktop')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadMsg, setLoadMsg] = useState('')
  const [data, setData]       = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [resFilter, setResFilter] = useState('all')
  const [resSort, setResSort] = useState('size')
  const [resSortDir, setResSortDir] = useState('desc')
  const [uxFilter, setUxFilter] = useState('all')
  const [resSearch, setResSearch] = useState('')

  const runAudit = useCallback(async () => {
    if (!url) return
    setLoading(true); setData(null)
    const msgs = [
      'Launching headless browser…','Crawling with Googlebot…',
      'Checking robots.txt & sitemap…','Measuring Core Web Vitals…',
      'Auditing every network resource…','Running UX checks…',
      'Capturing screenshots…','Building optimization roadmap…',
    ]
    let mi = 0; setLoadMsg(msgs[0])
    const iv = setInterval(() => { mi = Math.min(mi+1,msgs.length-1); setLoadMsg(msgs[mi]) }, 2800)
    try {
      const qs = `?url=${encodeURIComponent(url)}&device=${device}${keyword?'&keyword='+encodeURIComponent(keyword):''}`
      const res = await fetch('/api/analyze' + qs)
      const d = await res.json()
      clearInterval(iv)
      if (d.success) { setData(d); setActiveTab('overview') }
      else alert('Audit error: ' + d.error)
    } catch(e) { clearInterval(iv); alert('Request failed: ' + e.message) }
    finally { setLoading(false) }
  }, [url, device, keyword])

  // ---- Loading screen ----
  if (loading) return (
    <div style={{ minHeight:'100vh', background:T.bg0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, fontFamily:font }}>
      <style>{CSS}</style>
      <div style={{ width:44, height:44, border:`2px solid ${T.bg3}`, borderTopColor:T.blue, borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
      <div style={{ fontSize:15, color:T.text0, fontWeight:300 }}>{loadMsg}</div>
      <div style={{ fontSize:12, color:T.text2, fontFamily:mono }}>{url}</div>
    </div>
  )

  // ---- Input screen ----
  if (!data && !loading) return (
    <InputScreen url={url} setUrl={setUrl} device={device} setDevice={setDevice}
      keyword={keyword} setKeyword={setKeyword} onRun={runAudit} />
  )

  if (!data) return null

  const score = calcScore(data)
  const a = data.audit, t = data.tech
  const criticalCount = data.uxIssues.filter(u => u.severity === 'critical').length
  const warnCount     = data.uxIssues.filter(u => u.severity === 'warning').length

  // ---- Resource filter ----
  let filteredRes = t.resourceDetails || []
  if (resFilter !== 'all') filteredRes = filteredRes.filter(r => r.type === resFilter)
  if (resSearch) filteredRes = filteredRes.filter(r => r.url.toLowerCase().includes(resSearch.toLowerCase()))
  filteredRes = [...filteredRes].sort((x, y) => {
    const v = resSortDir === 'desc' ? -1 : 1
    if (resSort === 'size')     return v * (y.size - x.size)
    if (resSort === 'duration') return v * (y.duration - x.duration)
    return v * x.type.localeCompare(y.type)
  })

  const filteredUX = uxFilter === 'all' ? data.uxIssues : data.uxIssues.filter(u => u.severity === uxFilter)

  const scoreColor = score >= 85 ? T.green : score >= 65 ? T.amber : T.red
  const inp = (sx = {}) => ({
    padding:'8px 12px', border:`1px solid ${T.border}`, borderRadius:9, fontSize:12,
    background:T.bg2, color:T.text0, outline:'none', fontFamily:font, ...sx
  })

  // Category scores helper
  const catScore = (fn) => fn()

  return (
    <div style={{ background:T.bg0, minHeight:'100vh', padding:'1.25rem', fontFamily:font, color:T.text0 }}>
      <style>{CSS}</style>

      {/* =========== TOP BAR =========== */}
      <div style={{ display:'flex', gap:8, marginBottom:'1.25rem', alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ width:32, height:32, borderRadius:9, background:`linear-gradient(135deg,${T.blue},${T.purple})`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <i className="ti ti-search-check" style={{ fontSize:16, color:'#fff' }} aria-hidden="true" />
        </div>
        <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && runAudit()}
          style={{ ...inp(), flex:1, minWidth:200, fontSize:13 }} />
        <select value={device} onChange={e => setDevice(e.target.value)} style={inp({ width:120 })}>
          <option value="desktop">Desktop</option>
          <option value="mobile">Mobile</option>
        </select>
        <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="keyword…"
          style={inp({ width:150 })} />
        <button onClick={runAudit} style={{
          padding:'8px 16px', background:T.blue, color:'#fff', border:'none', borderRadius:9,
          fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6
        }}>
          <i className="ti ti-refresh" aria-hidden="true" /> Re-audit
        </button>
      </div>

      {/* =========== HERO =========== */}
      <div style={{ background:T.bg1, border:`1px solid ${T.border}`, borderRadius:16, padding:'1.5rem 2rem', marginBottom:'1rem', display:'flex', gap:'2rem', alignItems:'center', flexWrap:'wrap', animation:'fadeUp 0.3s ease' }}>
        <ScoreRing score={score} />
        <div style={{ flex:1, minWidth:220 }}>
          <div style={{ fontSize:12, color:T.text2, marginBottom:3, fontFamily:mono }}>{url.replace(/^https?:\/\//,'')}</div>
          <div style={{ fontSize:22, fontWeight:300, color:T.text0, marginBottom:4, letterSpacing:'-0.02em' }}>
            {score >= 90 ? 'Excellent' : score >= 80 ? 'Good' : score >= 65 ? 'Needs work' : 'Poor'}&nbsp;
            <span style={{ color:scoreColor, fontWeight:600 }}>{score}/100</span>
          </div>
          <div style={{ fontSize:12, color:T.text2, marginBottom:12 }}>
            HTTP {data.status} · {data.deviceType} · {fmtSec(data.loadTime)} load · {fmtMs(t.ttfb)} TTFB
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {t.isHttps             && <Pill color={T.green}>HTTPS</Pill>}
            {t.robotsStatus===200 && <Pill color={T.teal}>robots.txt</Pill>}
            {t.sitemapStatus===200 && <Pill color={T.teal}>sitemap</Pill>}
            {a.schema             && <Pill color={T.blue}>Schema.org</Pill>}
            {a.meta.canonical    && <Pill color={T.blue}>Canonical</Pill>}
            {a.headings.h1Count===1 && <Pill color={T.green}>H1 ✓</Pill>}
            {criticalCount > 0   && <Pill color={T.red}>{criticalCount} critical</Pill>}
            {warnCount > 0       && <Pill color={T.amber}>{warnCount} warnings</Pill>}
          </div>
        </div>

        {/* Mini vitals */}
        <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
          {[
            { n:'LCP', v:a.vitals?.LCP, g:2500, p:4000, u:'s' },
            { n:'CLS', v:a.vitals?.CLS, g:0.1,  p:0.25, u:''  },
            { n:'FCP', v:a.vitals?.FCP, g:1800,  p:3000, u:'s' },
          ].map(vi => {
            const cls = !vi.v ? 'n' : vi.v<=vi.g ? 'g' : vi.v<=vi.p ? 'w' : 'b'
            const clr = { g:T.green, w:T.amber, b:T.red, n:T.text2 }[cls]
            return (
              <div key={vi.n} style={{ textAlign:'center' }}>
                <div style={{ fontSize:10, color:T.text2, marginBottom:2, letterSpacing:'0.08em', fontWeight:600, textTransform:'uppercase' }}>{vi.n}</div>
                <div style={{ fontSize:20, fontWeight:300, color:clr, letterSpacing:'-0.02em' }}>
                  {vi.v ? (vi.u==='s' ? fmtSec(vi.v) : vi.v.toFixed(3)) : '—'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* =========== TAB BAR =========== */}
      <div style={{ display:'flex', gap:1, background:T.bg1, border:`1px solid ${T.border}`, borderRadius:12, padding:'3px', marginBottom:'1rem', overflowX:'auto' }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                padding:'7px 13px', borderRadius:9, fontSize:12, cursor:'pointer', border:'none', fontFamily:font,
                whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5,
                background: active ? T.bg3 : 'transparent',
                color: active ? T.text0 : T.text2,
                fontWeight: active ? 600 : 400,
                transition:'all 0.2s',
                boxShadow: active ? `0 0 0 1px ${T.borderHi}` : 'none',
              }}>
              <i className={`ti ti-${tab.icon}`} aria-hidden="true" style={{ fontSize:13, color: active ? T.blue : T.text2 }} />
              {tab.label}
              {tab.id==='ux' && criticalCount>0 && (
                <span style={{ background:T.red, color:'#fff', fontSize:10, borderRadius:5, padding:'0 5px', lineHeight:'16px' }}>{criticalCount}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ==================== OVERVIEW ==================== */}
      {activeTab === 'overview' && (
        <div style={{ animation:'fadeUp 0.3s ease' }}>
          {/* Metric tiles */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8, marginBottom:'1rem' }}>
            {[
              { l:'Score',    v:score+'/100',             c:scoreColor,      icon:'rosette-discount-check' },
              { l:'Load',     v:fmtSec(data.loadTime),    c:data.loadTime<3000?T.green:T.amber, icon:'clock' },
              { l:'Page size',v:fmtBytes(t.resources.total), c:T.blue,        icon:'database' },
              { l:'TTFB',     v:fmtMs(t.ttfb),            c:t.ttfb<600?T.green:T.amber,         icon:'speedboat' },
              { l:'Requests', v:t.resources.requestCount, c:T.text1,         icon:'arrows-exchange' },
              { l:'Words',    v:a.content.wordCount,       c:T.teal,          icon:'file-text' },
              { l:'Images',   v:a.images.total,            c:T.amber,         icon:'photo' },
              { l:'DOM nodes',v:a.performance.domNodes,    c:a.performance.domNodes<1500?T.green:T.amber, icon:'hierarchy' },
            ].map(m => (
              <div key={m.l} style={{ background:T.bg1, border:`1px solid ${T.border}`, borderRadius:12, padding:'1rem', transition:'border-color 0.2s' }}>
                <div style={{ fontSize:10, color:T.text2, marginBottom:6, display:'flex', alignItems:'center', gap:5, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>
                  <i className={`ti ti-${m.icon}`} aria-hidden="true" style={{ fontSize:12 }} />{m.l}
                </div>
                <div style={{ fontSize:22, fontWeight:300, color:m.c, letterSpacing:'-0.02em' }}>{m.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
            {/* Checklist */}
            <Section title="SEO checklist" icon="checklist">
              {[
                { ok:a.meta.title.length>=30&&a.meta.title.length<=60, msg:'Title length 30–60 chars' },
                { ok:a.meta.description.length>=120&&a.meta.description.length<=160, msg:'Description 120–160 chars' },
                { ok:!!a.meta.canonical,    msg:'Canonical URL declared' },
                { ok:!!a.meta.viewport,     msg:'Viewport meta tag present' },
                { ok:t.isHttps,             msg:'HTTPS enabled' },
                { ok:t.robotsStatus===200,  msg:'robots.txt accessible' },
                { ok:t.sitemapStatus===200, msg:'XML sitemap found' },
                { ok:a.headings.h1Count===1,msg:'Exactly one H1 tag' },
                { ok:a.images.missingAlt===0, msg:'All images have alt text' },
                { ok:!!a.social.ogTitle,    msg:'Open Graph title set' },
                { ok:!!a.social.ogImage,    msg:'Open Graph image set' },
                { ok:!!a.schema,            msg:'Structured data (Schema.org) found' },
                { ok:a.content.wordCount>=600, msg:'Content depth 600+ words' },
                { ok:criticalCount===0,     msg:'No critical UX/accessibility issues' },
              ].map((c,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:`1px solid ${T.border}`, fontSize:12 }}>
                  <StatusDot status={c.ok?'pass':'warn'} />
                  <span style={{ color:c.ok?T.text0:T.text1 }}>{c.msg}</span>
                </div>
              ))}
            </Section>

            {/* SERP Preview */}
            <Section title="Google SERP preview" icon="brand-google">
              <div style={{ background:T.bg3, border:`1px solid ${T.border}`, borderRadius:10, padding:'1rem', fontFamily:'arial,sans-serif', marginBottom:'1rem' }}>
                <div style={{ fontSize:12, color:T.text2, marginBottom:3 }}>{url.replace(/^https?:\/\//,'')}</div>
                <div style={{ fontSize:17, color:'#8AB4F8', marginBottom:6, lineHeight:1.3, cursor:'pointer' }}>
                  {a.meta.title?.substring(0,60) || 'No title'}
                </div>
                <div style={{ fontSize:13, color:T.text1, lineHeight:1.6 }}>
                  {a.meta.description?.substring(0,160) || 'No meta description — Google will pull an excerpt.'}
                </div>
              </div>
              <div style={{ fontSize:11, color:T.text2, marginBottom:6, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Character counts</div>
              <div style={{ fontSize:12, color:T.text1, marginBottom:6 }}>
                Title: {a.meta.title?.length||0}/60
                <MiniBar value={a.meta.title?.length||0} max={80} color={a.meta.title?.length>=30&&a.meta.title?.length<=60?T.green:T.amber} height={3} />
              </div>
              <div style={{ fontSize:12, color:T.text1 }}>
                Description: {a.meta.description?.length||0}/160
                <MiniBar value={a.meta.description?.length||0} max={200} color={a.meta.description?.length>=120&&a.meta.description?.length<=160?T.green:T.amber} height={3} />
              </div>
            </Section>
          </div>

          {/* Category scores */}
          <Section title="Category scores" icon="chart-bar">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
              {[
                { l:'Meta & Tags', c:T.blue, s:catScore(() => { let p=0,m=5; if(a.meta.title.length>=30&&a.meta.title.length<=60)p++; if(a.meta.description.length>=120&&a.meta.description.length<=160)p++; if(a.meta.canonical)p++; if(a.meta.viewport)p++; if(a.meta.robots)p++; return Math.round(p/m*100) }) },
                { l:'Content',     c:T.teal,   s:catScore(() => { let p=0,m=4; if(a.headings.h1Count===1)p++; if(a.content.wordCount>=300)p++; if(a.images.missingAlt===0)p++; if(a.schema)p++; return Math.round(p/m*100) }) },
                { l:'Performance', c:T.purple, s:catScore(() => { let p=0,m=4; if(a.vitals?.LCP<2500)p++; if(a.vitals?.CLS<0.1)p++; if(data.loadTime<3000)p++; if(t.ttfb<600)p++; return Math.round(p/m*100) }) },
                { l:'Technical',   c:T.amber,  s:catScore(() => { let p=0,m=5; if(t.isHttps)p++; if(t.robotsStatus===200)p++; if(t.sitemapStatus===200)p++; if(t.ssrLength>5000)p++; if(data.status>=200&&data.status<300)p++; return Math.round(p/m*100) }) },
                { l:'Social / OG', c:T.coral,  s:catScore(() => { let p=0,m=3; if(a.social.ogTitle)p++; if(a.social.ogDescription)p++; if(a.social.ogImage)p++; return Math.round(p/m*100) }) },
                { l:'UX & A11y',   c:T.green,  s:Math.max(0,100-criticalCount*25-warnCount*10) },
              ].map(cat => (
                <div key={cat.l} style={{ padding:'0.875rem', background:T.bg2, borderRadius:10, border:`1px solid ${T.border}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}>
                    <span style={{ color:T.text1 }}>{cat.l}</span>
                    <span style={{ fontWeight:600, color:cat.s>=80?T.green:cat.s>=50?T.amber:T.red }}>{cat.s}%</span>
                  </div>
                  <MiniBar value={cat.s} max={100} color={cat.c} height={4} />
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ==================== PERFORMANCE ==================== */}
      {activeTab === 'perf' && (
        <div style={{ animation:'fadeUp 0.3s ease' }}>
          <Section title="Core Web Vitals" icon="activity" style={{ marginBottom:'1rem' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
              <VitalBox name="LCP" value={a.vitals?.LCP} good={2500} poor={4000} unit="s" desc="Largest Contentful Paint" />
              <VitalBox name="CLS" value={a.vitals?.CLS} good={0.1}  poor={0.25} unit="" desc="Cumulative Layout Shift" />
              <VitalBox name="FCP" value={a.vitals?.FCP} good={1800} poor={3000} unit="s" desc="First Contentful Paint" />
              <VitalBox name="INP" value={a.vitals?.INP} good={200}  poor={500}  unit="s" desc="Interaction to Next Paint" />
            </div>
          </Section>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
            <Section title="Timing" icon="clock">
              <DataRow label="Load time"    value={fmtSec(data.loadTime)} status={data.loadTime<3000?'pass':data.loadTime<6000?'warn':'fail'} icon="clock" />
              <DataRow label="TTFB"         value={fmtMs(t.ttfb)}         status={t.ttfb<600?'pass':t.ttfb<1200?'warn':'fail'} icon="speedboat" />
              <DataRow label="Requests"     value={t.resources.requestCount||'—'} icon="arrows-exchange" />
              <DataRow label="Blocking scripts" value={a.performance.syncScripts} status={a.performance.syncScripts===0?'pass':a.performance.syncScripts<=2?'warn':'fail'} icon="brand-javascript" />
              <DataRow label="Stylesheets"  value={a.performance.stylesheets} icon="palette" />
              <DataRow label="DOM nodes"    value={a.performance.domNodes}    status={a.performance.domNodes<1500?'pass':a.performance.domNodes<3000?'warn':'fail'} icon="hierarchy" />
              <DataRow label="SSR HTML"     value={t.ssrLength+' chars'}      status={t.ssrLength>5000?'pass':'warn'} icon="server" />
            </Section>

            <Section title="Resource breakdown" icon="database">
              {Object.entries(t.resourceByType||{}).map(([type,info]) => (
                <div key={type} style={{ marginBottom:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                    <span style={{ display:'flex', alignItems:'center', gap:6, color:T.text1 }}>
                      <i className={`ti ti-${typeIcon[type]||'file'}`} aria-hidden="true" style={{ fontSize:13, color:typeColor[type]||T.text2 }} />
                      {type} <span style={{ color:T.text2 }}>×{info.count}</span>
                    </span>
                    <span style={{ fontWeight:600, color:T.text0, fontSize:12 }}>{fmtBytes(info.totalSize)}</span>
                  </div>
                  <MiniBar value={info.totalSize} max={t.resources.total||1} color={typeColor[type]||T.text2} height={4} />
                  <div style={{ fontSize:10, color:T.text2, marginTop:2 }}>avg {Math.round(info.avgDuration)}ms</div>
                </div>
              ))}
            </Section>
          </div>

          {/* Third-party */}
          <Section title="Third-party scripts" icon="plug">
            {t.thirdParties.length===0 ? (
              <AlertChip type="pass" message="No known third-party scripts detected." />
            ) : (
              <>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                        {['Script','Category','Reqs','Size','Avg duration'].map(h => (
                          <th key={h} style={{ textAlign:'left', padding:'6px 8px', fontSize:10, color:T.text2, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.thirdParties.map(tp => (
                        <tr key={tp.name} style={{ borderBottom:`1px solid ${T.border}` }}>
                          <td style={{ padding:'8px 8px', fontWeight:500, color:T.text0 }}>{tp.name}</td>
                          <td style={{ padding:'8px 8px' }}><Pill color={T.blue}>{tp.category}</Pill></td>
                          <td style={{ padding:'8px 8px', color:T.text1 }}>{tp.count}</td>
                          <td style={{ padding:'8px 8px', color:tp.size>100000?T.amber:T.text1 }}>{fmtBytes(tp.size)}</td>
                          <td style={{ padding:'8px 8px', color:tp.duration>500?T.amber:T.text1 }}>{Math.round(tp.duration)}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop:10 }}>
                  <AlertChip type="warn" message={`${t.thirdParties.length} third-party providers add DNS lookups and execution time. Defer non-critical scripts.`} />
                </div>
              </>
            )}
          </Section>
        </div>
      )}

      {/* ==================== RESOURCES ==================== */}
      {activeTab === 'resources' && (
        <div style={{ animation:'fadeUp 0.3s ease' }}>
          <div style={{ display:'flex', gap:8, marginBottom:'1rem', flexWrap:'wrap', alignItems:'center' }}>
            <input value={resSearch} onChange={e => setResSearch(e.target.value)} placeholder="Filter by URL…"
              style={{ ...inp(), flex:1, minWidth:180 }} />
            <select value={resFilter} onChange={e => setResFilter(e.target.value)} style={inp()}>
              <option value="all">All types</option>
              {Object.keys(t.resourceByType||{}).map(type => (
                <option key={type} value={type}>{type} ({t.resourceByType[type].count})</option>
              ))}
            </select>
            <select value={resSort} onChange={e => setResSort(e.target.value)} style={inp()}>
              <option value="size">Size</option>
              <option value="duration">Duration</option>
              <option value="type">Type</option>
            </select>
            <button onClick={() => setResSortDir(d => d==='desc'?'asc':'desc')}
              style={{ ...inp(), cursor:'pointer' }}>{resSortDir==='desc'?'↓ Desc':'↑ Asc'}</button>
            <span style={{ fontSize:11, color:T.text2 }}>{filteredRes.length} resources</span>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {filteredRes.slice(0,60).map((r,i) => (
              <div key={i} style={{ background:T.bg1, border:`1px solid ${T.border}`, borderRadius:12, padding:'0.875rem 1rem', transition:'border-color 0.2s' }}>
                <div style={{ display:'flex', gap:10, alignItems:'flex-start', flexWrap:'wrap' }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:600, background:(typeColor[r.type]||T.text2)+'22', color:typeColor[r.type]||T.text2, flexShrink:0, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                    <i className={`ti ti-${typeIcon[r.type]||'file'}`} aria-hidden="true" style={{ fontSize:11 }} />{r.type}
                  </span>
                  <span style={{ fontSize:11, color:T.text1, flex:1, wordBreak:'break-all', lineHeight:1.5, fontFamily:mono }}>
                    {r.url.length>100?r.url.substring(0,100)+'…':r.url}
                  </span>
                  <div style={{ display:'flex', gap:4, flexShrink:0, flexWrap:'wrap' }}>
                    {r.thirdParty && <Pill color={T.amber}>3rd party</Pill>}
                    {r.cached     && <Pill color={T.green}>cached</Pill>}
                    {r.compressed && <Pill color={T.blue}>gzip/br</Pill>}
                    {r.blocked    && <Pill color={T.red}>blocking</Pill>}
                    {r.issues.length>0 && <Pill color={T.red}>{r.issues.length} issue{r.issues.length>1?'s':''}</Pill>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:20, marginTop:8, flexWrap:'wrap' }}>
                  {[
                    { l:'Size',     v:fmtBytes(r.size),  c:r.size>200000?T.red:r.size>50000?T.amber:T.green },
                    { l:'Duration', v:fmtMs(r.duration), c:r.duration>1000?T.red:r.duration>300?T.amber:T.green },
                    { l:'Status',   v:r.status,           c:r.status<300?T.green:T.red },
                    { l:'Priority', v:r.priority,         c:r.priority==='high'?T.red:r.priority==='medium'?T.amber:T.text2 },
                  ].map(m => (
                    <div key={m.l}>
                      <div style={{ fontSize:10, color:T.text2, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>{m.l}</div>
                      <div style={{ fontSize:13, fontWeight:500, color:m.c }}>{m.v}</div>
                    </div>
                  ))}
                </div>
                <MiniBar value={r.size} max={t.resources.total/10||1} color={typeColor[r.type]||T.text2} height={2} />
                {(r.issues.length>0||r.optimizations.length>0) && (
                  <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:3 }}>
                    {r.issues.map((iss,j) => (
                      <div key={j} style={{ fontSize:11, color:T.red, display:'flex', alignItems:'center', gap:5 }}>
                        <i className="ti ti-alert-triangle" aria-hidden="true" style={{ fontSize:11 }} /> {iss}
                      </div>
                    ))}
                    {r.optimizations.map((opt,j) => (
                      <div key={j} style={{ fontSize:11, color:T.blue, display:'flex', alignItems:'center', gap:5 }}>
                        <i className="ti ti-bulb" aria-hidden="true" style={{ fontSize:11 }} /> {opt}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {filteredRes.length>60 && (
              <div style={{ textAlign:'center', fontSize:12, color:T.text2, padding:'1rem' }}>
                Showing 60 of {filteredRes.length}. Use filters to narrow results.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== UX ==================== */}
      {activeTab === 'ux' && (
        <div style={{ animation:'fadeUp 0.3s ease' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8, marginBottom:'1rem' }}>
            {[
              { l:'Critical', v:criticalCount, c:T.red,   icon:'circle-x' },
              { l:'Warnings', v:warnCount,     c:T.amber,  icon:'alert-triangle' },
              { l:'Info',     v:data.uxIssues.filter(u=>u.severity==='info').length, c:T.blue, icon:'info-circle' },
              { l:'UX score', v:Math.max(0,100-criticalCount*25-warnCount*10)+'/100', c:T.green, icon:'eye' },
            ].map(m => (
              <div key={m.l} style={{ background:T.bg1, border:`1px solid ${T.border}`, borderRadius:12, padding:'1rem' }}>
                <div style={{ fontSize:10, color:T.text2, marginBottom:6, display:'flex', alignItems:'center', gap:5, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>
                  <i className={`ti ti-${m.icon}`} aria-hidden="true" style={{ fontSize:12 }} />{m.l}
                </div>
                <div style={{ fontSize:24, fontWeight:300, color:m.c, letterSpacing:'-0.02em' }}>{m.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', gap:6, marginBottom:'1rem' }}>
            {['all','critical','warning','info'].map(f => (
              <button key={f} onClick={() => setUxFilter(f)}
                style={{
                  padding:'6px 14px', borderRadius:8, fontSize:11, cursor:'pointer', border:`1px solid ${uxFilter===f?T.blue:T.border}`,
                  background: uxFilter===f ? T.blueDim : 'transparent',
                  color: uxFilter===f ? T.blue : T.text2, fontFamily:font, fontWeight:600, letterSpacing:'0.04em', transition:'all 0.2s'
                }}>
                {f.charAt(0).toUpperCase()+f.slice(1)}
              </button>
            ))}
          </div>

          {filteredUX.length===0 ? (
            <AlertChip type="pass" message="No UX/accessibility issues in this category." />
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {filteredUX.map(issue => {
                const c = { critical:{border:T.red,color:T.red,icon:'circle-x'}, warning:{border:T.amber,color:T.amber,icon:'alert-triangle'}, info:{border:T.blue,color:T.blue,icon:'info-circle'} }[issue.severity]||{border:T.blue,color:T.blue,icon:'info-circle'}
                return (
                  <div key={issue.id} style={{ background:T.bg1, border:`1px solid ${c.border}33`, borderLeft:`3px solid ${c.border}`, borderRadius:12, padding:'1rem 1.25rem' }}>
                    <div style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:10 }}>
                      <i className={`ti ti-${c.icon}`} aria-hidden="true" style={{ fontSize:15, color:c.color, marginTop:2, flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:4 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:T.text0 }}>{issue.title}</span>
                          <Pill color={c.color}>{issue.severity}</Pill>
                          <Pill color={T.text2}>{issue.category}</Pill>
                        </div>
                        <p style={{ fontSize:12, color:T.text1, lineHeight:1.6, margin:0 }}>{issue.description}</p>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
                      <div style={{ background:T.bg3, borderRadius:8, padding:'0.75rem' }}>
                        <div style={{ fontSize:10, fontWeight:600, color:T.text2, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>Element</div>
                        <code style={{ fontSize:11, color:T.purple, wordBreak:'break-all', fontFamily:mono }}>{issue.element}</code>
                      </div>
                      <div style={{ background:T.greenDim, border:`1px solid ${T.green}33`, borderRadius:8, padding:'0.75rem' }}>
                        <div style={{ fontSize:10, fontWeight:600, color:T.green, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>How to fix</div>
                        <span style={{ fontSize:12, color:T.text0 }}>{issue.fix}</span>
                      </div>
                    </div>
                    <div style={{ marginTop:8, fontSize:11, color:T.blue, display:'flex', alignItems:'center', gap:5 }}>
                      <i className="ti ti-trending-up" aria-hidden="true" style={{ fontSize:12 }} />
                      <strong>Impact:</strong> {issue.impact}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== OPTIMIZE ==================== */}
      {activeTab === 'optimize' && (
        <div style={{ animation:'fadeUp 0.3s ease' }}>
          <Section title="Optimization roadmap" icon="rocket" style={{ marginBottom:'1rem' }}>
            <p style={{ fontSize:12, color:T.text2, lineHeight:1.7, marginBottom:'1rem' }}>
              Prioritized by estimated impact on performance and search rankings.
            </p>
            {data.optimizationPath.length===0 ? (
              <AlertChip type="pass" message="No major optimizations needed — excellent results across all categories!" />
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {data.optimizationPath.map((item,i) => {
                  const pc = { high:{color:T.red,dim:T.redDim}, medium:{color:T.amber,dim:T.amberDim}, low:{color:T.green,dim:T.greenDim} }[item.priority]||{color:T.green,dim:T.greenDim}
                  return (
                    <div key={i} style={{ borderLeft:`3px solid ${pc.color}`, borderRadius:10, padding:'1rem 1.25rem', background:T.bg2, border:`1px solid ${pc.color}33` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:6, marginBottom:6 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <Pill color={pc.color}>{item.priority.toUpperCase()}</Pill>
                          <Pill color={T.text2}>{item.category}</Pill>
                        </div>
                        <span style={{ fontSize:11, color:T.green, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                          <i className="ti ti-trending-up" aria-hidden="true" style={{ fontSize:12 }} /> {item.estimatedGain}
                        </span>
                      </div>
                      <div style={{ fontSize:13, fontWeight:600, color:T.text0, marginBottom:4 }}>{item.title}</div>
                      <div style={{ fontSize:12, color:T.text1, lineHeight:1.6 }}>{item.description}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          <Section title="Resource-level suggestions" icon="bulb">
            {(t.resourceDetails||[]).filter(r=>r.optimizations.length>0).slice(0,15).map((r,i) => (
              <div key={i} style={{ borderBottom:`1px solid ${T.border}`, padding:'10px 0' }}>
                <div style={{ fontSize:11, color:T.text1, marginBottom:4, wordBreak:'break-all', fontFamily:mono, display:'flex', gap:6 }}>
                  <span style={{ color:typeColor[r.type]||T.text2 }}>
                    <i className={`ti ti-${typeIcon[r.type]||'file'}`} aria-hidden="true" style={{ fontSize:11 }} /> {r.type}
                  </span>
                  {r.url.substring(0,80)}{r.url.length>80?'…':''}
                  <span style={{ fontWeight:600, color:T.text0 }}>{fmtBytes(r.size)}</span>
                </div>
                {r.optimizations.map((opt,j) => (
                  <div key={j} style={{ fontSize:11, color:T.blue, display:'flex', alignItems:'flex-start', gap:5, marginTop:3 }}>
                    <i className="ti ti-arrow-right" aria-hidden="true" style={{ fontSize:10, marginTop:1, flexShrink:0 }} /> {opt}
                  </div>
                ))}
              </div>
            ))}
          </Section>
        </div>
      )}

      {/* ==================== META ==================== */}
      {activeTab === 'meta' && (
        <div style={{ animation:'fadeUp 0.3s ease' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
            <Section title="Title tag" icon="tag">
              <div style={{ background:T.bg3, borderRadius:8, padding:'10px 12px', fontSize:13, marginBottom:10, wordBreak:'break-all', lineHeight:1.6, color:T.text0, fontFamily:mono }}>
                {a.meta.title||<em style={{ color:T.text2 }}>Not set</em>}
              </div>
              <DataRow label="Length"  value={`${a.meta.title?.length||0} chars`} status={a.meta.title?.length>=30&&a.meta.title?.length<=60?'pass':'warn'} icon="ruler" />
              <DataRow label="Optimal" value="30–60 chars" icon="target" />
              {keyword && <DataRow label="Keyword" value={a.meta.title?.toLowerCase().includes(keyword)?'Present ✓':'Missing ✗'} status={a.meta.title?.toLowerCase().includes(keyword)?'pass':'warn'} icon="key" />}
              <MiniBar value={a.meta.title?.length||0} max={80} color={a.meta.title?.length>=30&&a.meta.title?.length<=60?T.green:T.amber} />
            </Section>

            <Section title="Meta description" icon="align-left">
              <div style={{ background:T.bg3, borderRadius:8, padding:'10px 12px', fontSize:12, marginBottom:10, wordBreak:'break-all', lineHeight:1.6, color:T.text0 }}>
                {a.meta.description||<em style={{ color:T.text2 }}>Not set</em>}
              </div>
              <DataRow label="Length"  value={`${a.meta.description?.length||0} chars`} status={a.meta.description?.length>=120&&a.meta.description?.length<=160?'pass':'warn'} icon="ruler" />
              <DataRow label="Optimal" value="120–160 chars" icon="target" />
              {keyword && <DataRow label="Keyword" value={a.meta.description?.toLowerCase().includes(keyword)?'Present ✓':'Missing ✗'} status={a.meta.description?.toLowerCase().includes(keyword)?'pass':'warn'} icon="key" />}
              <MiniBar value={a.meta.description?.length||0} max={200} color={a.meta.description?.length>=120&&a.meta.description?.length<=160?T.green:T.amber} />
            </Section>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
            <Section title="Open Graph / Social" icon="share">
              <DataRow label="og:title"       value={a.social.ogTitle||'Missing'}       status={a.social.ogTitle?'pass':'warn'} icon="brand-facebook" />
              <DataRow label="og:description" value={a.social.ogDescription||'Missing'} status={a.social.ogDescription?'pass':'warn'} icon="align-left" />
              <DataRow label="og:image"       value={a.social.ogImage?'Set ✓':'Missing ✗'} status={a.social.ogImage?'pass':'warn'} icon="photo" />
              <DataRow label="og:type"        value={a.social.ogType||'Not set'}        icon="tag" />
              <DataRow label="twitter:card"   value={a.social.twitterCard||'Not set'}   icon="brand-twitter" />
              <DataRow label="twitter:title"  value={a.social.twitterTitle||'Not set'}  icon="tag" />
            </Section>

            <Section title="Technical meta" icon="settings-2">
              <DataRow label="Canonical"   value={a.meta.canonical||'Not set'} status={a.meta.canonical?'pass':'warn'} icon="link" />
              <DataRow label="Viewport"    value={a.meta.viewport||'Not set'}  status={a.meta.viewport?'pass':'warn'} icon="device-tablet" />
              <DataRow label="Robots meta" value={a.meta.robots||'Not set'}    icon="robot" />
              <DataRow label="Lang"        value={a.meta.lang||'Not set'}      status={a.meta.lang?'pass':'warn'} icon="world" />
              <DataRow label="Charset"     value={a.meta.charset||'Not set'}   status={a.meta.charset?'pass':'warn'} icon="letter-case" />
              <DataRow label="Theme color" value={a.meta.themeColor||'Not set'} icon="color-swatch" />
            </Section>
          </div>

          <Section title="Structured data (Schema.org)" icon="code-circle">
            {a.schema ? (
              a.schema.map((s,i) => (
                <div key={i} style={{ background:T.bg3, borderRadius:8, padding:'10px 12px', marginBottom:8, border:`1px solid ${T.border}` }}>
                  <div style={{ fontSize:12, fontWeight:600, color:T.blue, marginBottom:6 }}>{s['@type']||'Unknown'}</div>
                  <pre style={{ fontSize:11, color:T.text1, whiteSpace:'pre-wrap', wordBreak:'break-all', margin:0, lineHeight:1.6, fontFamily:mono }}>
                    {JSON.stringify(s,null,2).substring(0,400)}{JSON.stringify(s).length>400?'\n…':''}
                  </pre>
                </div>
              ))
            ) : (
              <AlertChip type="warn" message="No structured data found. Add Schema.org JSON-LD to enable rich results (star ratings, FAQs, breadcrumbs)." />
            )}
          </Section>
        </div>
      )}

      {/* ==================== CONTENT ==================== */}
      {activeTab === 'content' && (
        <div style={{ animation:'fadeUp 0.3s ease' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8, marginBottom:'1rem' }}>
            {[
              { l:'Words',      v:a.content.wordCount,  c:a.content.wordCount>=600?T.green:T.amber },
              { l:'Read time',  v:a.content.readTimeMinutes+' min', c:T.blue },
              { l:'H1 count',   v:a.headings.h1Count,   c:a.headings.h1Count===1?T.green:T.red },
              { l:'H2 count',   v:a.headings.h2Count,   c:T.text1 },
              { l:'H3 count',   v:a.headings.h3Count,   c:T.text1 },
              { l:'Images',     v:a.images.total,        c:T.amber },
              { l:'Missing alt',v:a.images.missingAlt,   c:a.images.missingAlt===0?T.green:T.red },
              { l:'Lazy loaded',v:a.images.lazyLoaded,   c:T.teal },
            ].map(m => (
              <div key={m.l} style={{ background:T.bg1, border:`1px solid ${T.border}`, borderRadius:12, padding:'1rem' }}>
                <div style={{ fontSize:10, color:T.text2, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600 }}>{m.l}</div>
                <div style={{ fontSize:22, fontWeight:300, color:m.c, letterSpacing:'-0.02em' }}>{m.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
            {[
              { title:'H1', count:a.headings.h1Count, items:a.headings.h1, color:T.blue },
              { title:'H2', count:a.headings.h2Count, items:a.headings.h2, color:T.teal },
              { title:'H3', count:a.headings.h3Count, items:a.headings.h3, color:T.purple },
            ].map(h => (
              <Section key={h.title} title={`${h.title} headings (${h.count})`} icon="heading">
                {h.items.length===0 ? (
                  <AlertChip type={h.title==='H1'?'fail':'warn'} message="None found" />
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {h.items.slice(0,8).map((text,i) => (
                      <div key={i} style={{ fontSize:11, padding:'5px 8px', background:T.bg3, borderRadius:7, color:T.text0, wordBreak:'break-word', borderLeft:`2px solid ${h.color}`, fontFamily:mono }}>
                        {text.substring(0,60)}{text.length>60?'…':''}
                      </div>
                    ))}
                    {h.items.length>8 && <div style={{ fontSize:10, color:T.text2 }}>+{h.items.length-8} more</div>}
                  </div>
                )}
              </Section>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <Section title="Images" icon="photo">
              <DataRow label="Total"      value={a.images.total} icon="photo" />
              <DataRow label="Missing alt" value={a.images.missingAlt} status={a.images.missingAlt===0?'pass':'fail'} icon="photo-off" />
              <DataRow label="Lazy loaded" value={a.images.lazyLoaded} icon="rocket" />
              <DataRow label="Oversized"  value={a.images.oversized} status={a.images.oversized===0?'pass':'warn'} icon="arrow-up" />
              <DataRow label="Alt coverage" value={a.images.total>0?`${Math.round((1-a.images.missingAlt/a.images.total)*100)}%`:'N/A'} status={a.images.missingAlt===0?'pass':'warn'} icon="percentage" />
              <MiniBar value={a.images.total-a.images.missingAlt} max={a.images.total||1} color={T.green} />
            </Section>

            <Section title="Links" icon="link">
              <DataRow label="Total"    value={a.links.total} icon="link" />
              <DataRow label="Internal" value={a.links.internal} icon="arrow-right" />
              <DataRow label="External" value={a.links.external} icon="external-link" />
              <DataRow label="Nofollow" value={a.links.nofollow} icon="ban" />
              <DataRow label="Empty"    value={a.links.emptyLinks} status={a.links.emptyLinks===0?'pass':'warn'} icon="link-off" />
              <DataRow label="Int. ratio" value={a.links.total>0?`${Math.round(a.links.internal/a.links.total*100)}%`:'—'} icon="chart-pie" />
            </Section>
          </div>
        </div>
      )}

      {/* ==================== TECHNICAL ==================== */}
      {activeTab === 'tech' && (
        <div style={{ animation:'fadeUp 0.3s ease' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
            <Section title="Server & security" icon="server">
              <DataRow label="HTTPS"       value={t.isHttps?'Enabled ✓':'Disabled ✗'} status={t.isHttps?'pass':'fail'} icon="lock" />
              <DataRow label="HTTP status" value={data.status} status={data.status>=200&&data.status<300?'pass':'fail'} icon="server-2" />
              <DataRow label="Device"      value={data.deviceType} icon="device-desktop" />
              <DataRow label="Protocol"    value={t.isHttps?'HTTPS':'HTTP'} status={t.isHttps?'pass':'fail'} icon="shield" />
            </Section>

            <Section title="Crawlability" icon="robot">
              <DataRow label="robots.txt"  value={t.robotsStatus===200?'Found (200)':'Not found'} status={t.robotsStatus===200?'pass':'warn'} icon="robot" />
              <DataRow label="XML sitemap" value={t.sitemapStatus===200?'Found (200)':'Not found'} status={t.sitemapStatus===200?'pass':'warn'} icon="sitemap" />
              <DataRow label="Canonical"   value={a.meta.canonical?'Set ✓':'Missing'} status={a.meta.canonical?'pass':'warn'} icon="link" />
              <DataRow label="Robots meta" value={a.meta.robots||'Not set'} icon="tag" />
              <DataRow label="Lang tag"    value={a.meta.lang||'Not set'} status={a.meta.lang?'pass':'warn'} icon="world" />
            </Section>
          </div>

          <Section title="DOM & render-blocking" icon="device-desktop" style={{ marginBottom:'1rem' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              <div>
                <DataRow label="DOM nodes"  value={a.performance.domNodes} status={a.performance.domNodes<1500?'pass':a.performance.domNodes<3000?'warn':'fail'} icon="hierarchy" />
                <DataRow label="Blocking scripts" value={a.performance.syncScripts} status={a.performance.syncScripts===0?'pass':'fail'} icon="brand-javascript" />
                <DataRow label="Stylesheets" value={a.performance.stylesheets} icon="palette" />
              </div>
              <div>
                {a.performance.syncScripts>0 && <AlertChip type="fail" message={`${a.performance.syncScripts} render-blocking script(s). Add async or defer.`} />}
                {a.performance.domNodes>3000  && <AlertChip type="warn" message="Large DOM (3000+ nodes) increases style recalculation time." />}
                {a.performance.syncScripts===0 && <AlertChip type="pass" message="No render-blocking scripts detected in <head>." />}
              </div>
            </div>
          </Section>

          <Section title="JavaScript rendering (SSR check)" icon="code-circle">
            <DataRow label="SSR HTML length" value={`${t.ssrLength} chars`}  status={t.ssrLength>5000?'pass':'warn'} icon="server" />
            <DataRow label="JS rendering"    value={t.ssrLength>5000?'Probably not needed':'Likely required'} status={t.ssrLength>5000?'pass':'warn'} icon="brand-javascript" />
            <div style={{ marginTop:10 }}>
              {t.ssrLength>5000 ? (
                <AlertChip type="pass" message="Good SSR signals — substantial HTML delivered before JS runs." />
              ) : (
                <AlertChip type="warn" message="Minimal pre-JS HTML suggests CSR. Google can crawl JS but adds an indexing delay. Consider Next.js SSR or SSG." />
              )}
            </div>
          </Section>
        </div>
      )}

      {/* ==================== SCREENSHOT ==================== */}
      {activeTab === 'screenshot' && (
        <div style={{ display:'grid', gridTemplateColumns:data.mobileScreenshot?'2fr 1fr':'1fr', gap:'1rem', animation:'fadeUp 0.3s ease' }}>
          <Section title="Desktop screenshot" icon="device-desktop">
            {data.clientScreenshot ? (
              <img src={data.clientScreenshot} alt="Desktop page screenshot" style={{ width:'100%', borderRadius:8, display:'block' }} />
            ) : (
              <div style={{ padding:'2rem', textAlign:'center', color:T.text2, fontSize:12 }}>No screenshot available</div>
            )}
          </Section>
          {data.mobileScreenshot && (
            <Section title="Mobile screenshot" icon="device-mobile">
              <img src={data.mobileScreenshot} alt="Mobile page screenshot" style={{ width:'100%', borderRadius:8, display:'block' }} />
            </Section>
          )}
        </div>
      )}
    </div>
  )
}