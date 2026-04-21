// Reemplazar con la URL real de API Gateway
const API_BASE = "/api";

const cop = n =>
  new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n);

const num = (n, d=0) =>
  new Intl.NumberFormat('es-CO', { maximumFractionDigits:d }).format(n);

async function calcular() {
  const btn     = document.getElementById('btnCalcular');
  const spinner = document.getElementById('spinner');
  const arrow   = document.getElementById('btn-arrow');
  const btnTxt  = document.getElementById('btn-text');
  const errMsg  = document.getElementById('errorMsg');

  errMsg.classList.add('hidden');
  btn.disabled    = true;
  spinner.style.display = 'block';
  arrow.style.display   = 'none';
  btnTxt.textContent    = 'Calculando...';

  const payload = {
    ciudad:            'Bogota',
    area_m2:           parseFloat(document.getElementById('area_m2').value),
    costo_instalacion: parseFloat(document.getElementById('costo_instalacion').value),
  };

  try {
    const resp = await fetch(`${API_BASE}/calcular`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `Error del servidor (${resp.status})`);
    }

    const data = await resp.json();
    renderResultados(data, payload);

  } catch (e) {
    errMsg.textContent = `❌ ${e.message}`;
    errMsg.classList.remove('hidden');
  } finally {
    btn.disabled          = false;
    spinner.style.display = 'none';
    arrow.style.display   = '';
    btnTxt.textContent    = 'Recalcular';
  }
}

// RENDER RESULTADOS

function renderResultados(d, p) {
  document.getElementById('estado-vacio').classList.add('hidden');
  document.getElementById('resultados').classList.remove('hidden');

  // Badge viable 
  document.getElementById('badge-viable').innerHTML = d.viable
    ? `<span class="badge-viable badge-si">✅ Proyecto VIABLE — VPN positivo</span>`
    : `<span class="badge-viable badge-no">❌ No recomendado — VPN negativo</span>`;

  // KPIs 
  const periodoStr = d.periodo_recuperacion_anos
    ? `${num(d.periodo_recuperacion_anos, 1)} años`
    : `> 20 años`;
  const tirStr = d.tir_porcentaje !== null
    ? `${num(d.tir_porcentaje, 2)} %`
    : 'N/A';

  const kpis = [
    { icon:'⚡', label:'Energía anual (año 1)',   valor: num(d.energia_anual_kwh) + ' kWh' },
    { icon:'💰', label:'Ahorro anual estimado',   valor: cop(d.ahorro_anual_cop) },
    { icon:'📈', label:'VPN del proyecto',        valor: cop(d.vpn_cop) },
    { icon:'⏱', label:'Período de recuperación', valor: periodoStr },
    { icon:'💹', label:'TIR',                     valor: tirStr },
    { icon:'📉', label:'Degradación anual',       valor: `${num(d.factor_degradacion_anual * 100, 1)} %` },
  ];

  document.getElementById('kpi-grid').innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div style="font-size:1.5rem;margin-bottom:.5rem;">${k.icon}</div>
      <div class="kpi-value">${k.valor}</div>
      <div class="kpi-label">${k.label}</div>
    </div>`).join('');

  // Datos para gráficos 
  const anos    = d.flujo_caja.map(f => `Año ${f.ano}`);
  const vpnAcum = d.flujo_caja.map(f => f.vp_acumulado_cop);
  const energia = d.flujo_caja.map(f => f.energia_kwh);

  // Ahorro acumulado solar (sin descontar, para comparación directa vs red)
  let ahorroAcumSolar = 0;
  let pagoAcumRed     = 0;
  const ahorroAcumArr = [], pagoRedArr = [];
  // Costo total solar: instalación + mantenimiento simbólico (0)
  // Pago red: si no hubieran instalado paneles, pagarían el consumo equivalente
  d.flujo_caja.forEach(f => {
    ahorroAcumSolar += f.ahorro_cop;   // ahorro acumulado = lo que han dejado de pagar
    pagoAcumRed     += f.ahorro_cop;   // misma energía, pero pagada a la red
    ahorroAcumArr.push(ahorroAcumSolar);
    pagoRedArr.push(pagoAcumRed);
  });
  // Línea del costo total del sistema solar (inversión inicial, constante)
  const costoSistema = d.flujo_caja.map(() => d.costo_instalacion_cop);

  // Gráfico 1: VP Acumulado
  if (chartVPN) chartVPN.destroy();
  const ceroLine = anos.map(() => 0);
  chartVPN = new Chart(document.getElementById('chart-vpn-acum'), {
    type: 'line',
    data: {
      labels: anos,
      datasets: [
        {
          label: 'VP Acumulado',
          data: vpnAcum,
          borderColor: '#F59E0B',
          backgroundColor: (ctx) => {
            const g = ctx.chart.ctx.createLinearGradient(0,0,0,280);
            g.addColorStop(0,'rgba(245,158,11,0.18)');
            g.addColorStop(1,'rgba(245,158,11,0)');
            return g;
          },
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointBackgroundColor: '#F59E0B',
          pointRadius: 3,
          pointHoverRadius: 6,
        },
        {
          label: 'Punto de equilibrio',
          data: ceroLine,
          borderColor: 'rgba(110,231,183,0.4)',
          borderDash: [6,4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: chartOptions('COP', true)
  });

  // Gráfico 2: Ahorro solar acumulado vs pago red 
  if (chartComp) chartComp.destroy();
  chartComp = new Chart(document.getElementById('chart-comparativo'), {
    type: 'line',
    data: {
      labels: anos,
      datasets: [
        {
          label: 'Ahorro acumulado (solar)',
          data: ahorroAcumArr,
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245,158,11,0.06)',
          fill: true, tension: 0.4, borderWidth: 2.5,
          pointRadius: 3, pointHoverRadius: 6,
          pointBackgroundColor: '#F59E0B',
        },
        {
          label: 'Costo sistema solar (inversión)',
          data: costoSistema,
          borderColor: 'rgba(239,68,68,0.7)',
          backgroundColor: 'rgba(239,68,68,0.04)',
          borderDash: [8,4],
          fill: false, tension: 0, borderWidth: 2,
          pointRadius: 0, pointHoverRadius: 4,
        },
        {
          label: 'Pago acumulado a la red (sin solar)',
          data: pagoRedArr,
          borderColor: 'rgba(148,163,184,0.5)',
          backgroundColor: 'transparent',
          borderDash: [4,4],
          fill: false, tension: 0.4, borderWidth: 1.5,
          pointRadius: 0, pointHoverRadius: 4,
        }
      ]
    },
    options: chartOptions('COP', true)
  });

  // Gráfico 3: Energía por año barras
  if (chartEnerg) chartEnerg.destroy();
  chartEnerg = new Chart(document.getElementById('chart-energia'), {
    type: 'bar',
    data: {
      labels: anos,
      datasets: [{
        label: 'Energía generada (kWh)',
        data: energia,
        backgroundColor: anos.map((_, i) =>
          `rgba(245,158,11,${0.85 - i * (0.4 / anos.length)})`),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      ...chartOptions('kWh', false),
      plugins: {
        ...chartOptions('kWh', false).plugins,
        legend: { display: false }
      }
    }
  });

  // Tabla 
  let recuperado = false;
  document.getElementById('tabla-body').innerHTML = d.flujo_caja.map(f => {
    const esRec = !recuperado && f.vp_acumulado_cop >= 0;
    if (esRec) recuperado = true;
    return `<tr class="${esRec ? 'row-recovered' : ''}">
      <td>${f.ano}</td>
      <td>${num(f.energia_kwh)}</td>
      <td>${cop(f.ahorro_cop)}</td>
      <td>${cop(f.ahorro_vp_cop)}</td>
      <td>${cop(f.vp_acumulado_cop)}</td>
    </tr>`;
  }).join('');

  // Interpretación 
  const tasa = 0.12; // fija en el backend básico
  const textos = [];

  if (d.viable) {
    textos.push(`✅ <strong style="color:#6EE7B7">El proyecto es viable.</strong> El Valor Presente Neto positivo de ${cop(d.vpn_cop)} significa que, descontando el valor del dinero en el tiempo, la inversión genera riqueza real por encima de la tasa de oportunidad.`);
  } else {
    textos.push(`❌ <strong style="color:#FCA5A5">El proyecto no es viable</strong> bajo los supuestos actuales. El VPN negativo de ${cop(d.vpn_cop)} indica que el costo inicial no se compensa con los ahorros proyectados. Considera reducir el costo de instalación o evaluar un municipio con mayor radiación solar.`);
  }

  if (d.periodo_recuperacion_anos) {
    textos.push(`⏱ La inversión se recupera en aproximadamente <strong style="color:var(--amber)">${num(d.periodo_recuperacion_anos, 1)} años</strong>. A partir de ese momento, cada año genera un ahorro neto positivo para el propietario.`);
  }

  if (d.tir_porcentaje) {
    const mejor = d.tir_porcentaje > 12
      ? `superior a una tasa de oportunidad típica del 12%, lo que refuerza la recomendación de inversión.`
      : `inferior a la tasa de oportunidad del 12%, por lo que se recomienda evaluar alternativas de menor costo.`;
    textos.push(`💹 La TIR de <strong style="color:var(--amber)">${num(d.tir_porcentaje, 2)}%</strong> es ${mejor}`);
  }

  textos.push(`📉 La degradación anual de ${num(d.factor_degradacion_anual * 100, 1)}% de los paneles está incluida en las proyecciones, lo que hace el análisis más conservador y realista que un modelo de producción constante.`);

  document.getElementById('interpretacion-texto').innerHTML =
    textos.map(t => `<p>${t}</p>`).join('');

  // Scroll suave a resultados
  setTimeout(() => {
    document.getElementById('resultados').scrollIntoView({ behavior:'smooth', block:'start' });
  }, 150);
}