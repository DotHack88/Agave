/* ============================
   AgaveWMS – Mini Chart Engine
   Canvas-based, no dependencies
   ============================ */
const Charts = (() => {
  function getColors() {
    const s = getComputedStyle(document.documentElement);
    const isDark = document.body.classList.contains('dark');
    return {
      primary: '#10b981', green: '#34d399', red: '#ef4444',
      yellow: '#f59e0b', blue: '#3b82f6',
      grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      text: isDark ? '#8b92a8' : '#4a5068',
      bg: isDark ? '#1e2536' : '#e8ecf4'
    };
  }

  function clearCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    return ctx;
  }

  /* ── BAR CHART ── */
  function bar(canvasId, data, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = clearCanvas(canvas);
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    const C = getColors();
    const pad = { top:20, right:16, bottom:40, left:40 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const labels = data.labels || [];
    const datasets = data.datasets || [];
    const allVals = datasets.flatMap(d => d.values);
    const maxVal = Math.max(...allVals, 1);
    const step = Math.ceil(maxVal / 4);
    const nBars = datasets.length;
    const groupW = chartW / labels.length;
    const barW = Math.min((groupW / nBars) - 4, 28);

    // Grid lines
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartH - (chartH * i / 4);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
      ctx.fillStyle = C.text; ctx.font = '10px Inter,sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText((step * i).toString(), pad.left - 6, y + 4);
    }

    // Bars
    labels.forEach((label, gi) => {
      datasets.forEach((ds, di) => {
        const val = ds.values[gi] || 0;
        const barH = (val / maxVal) * chartH;
        const x = pad.left + gi * groupW + di * (barW + 2) + (groupW - nBars*(barW+2)) / 2;
        const y = pad.top + chartH - barH;
        const color = ds.color || C.primary;
        // Gradient fill
        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, color);
        grad.addColorStop(1, color + '55');
        ctx.fillStyle = grad;
        const r = Math.min(4, barW/2);
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.lineTo(x + barW - r, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
        ctx.lineTo(x + barW, y + barH); ctx.lineTo(x, y + barH); ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath(); ctx.fill();
        // Value label
        if (val > 0) {
          ctx.fillStyle = color; ctx.font = 'bold 9px Inter,sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(val, x + barW/2, y - 4);
        }
      });
      // X label
      ctx.fillStyle = C.text; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(label, pad.left + gi * groupW + groupW/2, H - 8);
    });

    // Legend
    if (datasets.length > 1) {
      let lx = pad.left;
      datasets.forEach(ds => {
        ctx.fillStyle = ds.color || C.primary;
        ctx.fillRect(lx, 4, 10, 10);
        ctx.fillStyle = C.text; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(ds.label || '', lx + 14, 13);
        lx += (ds.label?.length || 0) * 6 + 28;
      });
    }
  }

  /* ── LINE CHART ── */
  function line(canvasId, data, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = clearCanvas(canvas);
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    const C = getColors();
    const pad = { top:20, right:16, bottom:36, left:44 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;
    const labels = data.labels || [];
    const datasets = data.datasets || [];
    const allVals = datasets.flatMap(d => d.values);
    const maxVal = Math.max(...allVals, 1);
    const n = labels.length;

    // Grid
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartH - (chartH * i / 4);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
      ctx.fillStyle = C.text; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal * i / 4), pad.left - 6, y + 4);
    }

    // X labels
    labels.forEach((l, i) => {
      const x = pad.left + (n > 1 ? i / (n-1) : 0.5) * chartW;
      ctx.fillStyle = C.text; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(l, x, H - 6);
    });

    // Lines + area
    datasets.forEach(ds => {
      const color = ds.color || C.primary;
      const pts = ds.values.map((v, i) => ({
        x: pad.left + (n > 1 ? i/(n-1) : 0.5) * chartW,
        y: pad.top + chartH - (v / maxVal) * chartH
      }));

      // Area fill
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.lineTo(pts[pts.length-1].x, pad.top + chartH);
      ctx.lineTo(pts[0].x, pad.top + chartH);
      ctx.closePath();
      const agrad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
      agrad.addColorStop(0, color + '33'); agrad.addColorStop(1, color + '00');
      ctx.fillStyle = agrad; ctx.fill();

      // Line
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();

      // Dots
      pts.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
        ctx.fillStyle = color; ctx.fill();
        ctx.strokeStyle = C.bg; ctx.lineWidth = 2; ctx.stroke();
      });
    });

    // Legend
    if (datasets.length > 1) {
      let lx = pad.left;
      datasets.forEach(ds => {
        ctx.strokeStyle = ds.color || C.primary; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(lx, 12); ctx.lineTo(lx + 16, 12); ctx.stroke();
        ctx.fillStyle = C.text; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(ds.label || '', lx + 20, 16);
        lx += (ds.label?.length || 0) * 6 + 36;
      });
    }
  }

  /* ── DONUT CHART ── */
  function donut(canvasId, data, opts = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = clearCanvas(canvas);
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    const C = getColors();
    const colors = [C.primary, C.green, C.yellow, C.blue, C.red, '#8b5cf6','#ec4899','#14b8a6'];
    const total = data.values.reduce((s,v)=>s+v,0);
    if (!total) return;
    const cx = W * 0.4, cy = H / 2, r = Math.min(cx, cy) - 16, innerR = r * 0.55;
    let startAngle = -Math.PI / 2;

    data.values.forEach((val, i) => {
      const sweep = (val / total) * Math.PI * 2;
      const color = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + sweep);
      ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
      // Separator
      ctx.strokeStyle = C.bg; ctx.lineWidth = 2; ctx.stroke();
      startAngle += sweep;
    });

    // Inner circle
    ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI*2);
    ctx.fillStyle = C.bg; ctx.fill();

    // Center text
    ctx.fillStyle = C.text; ctx.font = 'bold 20px Inter,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(total, cx, cy + 6);
    ctx.font = '11px Inter,sans-serif'; ctx.fillStyle = C.text.replace('a8','3');
    ctx.fillText('totale', cx, cy + 22);

    // Legend
    const lx = W * 0.72; let ly = (H - data.labels.length * 22) / 2;
    data.labels.forEach((label, i) => {
      const color = colors[i % colors.length];
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(lx, ly + 5, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = C.text; ctx.font = '11px Inter,sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(label, lx + 12, ly + 9);
      ctx.fillStyle = color; ctx.font = 'bold 11px Inter,sans-serif';
      ctx.fillText(data.values[i], lx + 12, ly + 21);
      ly += 32;
    });
  }

  /* ── SPARKLINE ── */
  function sparkline(canvasId, values, color='#6366f1') {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !values?.length) return;
    const ctx = clearCanvas(canvas);
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const pts = values.map((v, i) => ({
      x: i / (values.length - 1) * W,
      y: H - ((v - min) / range) * (H - 4) - 2
    }));
    ctx.beginPath();
    pts.forEach((p, i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0, color+'55'); grad.addColorStop(1, color+'00');
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.stroke();
    // area
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
  }

  return { bar, line, donut, sparkline };
})();
