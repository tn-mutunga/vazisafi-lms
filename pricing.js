// Price models for Wash & Fold. One model is active at a time; it prices every
// kg-based laundry line for student and normal customers. Corporate (and any tier
// a model leaves out) falls back to the service's own tier price.
// Rule shapes: { base, upTo, extra }  → flat base up to `upTo` kg, then `extra`/kg
//              { rate, min }          → rate × kg, never below `min` (min 0 = none)
window.SAFI_PRICING = (() => {
  const DEFAULTS = [
    { id: 'current', name: 'Current', label: 'Flat charge up to 7 kg', desc: 'Students KES 700 up to 7 kg, then 90/kg. Normal clients KES 850 up to 7 kg, then 100/kg. Revenue growth: 0% (baseline).',
      rules: { student: { base: 700, upTo: 7, extra: 90 }, normal: { base: 850, upTo: 7, extra: 100 } } },
    { id: 'M7', name: 'M7', label: 'Student-friendly', desc: 'Students KES 100/kg, min 600 (+1.0%). Normal clients KES 135/kg, min 600 (+10.2%). Revenue growth: +6.6%.', focus: true,
      rules: { student: { rate: 100, min: 600 }, normal: { rate: 135, min: 600 } } },
    { id: 'M2', name: 'M2', label: 'Gentle all-round', desc: 'Students KES 110/kg, min 500 (+9.3%). Normal clients KES 130/kg, min 600 (+6.4%). Revenue growth: +7.5%.',
      rules: { student: { rate: 110, min: 500 }, normal: { rate: 130, min: 600 } } },
    { id: 'M6', name: 'M6', label: 'Higher revenue', desc: 'Students KES 110/kg, min 500 (+9.3%). Normal clients KES 135/kg, min 600 (+10.2%). Revenue growth: +9.8%.',
      rules: { student: { rate: 110, min: 500 }, normal: { rate: 135, min: 600 } } },
  ];
  const S = () => (window.SAFI_STORE && window.SAFI_STORE.getSettings ? window.SAFI_STORE.getSettings() : null) || {};
  const models = () => S().priceModels || DEFAULTS;
  const activeId = () => S().activePriceModel || 'current';
  const active = () => models().find(m => m.id === activeId()) || null;
  const applies = svc => !!svc && svc.id === 'wash-fold';
  function charge(rule, kg) {
    kg = Number(kg) || 0;
    if (kg <= 0) return 0;
    if (rule.base != null) return Math.round(rule.base + Math.max(0, kg - (rule.upTo || 0)) * (rule.extra || 0));
    return Math.round(Math.max(rule.min || 0, kg * (rule.rate || 0)));
  }
  function describe(rule) {
    if (!rule) return 'Service price';
    if (rule.studentDay) return `KES ${rule.rate}/kg · Student Thursday`;
    if (rule.base != null) return `KES ${rule.base} up to ${rule.upTo} kg, +${rule.extra}/kg after`;
    return `KES ${rule.rate}/kg` + (rule.min ? `, min ${rule.min}` : '');
  }
  // Amount for one order line. customPrice (manual override) always wins.
  function line(svc, qty, group, customPrice, model) {
    const q = Number(qty) || 0;
    if (customPrice != null) return Math.round(customPrice * q);
    const m = model === undefined ? active() : model;
    const rule = model === undefined ? ruleFor(svc, group) : (m && applies(svc) ? m.rules[group] : null);
    if (rule) return charge(rule, q);
    return Math.round(((svc && svc.tiers && svc.tiers[group]) || 0) * q);
  }
  // Student Thursday: on Thursdays, students pay a flat per-kg rate for Wash & Fold,
  // whatever model is active. Any other day the active model applies.
  const studentDay = () => ({ on: true, rate: 110, day: 4, ...(S().studentDay || {}) });
  const studentDayLive = (d = new Date()) => { const sd = studentDay(); return sd.on && d.getDay() === sd.day; };
  function ruleFor(svc, group) {
    if (!applies(svc)) return null;
    if (group === 'student' && studentDayLive()) return { rate: studentDay().rate, min: 0, studentDay: true };
    const m = active(); return m ? m.rules[group] || null : null;
  }
  return { DEFAULTS, models, activeId, active, applies, charge, describe, line, ruleFor, studentDay, studentDayLive };
})();
