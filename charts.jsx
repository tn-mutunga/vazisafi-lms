// Vazi Safi — interactive bar chart with a labelled y axis, grid lines and hover values.
// series: [{ name, color, values: number[] }]; labels: string[] (one per bar group).
const { useState: useStateCh } = React;

function niceScale(max, ticks = 4) {
  if (!max || max <= 0) return { top: ticks, step: 1 };
  const raw = max / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  return { top: step * ticks, step };
}
const shortNum = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(Math.round(v));
};

function SafiChart({ labels, series, height = 240, fmt, yLabel, highlight, sparseLabels, integer, area, labelEvery }) {
  const [hover, setHover] = useStateCh(null);
  const max = Math.max(0, ...series.flatMap(s => s.values));
  let { top, step } = niceScale(max);
  if (integer) { step = Math.max(1, Math.ceil(step)); top = step * Math.max(1, Math.ceil(max / step)); }
  const ticks = []; for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  const f = fmt || ((v) => Math.round(v).toLocaleString('en-KE'));
  const n = labels.length;
  const every = labelEvery || (sparseLabels ? Math.ceil(n / 16) : 1);
  // Area mode: smooth translucent layers drawn in a 0–100 box, so colours show through each other.
  const pt = (v, i) => [n > 1 ? (i / (n - 1)) * 100 : 50, 100 - (v / top) * 100];
  const areaPath = (vals) => { const p = vals.map(pt); let d = `M${p[0][0]},100 L${p[0][0]},${p[0][1]}`; for (let i = 1; i < p.length; i++) { const [x0, y0] = p[i - 1], [x1, y1] = p[i], cx = (x0 + x1) / 2; d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`; } return d + ` L${p[p.length - 1][0]},100 Z`; };
  const linePath = (vals) => { const p = vals.map(pt); let d = `M${p[0][0]},${p[0][1]}`; for (let i = 1; i < p.length; i++) { const [x0, y0] = p[i - 1], [x1, y1] = p[i], cx = (x0 + x1) / 2; d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`; } return d; };
  return (
    <div className="safi-ch" style={{ '--ch-h': height + 'px' }}>
      {yLabel && <div className="safi-ch__ylabel">{yLabel}</div>}
      <div className="safi-ch__axis">
        {ticks.slice().reverse().map(v => <span key={v} style={{ bottom: `${(v / top) * 100}%` }}>{shortNum(v)}</span>)}
      </div>
      <div className="safi-ch__plot" onMouseLeave={() => setHover(null)}>
        {ticks.map(v => <i key={v} className="safi-ch__grid" style={{ bottom: `${(v / top) * 100}%` }}/>)}
        {area && n > 0 && (
          <svg className="safi-ch__area" viewBox="0 0 100 100" preserveAspectRatio="none">
            {series.map(s => <path key={s.name + 'a'} d={areaPath(s.values)} fill={s.color} fillOpacity="0.28"/>)}
            {series.map(s => <path key={s.name + 'l'} d={linePath(s.values)} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}
            {hover != null && <line x1={pt(0, hover)[0]} x2={pt(0, hover)[0]} y1="0" y2="100" stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke"/>}
          </svg>
        )}
        <div className={`safi-ch__bars${area ? ' is-area' : ''}`} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {labels.map((lb, i) => (
            <div key={i} className={`safi-ch__col${hover === i ? ' is-hover' : ''}${highlight === i ? ' is-hl' : ''}`} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <div className="safi-ch__grp">
                {!area && series.map(s => <div key={s.name} className="safi-ch__bar" style={{ height: `${(s.values[i] / top) * 100}%`, background: s.color }}/>)}
              </div>
              {hover === i && (
                <div className={`safi-ch__tip${i > n * 0.66 ? ' is-left' : i < n * 0.2 ? ' is-right' : ''}`}>
                  <b>{lb}</b>
                  {series.map(s => <div key={s.name}><i style={{ background: s.color }}/>{s.name}<span className="safi-mono">{f(s.values[i])}</span></div>)}
                  {series.length === 2 && /revenue/i.test(series[0].name) && /expens/i.test(series[1].name) && (() => { const d = (series[0].values[i] || 0) - (series[1].values[i] || 0); return <div className="safi-ch__tip-pl"><i style={{ background: d >= 0 ? '#16a34a' : '#dc2626' }}/>{d >= 0 ? 'Profit' : 'Loss'}<span className="safi-mono" style={{ color: d >= 0 ? '#4ade80' : '#f87171' }}>{d < 0 ? '−' : ''}{f(Math.abs(d))}</span></div>; })()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="safi-ch__x" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {labels.map((lb, i) => <span key={i} className={highlight === i ? 'is-hl' : ''}>{i % every === 0 ? lb : ''}</span>)}
      </div>
      {series.length > 1 && (
        <div className="safi-legend safi-ch__legend">{series.map(s => <span key={s.name}><i style={{ background: s.color }}/>{s.name}</span>)}</div>
      )}
    </div>
  );
}

Object.assign(window, { SafiChart, niceScale, shortNum });
