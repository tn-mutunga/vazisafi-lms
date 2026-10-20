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

function SafiChart({ labels, series, height = 240, fmt, yLabel, highlight, sparseLabels, integer }) {
  const [hover, setHover] = useStateCh(null);
  const max = Math.max(0, ...series.flatMap(s => s.values));
  let { top, step } = niceScale(max);
  if (integer) { step = Math.max(1, Math.ceil(step)); top = step * Math.max(1, Math.ceil(max / step)); }
  const ticks = []; for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  const f = fmt || ((v) => Math.round(v).toLocaleString('en-KE'));
  const n = labels.length;
  const every = sparseLabels ? Math.ceil(n / 16) : 1;
  return (
    <div className="safi-ch" style={{ '--ch-h': height + 'px' }}>
      {yLabel && <div className="safi-ch__ylabel">{yLabel}</div>}
      <div className="safi-ch__axis">
        {ticks.slice().reverse().map(v => <span key={v} style={{ bottom: `${(v / top) * 100}%` }}>{shortNum(v)}</span>)}
      </div>
      <div className="safi-ch__plot" onMouseLeave={() => setHover(null)}>
        {ticks.map(v => <i key={v} className="safi-ch__grid" style={{ bottom: `${(v / top) * 100}%` }}/>)}
        <div className="safi-ch__bars" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {labels.map((lb, i) => (
            <div key={i} className={`safi-ch__col${hover === i ? ' is-hover' : ''}${highlight === i ? ' is-hl' : ''}`} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <div className="safi-ch__grp">
                {series.map(s => <div key={s.name} className="safi-ch__bar" style={{ height: `${(s.values[i] / top) * 100}%`, background: s.color }}/>)}
              </div>
              {hover === i && (
                <div className={`safi-ch__tip${i > n * 0.66 ? ' is-left' : i < n * 0.2 ? ' is-right' : ''}`}>
                  <b>{lb}</b>
                  {series.map(s => <div key={s.name}><i style={{ background: s.color }}/>{s.name}<span className="safi-mono">{f(s.values[i])}</span></div>)}
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
