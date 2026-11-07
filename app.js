// ============================================================
//  CHECK MÉGANE 3 — App Logic
//  Renault Mégane 3 Grand Tour KZ1G · 1.5 dCi K9K 110cv (81 kW) · 2010
// ============================================================

// ---- DATA MODEL ----
const DB_KEY = 'megane3_data';

const defaultData = {
  currentKm: 0,
  maintenances: [],    // array of maintenance records
  checklistState: {},  // checklistItem.id -> { done, lastKm, lastDate }
  vehicle: {           // perfil do carro (VIN + dados do DUA)
    vin: '',
    powerKw: 81,
    engineCode: '',
    gearbox: 'Manual 6 velocidades',
    tyreFront: 2.3,
    tyreRear: 2.1
  },
  version: 1
};

// ---- MAINTENANCE SCHEDULE ----
const MAINTENANCE_ITEMS = [
  // Category: Motor
  {
    id: 'oil_change',
    category: 'motor',
    name: 'Troca de Óleo + Filtro de Óleo',
    intervalKm: 15000,
    intervalMonths: 12,
    critical: false,
    note: 'Óleo 5W-30 norma Renault RN0720 (ACEA C4) · ~4,5 litros'
  },
  {
    id: 'air_filter',
    category: 'motor',
    name: 'Filtro de Ar do Motor',
    intervalKm: 30000,
    intervalMonths: 24,
    critical: false,
    note: 'Verificar com cada troca de óleo, substituir se necessário'
  },
  {
    id: 'fuel_filter',
    category: 'motor',
    name: 'Filtro de Combustível (Diesel)',
    intervalKm: 30000,
    intervalMonths: 24,
    critical: false,
    note: 'Importante no diesel — água e impurezas danificam injetores'
  },
  {
    id: 'cabin_filter',
    category: 'motor',
    name: 'Filtro do Habitáculo (Pólen)',
    intervalKm: 15000,
    intervalMonths: 12,
    critical: false,
    note: 'Localizado atrás da caixa de luvas'
  },
  // Category: Distribuição (CRITICAL)
  {
    id: 'timing_belt',
    category: 'distribuicao',
    name: 'Correia de Distribuição + Roletes + Bomba de Água',
    intervalKm: 90000,
    intervalMonths: 60,
    critical: true,
    note: '⚠️ CRÍTICO: Falha destrói o motor. Substituir SEMPRE com roletes e bomba de água. A Renault indica ~120.000 km ou 5 anos; por segurança a app avisa aos 90.000 km. Confirmar no livro de manutenção.'
  },
  // Category: Fluidos
  {
    id: 'brake_fluid',
    category: 'fluidos',
    name: 'Fluido de Travões (DOT 4)',
    intervalKm: 60000,
    intervalMonths: 24,
    critical: false,
    note: 'Fluido higroscópico — absorve humidade. Testar ponto de ebulição'
  },
  {
    id: 'coolant',
    category: 'fluidos',
    name: 'Líquido de Refrigeração / Anticongelante',
    intervalKm: 0,
    intervalMonths: 48,
    critical: false,
    note: 'Glaceol RX Type D (azul). Verificar nível mensalmente'
  },
  // Category: Travões
  {
    id: 'brake_pads_front',
    category: 'travoes',
    name: 'Pastilhas de Travão Dianteiras',
    intervalKm: 40000,
    intervalMonths: 0,
    critical: false,
    note: 'Verificar espessura — mínimo 2mm. Geralmente 40.000–60.000 km'
  },
  {
    id: 'brake_pads_rear',
    category: 'travoes',
    name: 'Pastilhas de Travão Traseiras',
    intervalKm: 60000,
    intervalMonths: 0,
    critical: false,
    note: 'Traseiras duram mais. Verificar tambores/discos simultaneamente'
  },
  {
    id: 'brake_discs',
    category: 'travoes',
    name: 'Discos de Travão (verificação)',
    intervalKm: 80000,
    intervalMonths: 0,
    critical: false,
    note: 'Mínimo 22mm frente, 9mm traseiros. Verificar rugosidade'
  },
  // Category: Pneus
  {
    id: 'tyre_pressure',
    category: 'pneus',
    name: 'Pressão dos Pneus',
    intervalKm: 5000,
    intervalMonths: 1,
    critical: false,
    note: 'Dianteiros: 2.3 bar · Traseiros: 2.1 bar (a frio). Verificar o pneu sobressalente'
  },
  {
    id: 'tyre_rotation',
    category: 'pneus',
    name: 'Rotação e Alinhamento de Pneus',
    intervalKm: 15000,
    intervalMonths: 12,
    critical: false,
    note: 'Profundidade mínima legal: 1.6mm. Recomendado trocar a 3mm'
  },
  // Category: Suspensão
  {
    id: 'suspension',
    category: 'suspensao',
    name: 'Verificação Suspensão e Direção',
    intervalKm: 30000,
    intervalMonths: 24,
    critical: false,
    note: 'Amortecedores, silent-blocs, caixas de direção, braços'
  },
  // Category: Elétrico
  {
    id: 'glow_plugs',
    category: 'eletrico',
    name: 'Velas de Incandescência',
    intervalKm: 60000,
    intervalMonths: 48,
    critical: false,
    note: 'Diesel — essenciais para arranques a frio. Verificar se há hesitação ao arrancar'
  },
  {
    id: 'battery',
    category: 'eletrico',
    name: 'Bateria (verificação e carga)',
    intervalKm: 0,
    intervalMonths: 12,
    critical: false,
    note: 'Testar tensão em carga. Vida útil ~4-5 anos. 60Ah 12V'
  },
  {
    id: 'diagnostic',
    category: 'eletrico',
    name: 'Diagnóstico Eletrónico (leitura de falhas)',
    intervalKm: 30000,
    intervalMonths: 12,
    critical: false,
    note: 'Usar leitor OBD2 compatível Renault (ex: iCarsoft i930, Delphi DS150)'
  },
  // Category: Segurança
  {
    id: 'lights',
    category: 'seguranca',
    name: 'Verificação de Luzes (todas)',
    intervalKm: 5000,
    intervalMonths: 2,
    critical: false,
    note: 'Médios, máximos, nevoeiro, indicadores, travagem, marcha atrás'
  },
  {
    id: 'wipers',
    category: 'seguranca',
    name: 'Escovas do Limpa-Vidros',
    intervalKm: 0,
    intervalMonths: 12,
    critical: false,
    note: 'Substituir anualmente ou ao início do inverno'
  },
  {
    id: 'horn',
    category: 'seguranca',
    name: 'Buzina e Sinalização',
    intervalKm: 0,
    intervalMonths: 6,
    critical: false,
    note: 'Verificar funcionamento buzina e pisca-piscas'
  },
  // Category: Sazonal
  {
    id: 'antifreeze_check',
    category: 'sazonal',
    name: 'Verificação Anticongelante (Inverno)',
    intervalKm: 0,
    intervalMonths: 6,
    critical: false,
    note: 'Verificar proteção até -25°C antes do inverno'
  },
  {
    id: 'ac_check',
    category: 'sazonal',
    name: 'Verificação Ar Condicionado (Verão)',
    intervalKm: 0,
    intervalMonths: 12,
    critical: false,
    note: 'Verificar carga de gás R-134a anualmente'
  }
];

const CATEGORIES = {
  motor:       { label: 'Motor & Filtros',        icon: '🔧' },
  distribuicao:{ label: 'Distribuição',            icon: '⚙️' },
  fluidos:     { label: 'Fluidos',                 icon: '💧' },
  travoes:     { label: 'Sistema de Travagem',     icon: '🛑' },
  pneus:       { label: 'Pneus & Rodas',           icon: '⭕' },
  suspensao:   { label: 'Suspensão & Direção',     icon: '🔩' },
  eletrico:    { label: 'Sistema Elétrico',        icon: '⚡' },
  seguranca:   { label: 'Segurança',               icon: '✅' },
  sazonal:     { label: 'Verificações Sazonais',   icon: '🌡️' }
};

const PARTS = [
  { name: 'Óleo do Motor', spec: '5W-30 Renault RN0720 (ACEA C4)', note: 'Recomendado: Elf Evolution Full-Tech FE 5W-30 ou outro 5W-30 com homologação RN0720. Capacidade: 4,5L com filtro. Nas versões com filtro de partículas (FAP) usar sempre óleo RN0720 — óleos fora da norma danificam o FAP. Confirmar no livro de manutenção.' },
  { name: 'Filtro de Óleo', spec: 'Mann-Filter HU 726/2 x ou OEM 8200768913', note: 'Chave de filtro 27mm. Torque de aperto: 25 Nm. Sempre substituir com o óleo.' },
  { name: 'Filtro de Ar', spec: 'Mann-Filter C 30 130 ou OEM 165461137R', note: 'Inspecionar a cada 15.000 km, substituir a cada 30.000 km ou se visualmente sujo.' },
  { name: 'Filtro de Combustível', spec: 'Mann-Filter WK 939/2 ou OEM 164005765R', note: 'Diesel — localizado no compartimento do motor. Purgar ar após substituição. Substituir com cada segundo troca de óleo.' },
  { name: 'Filtro do Habitáculo', spec: 'Mann-Filter CU 2882 (com carvão ativo) ou OEM 272772519R', note: 'Localizado no interior, atrás da caixa de luvas. Substituição simples sem ferramentas.' },
  { name: 'Pastilhas Frente', spec: 'Brembo P 23 125 ou TRW GDB1609', note: 'Verificar espessura mínima 2mm. Discos frontais: Ø 280mm ou 300mm consoante versão.' },
  { name: 'Fluido de Travões', spec: 'DOT 4 LV (Low Viscosity)', note: 'Não misturar tipos diferentes. Testar ponto de ebulição — mínimo 140°C. Capacidade: ~0,5L.' },
  { name: 'Líquido de Refrigeração', spec: 'Glaceol RX Type D (azul) ou G11 compatível', note: 'Concentração 50/50 com água destilada. Capacidade total: ~6L. Verificar nível no reservatório mensalmente.' },
  { name: 'Velas de Incandescência', spec: 'Bosch 0 250 403 002 (M8x1) ou NGK Y-936AS', note: '4 velas. Torque: 8-12 Nm. Verificar resistência elétrica ~0,5-1 ohm.' },
  { name: 'Bateria', spec: '12V · 60Ah · 540A CCA · B13 (207×175×190mm)', note: 'Recomendar registo de código do rádio antes de desligar. Após substituição, pode ser necessário reinicialização eletrónica.' },
  { name: 'Correia de Distribuição Kit', spec: 'OEM 7701476571 ou Gates TCK357WP1 (kit completo)', note: '⚠️ CRÍTICO: Comprar kit completo com roletes tensores, de encosto e bomba de água. Correia seca (não banhada em óleo), protegida por uma tampa plástica — pode ser inspecionada visualmente.' },
];

const RESET_STEPS = [
  { step: 'Ligar o contacto', detail: 'Rodar a chave para a posição 2 (ON) — sem arrancar o motor' },
  { step: 'Aceder ao menu', detail: 'Pressionar repetidamente o botão <strong>MENU</strong> no tablier até aparecer "Maint." ou "Serviço"' },
  { step: 'Navegar com as setas', detail: 'Usar as setas no volante (▼) para navegar até <strong>"Dist. revisão"</strong> ou <strong>"Date révision"</strong>' },
  { step: 'Confirmar reset', detail: 'Pressionar e manter o botão <strong>OK</strong> no volante durante 3-5 segundos até o contador ser reposto a 0 ou à próxima revisão' },
  { step: 'Verificar', detail: 'O ecrã deverá mostrar <strong>15.000 km</strong> (ou 20.000 km se configurado) até à próxima revisão' },
  { step: 'Desligar e arrancar', detail: 'Desligar o contacto, aguardar 10 segundos, arrancar o carro. Confirmar que a luz de serviço apagou.' },
];

// ---- VEHICLE PROFILE (VIN) ----
const VIN_MAKERS = { VF1: 'Renault', VF2: 'Renault', UU1: 'Dacia', VF3: 'Peugeot', VF7: 'Citroën' };
const MEGANE3_BODIES = { BZ: 'Berlina 5 portas', DZ: 'Coupé', EZ: 'Coupé-Cabriolet', KZ: 'Grand Tour' };
// Potências conhecidas do 1.5 dCi K9K no Mégane III (kW -> binário aproximado)
const K9K_POWERS = { 63: '~200 Nm', 66: '~200 Nm', 70: '~200 Nm', 78: '~240 Nm', 81: '~240 Nm' };

function decodeVin(vin) {
  vin = (vin || '').toUpperCase().trim();
  if (!vin) return { valid: false, empty: true };
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    return { valid: false, error: vin.length !== 17 ? `O VIN tem 17 caracteres (tem ${vin.length}).` : 'O VIN não usa as letras I, O ou Q.' };
  }
  const maker = VIN_MAKERS[vin.slice(0, 3)] || null;
  const body = maker === 'Renault' ? MEGANE3_BODIES[vin.slice(3, 5)] || null : null;
  return { valid: true, vin, maker, body, typeCode: vin.slice(3, 7), isMegane3: !!body };
}

function kwToCv(kw) { return Math.round(kw * 1.35962); }

function vehicleSummary() {
  const v = appData.vehicle || {};
  const d = decodeVin(v.vin);
  const cv = v.powerKw ? kwToCv(v.powerKw) : null;
  return {
    name: `Mégane 3${d.body ? ' ' + d.body : ''} 1.5 dCi${cv ? ' ' + cv + 'cv' : ''}`,
    sub: [d.body, '1.5 dCi', cv ? cv + 'cv' : null].filter(Boolean).join(' · ')
  };
}

function getSpecs() {
  const v = appData.vehicle || {};
  const d = decodeVin(v.vin);
  const cv = v.powerKw ? kwToCv(v.powerKw) : null;
  const torque = K9K_POWERS[v.powerKw];
  return [
    { label: 'Versão', value: d.valid && d.isMegane3 ? `Mégane III ${d.body} (${d.typeCode})` : 'Mégane III' },
    { label: 'Motor', value: v.engineCode ? escapeHtml(v.engineCode) : 'Renault K9K (ver código na chapa do motor)' },
    { label: 'Cilindrada', value: '1.461 cc (1.5 dCi)' },
    { label: 'Potência', value: cv ? `${cv} cv (${v.powerKw} kW)` : '—' },
    { label: 'Binário', value: torque || '—' },
    { label: 'Alimentação', value: 'Injeção direta common rail' },
    { label: 'Transmissão', value: v.gearbox ? escapeHtml(v.gearbox) : '—' },
  { label: 'Caixa de óleo motor', value: '4,5L (com filtro)' },
  { label: 'Óleo da caixa de velocidades', value: '~2,1L SAE 75W-80' },
  { label: 'Sistema de arrefecimento', value: '~6L Glaceol RX Type D' },
  { label: 'Depósito combustível', value: '60L' },
  { label: 'Pneus (standard)', value: '205/55 R16 ou 195/65 R15' },
    { label: 'Pressão pneus (frente)', value: v.tyreFront ? `${v.tyreFront} bar (a frio)` : '—' },
    { label: 'Pressão pneus (trás)', value: v.tyreRear ? `${v.tyreRear} bar (a frio)` : '—' },
  ];
}

function itemNote(item) {
  if (item.id !== 'tyre_pressure') return item.note;
  const v = appData.vehicle || {};
  return `Dianteiros: ${v.tyreFront || '?'} bar · Traseiros: ${v.tyreRear || '?'} bar (a frio). Ver etiqueta na porta do condutor. Verificar o pneu sobressalente`;
}

function renderVehicleHeader() {
  const s = vehicleSummary();
  document.getElementById('topbar-sub').textContent = s.sub;
  const el = document.getElementById('parts-car-name');
  if (el) el.textContent = s.name;
}

function fillVehicleForm() {
  const v = appData.vehicle || {};
  document.getElementById('car-vin').value = v.vin || '';
  document.getElementById('car-kw').value = v.powerKw || '';
  document.getElementById('car-engine').value = v.engineCode || '';
  document.getElementById('car-gearbox').value = v.gearbox || '';
  document.getElementById('car-tyre-front').value = v.tyreFront || '';
  document.getElementById('car-tyre-rear').value = v.tyreRear || '';
  previewVin(); previewKw();
}

function previewVin() {
  const d = decodeVin(document.getElementById('car-vin').value);
  const el = document.getElementById('car-vin-result');
  if (d.empty) { el.innerHTML = ''; return; }
  if (!d.valid) { el.innerHTML = `<span style="color:var(--accent-yellow)">⚠️ ${d.error}</span>`; return; }
  if (!d.maker) { el.innerHTML = '<span style="color:var(--accent-yellow)">⚠️ Fabricante não reconhecido.</span>'; return; }
  if (!d.isMegane3) {
    el.innerHTML = `<span style="color:var(--accent-yellow)">⚠️ ${d.maker}, mas não parece um Mégane III. A app foi feita para o Mégane III: confirme os intervalos de manutenção.</span>`;
    return;
  }
  el.innerHTML = `<span style="color:var(--accent-green)">✓ ${d.maker} Mégane III ${d.body}</span> <span class="text-muted">· tipo ${d.typeCode}</span>`;
}

function previewKw() {
  const kw = parseInt(document.getElementById('car-kw').value);
  const el = document.getElementById('car-kw-result');
  if (!kw) { el.textContent = ''; return; }
  el.textContent = `= ${kwToCv(kw)} cv` + (K9K_POWERS[kw] ? '' : ' · potência pouco habitual no 1.5 dCi');
}

function saveVehicle() {
  const vinRaw = document.getElementById('car-vin').value.trim().toUpperCase();
  const d = decodeVin(vinRaw);
  if (vinRaw && !d.valid) { showToast('⚠️ VIN inválido'); return; }
  const num = id => parseFloat(document.getElementById(id).value) || null;
  appData.vehicle = {
    vin: vinRaw,
    powerKw: parseInt(document.getElementById('car-kw').value) || null,
    engineCode: document.getElementById('car-engine').value.trim().toUpperCase(),
    gearbox: document.getElementById('car-gearbox').value,
    tyreFront: num('car-tyre-front'),
    tyreRear: num('car-tyre-rear')
  };
  saveData(appData);
  renderVehicleHeader();
  renderInfo();
  showToast('✅ Dados do carro guardados!');
}

// ---- STORAGE ----
function loadData() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return { ...defaultData, vehicle: { ...defaultData.vehicle } };
    const data = JSON.parse(raw);
    return { ...defaultData, ...data, vehicle: { ...defaultData.vehicle, ...(data.vehicle || {}) } };
  } catch { return { ...defaultData, vehicle: { ...defaultData.vehicle } }; }
}

function saveData(data) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(data)); }
  catch (e) { showToast('⚠️ Não foi possível guardar os dados'); }
}

let appData = loadData();

// ---- NAVIGATION ----
function navigateTo(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('screen-' + screen).classList.add('active');
  document.getElementById('nav-' + screen).classList.add('active');

  if (screen === 'checklist') renderChecklist();
  if (screen === 'add') setupAddForm();
  if (screen === 'history') renderHistory();
  if (screen === 'info') renderInfo();
  if (screen === 'home') renderDashboard();
}

// ---- TOAST ----
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ---- KM UPDATE ----
function updateKm() {
  const val = parseInt(document.getElementById('km-input').value);
  if (!val || val < 1) { showToast('⚠️ Introduza um valor válido'); return; }
  if (val < appData.currentKm) {
    if (!confirm('O novo valor é menor que o atual. Confirmar?')) return;
  }
  appData.currentKm = val;
  saveData(appData);
  document.getElementById('km-input').value = '';
  renderDashboard();
  showToast('✅ Quilometragem atualizada!');
}

// ---- ALERT STATUS CALCULATION ----
function getItemStatus(item) {
  const state = appData.checklistState[item.id];
  const km = appData.currentKm;
  
  if (!state || (!state.lastKm && !state.lastDate)) return 'unknown';
  
  let kmStatus = 'ok', dateStatus = 'ok';
  
  if (item.intervalKm && state.lastKm) {
    const kmUsed = km - state.lastKm;
    const ratio = kmUsed / item.intervalKm;
    if (ratio >= 1) kmStatus = 'overdue';
    else if (ratio >= 0.85) kmStatus = 'warning';
    else kmStatus = 'ok';
  }
  
  if (item.intervalMonths && state.lastDate) {
    const monthsAgo = (Date.now() - new Date(state.lastDate)) / (1000 * 60 * 60 * 24 * 30.4);
    const ratio = monthsAgo / item.intervalMonths;
    if (ratio >= 1) dateStatus = 'overdue';
    else if (ratio >= 0.85) dateStatus = 'warning';
    else dateStatus = 'ok';
  }
  
  if (kmStatus === 'overdue' || dateStatus === 'overdue') return 'overdue';
  if (kmStatus === 'warning' || dateStatus === 'warning') return 'warning';
  return 'ok';
}

function getNextKm(item) {
  const state = appData.checklistState[item.id];
  if (!state || !state.lastKm || !item.intervalKm) return null;
  return state.lastKm + item.intervalKm;
}

function getKmRemaining(item) {
  const next = getNextKm(item);
  if (!next) return null;
  return next - appData.currentKm;
}

// ---- DASHBOARD RENDER ----
function renderDashboard() {
  const km = appData.currentKm;
  
  // KM display
  document.getElementById('km-display').innerHTML = km ? 
    `${km.toLocaleString('pt-PT')}<span class="km-unit"> km</span>` : 
    `—<span class="km-unit"> km</span>`;

  // Since oil
  const oilState = appData.checklistState['oil_change'];
  if (oilState && oilState.lastKm) {
    const since = km - oilState.lastKm;
    document.getElementById('stat-since-oil').textContent = since.toLocaleString('pt-PT') + ' km';
    document.getElementById('km-since-text').textContent = `${since.toLocaleString('pt-PT')} km desde última troca de óleo`;
  } else {
    document.getElementById('stat-since-oil').textContent = '—';
    document.getElementById('km-since-text').textContent = 'Registe a última troca de óleo no Checklist';
  }

  // Stats
  document.getElementById('stat-maintenance-count').textContent = appData.maintenances.length;
  document.getElementById('stat-maintenance-label').textContent = appData.maintenances.length === 1 ? 'manutenção' : 'manutenções';
  const totalCost = appData.maintenances.reduce((s, m) => s + (parseFloat(m.cost) || 0), 0);
  document.getElementById('stat-total-cost').textContent = totalCost.toFixed(0) + '€';

  // Next service: km em falta (ou em atraso), com cor só quando há problema
  const oilItem = MAINTENANCE_ITEMS.find(i => i.id === 'oil_change');
  const oilRemaining = km ? getKmRemaining(oilItem) : null;
  const nextEl = document.getElementById('stat-next-service');
  const nextLbl = document.getElementById('stat-next-label');
  nextEl.classList.remove('is-red', 'is-yellow');
  if (oilRemaining === null) {
    nextEl.textContent = '—';
    nextLbl.textContent = 'até à revisão';
  } else if (oilRemaining < 0) {
    nextEl.textContent = Math.abs(oilRemaining).toLocaleString('pt-PT') + ' km';
    nextLbl.textContent = 'revisão em atraso';
    nextEl.classList.add('is-red');
  } else {
    nextEl.textContent = oilRemaining.toLocaleString('pt-PT') + ' km';
    nextLbl.textContent = 'até à revisão';
    if (oilRemaining <= oilItem.intervalKm * 0.15) nextEl.classList.add('is-yellow');
  }

  // Placeholder com o km atual
  document.getElementById('km-input').placeholder = km ? km.toLocaleString('pt-PT') : 'Ex: 125000';

  // Aviso da correia só quando está perto do prazo, em atraso ou sem dados
  const beltStatus = getItemStatus(MAINTENANCE_ITEMS.find(i => i.id === 'timing_belt'));
  document.getElementById('belt-warning').style.display = km && beltStatus !== 'ok' ? '' : 'none';

  renderHeroSummary();

  // Alerts
  renderAlerts();
  renderServiceProgress();
}

function renderHeroSummary() {
  const el = document.getElementById('hero-summary');
  if (!appData.currentKm) { el.innerHTML = ''; return; }
  const statuses = MAINTENANCE_ITEMS.map(getItemStatus);
  const overdue = statuses.filter(s => s === 'overdue').length;
  const warning = statuses.filter(s => s === 'warning').length;
  const pill = (cls, text) => `<span class="summary-pill ${cls}" onclick="scrollToAlerts()"><span class="dot"></span>${text}</span>`;
  const parts = [];
  if (overdue) parts.push(pill('red', `${overdue} vencido${overdue > 1 ? 's' : ''}`));
  if (warning) parts.push(pill('yellow', `${warning} atenção`));
  if (!parts.length && statuses.some(s => s === 'ok')) parts.push(pill('green', 'Tudo em dia'));
  el.innerHTML = parts.join('');
}

function scrollToAlerts() {
  document.getElementById('alerts-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderAlerts() {
  const list = document.getElementById('alert-list');
  if (!appData.currentKm) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:24px;font-size:0.85rem;">Atualize a quilometragem para ver os alertas</div>';
    return;
  }

  const alerts = [];
  MAINTENANCE_ITEMS.forEach(item => {
    const status = getItemStatus(item);
    const remaining = getKmRemaining(item);
    const state = appData.checklistState[item.id];
    
    if (status === 'overdue') {
      let detail = 'Manutenção em atraso';
      if (remaining !== null) detail = `${Math.abs(remaining).toLocaleString('pt-PT')} km em atraso`;
      alerts.push({ item, status: 'red', detail, priority: 1 });
    } else if (status === 'warning') {
      let detail = 'Aproximando-se do intervalo';
      if (remaining !== null) detail = `Restam ~${remaining.toLocaleString('pt-PT')} km`;
      alerts.push({ item, status: 'yellow', detail, priority: 2 });
    } else if (status === 'ok') {
      if (remaining !== null) alerts.push({ item, status: 'green', detail: `Restam ${remaining.toLocaleString('pt-PT')} km`, priority: 3 });
    } else if (!state || !state.lastKm) {
      alerts.push({ item, status: 'yellow', detail: 'Sem dados — registar última manutenção', priority: 2 });
    }
  });

  alerts.sort((a, b) => a.priority - b.priority);
  const topAlerts = alerts.slice(0, 8);

  if (!topAlerts.length) { list.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:24px;">Sem alertas ativos</div>'; return; }

  list.innerHTML = topAlerts.map(a => `
    <div class="alert-item" onclick="navigateTo('checklist')">
      <div class="alert-dot ${a.status}"></div>
      <div class="alert-text">
        <div class="alert-name">${a.item.critical ? '⚠️ ' : ''}${escapeHtml(a.item.name)}</div>
        <div class="alert-detail">${a.detail}</div>
      </div>
      <div class="alert-badge">
        <span class="badge badge-${a.status === 'red' ? 'red' : a.status === 'yellow' ? 'yellow' : 'green'}">
          ${a.status === 'red' ? 'VENCIDO' : a.status === 'yellow' ? 'ATENÇÃO' : 'OK'}
        </span>
      </div>
    </div>
  `).join('');
}

function renderServiceProgress() {
  const container = document.getElementById('service-progress-list');
  const keyItems = ['oil_change', 'timing_belt', 'fuel_filter', 'brake_fluid', 'tyre_pressure'];
  
  container.innerHTML = keyItems.map(id => {
    const item = MAINTENANCE_ITEMS.find(i => i.id === id);
    const state = appData.checklistState[id];
    
    if (!item) return '';
    
    let pct = 0, color = 'green', detail = 'Sem dados';
    
    if (state && state.lastKm && item.intervalKm && appData.currentKm) {
      const used = appData.currentKm - state.lastKm;
      pct = Math.min(100, (used / item.intervalKm) * 100);
      color = pct >= 100 ? 'red' : pct >= 85 ? 'yellow' : 'green';
      const remaining = item.intervalKm - used;
      detail = pct >= 100 ? `${Math.abs(remaining).toLocaleString('pt-PT')} km em atraso` : `Restam ${remaining.toLocaleString('pt-PT')} km`;
    }
    
    return `
      <div class="progress-wrap" style="margin-bottom:14px;">
        <div class="progress-header">
          <span>${item.name}</span>
          <span>${detail}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${color}" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ---- CHECKLIST RENDER ----
let checklistFilter = 'all';

function filterChecklist(filter, el) {
  checklistFilter = filter;
  document.querySelectorAll('#checklist-filters .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderChecklist();
}

function renderChecklist() {
  const container = document.getElementById('checklist-content');
  
  let html = '';
  Object.entries(CATEGORIES).forEach(([catId, cat]) => {
    const items = MAINTENANCE_ITEMS.filter(i => i.category === catId);
    
    const filteredItems = items.filter(item => {
      const status = getItemStatus(item);
      if (checklistFilter === 'all') return true;
      if (checklistFilter === 'pendente') return status === 'unknown' || status === 'warning';
      if (checklistFilter === 'vencido') return status === 'overdue';
      if (checklistFilter === 'ok') return status === 'ok';
      return true;
    });
    
    if (!filteredItems.length) return;
    
    html += `
      <div class="checklist-category">
        <div class="cat-header">
          <span class="cat-icon">${cat.icon}</span>
          <span class="cat-title">${cat.label}</span>
          <span class="cat-count">${filteredItems.length} item${filteredItems.length !== 1 ? 's' : ''}</span>
        </div>
        ${filteredItems.map(item => renderCheckItem(item)).join('')}
      </div>
    `;
  });
  
  container.innerHTML = html || '<div style="text-align:center;padding:32px;color:var(--text-muted)">Nenhum item encontrado para este filtro</div>';
}

function renderCheckItem(item) {
  const state = appData.checklistState[item.id];
  const status = getItemStatus(item);
  const remaining = getKmRemaining(item);
  
  let statusClass = '';
  if (status === 'overdue') statusClass = 'overdue';
  else if (status === 'warning') statusClass = 'warning';
  
  let badgeHtml = '';
  if (status === 'overdue') badgeHtml = '<span class="badge badge-red">VENCIDO</span>';
  else if (status === 'warning') badgeHtml = '<span class="badge badge-yellow">ATENÇÃO</span>';
  else if (status === 'ok') badgeHtml = '<span class="badge badge-green">OK</span>';
  else badgeHtml = '<span class="badge" style="border:1px solid var(--border);color:var(--text-muted);font-size:0.65rem">SEM DADOS</span>';
  
  const kmInfo = item.intervalKm ? `A cada ${item.intervalKm.toLocaleString('pt-PT')} km${item.intervalMonths ? ` ou ${item.intervalMonths} meses` : ''}` : `A cada ${item.intervalMonths} meses`;
  
  return `
    <div class="check-item ${statusClass}" onclick="openCheckModal('${item.id}')">
      <div class="check-box">
        ${status === 'ok' ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
      </div>
      <div class="check-info">
        <div class="check-name">${item.name}</div>
        <div class="check-meta">${kmInfo}${remaining !== null ? ` · Restam ${remaining > 0 ? remaining.toLocaleString('pt-PT') : '0'} km` : ''}</div>
        ${item.critical ? `<div class="check-critical">⚠️ COMPONENTE CRÍTICO — NÃO IGNORAR</div>` : ''}
      </div>
      <div class="check-badge">${badgeHtml}</div>
    </div>
  `;
}

// ---- CHECKLIST MODAL ----
function openCheckModal(itemId) {
  const item = MAINTENANCE_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  
  const state = appData.checklistState[itemId] || {};
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">${item.name}</div>
        <div class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</div>
      </div>
      ${item.critical ? '<div class="warning-box">⚠️ COMPONENTE CRÍTICO DO MOTOR — consultar mecânico especializado</div>' : ''}
      <div class="info-box">${itemNote(item)}</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Última manutenção (km)${item.intervalKm ? '' : ' — opcional'}</label>
          <input type="number" class="form-input" id="modal-km" value="${state.lastKm || ''}" placeholder="${appData.currentKm || 'km atual'}" />
        </div>
        <div class="form-group">
          <label class="form-label">Data</label>
          <input type="date" class="form-input" id="modal-date" value="${state.lastDate || today()}" />
        </div>
      </div>
      ${item.intervalKm ? `<div class="text-muted text-sm" style="margin-bottom:12px">Próxima: ${((state.lastKm || appData.currentKm) + item.intervalKm).toLocaleString('pt-PT')} km (estimativa)</div>` : ''}
      <button class="btn-full primary" onclick="saveCheckState('${itemId}')">Guardar</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function saveCheckState(itemId) {
  const item = MAINTENANCE_ITEMS.find(i => i.id === itemId);
  const km = parseInt(document.getElementById('modal-km')?.value) || 0;
  const date = document.getElementById('modal-date')?.value;
  if (item?.intervalKm && km < 1) { showToast('⚠️ Introduza a quilometragem'); return; }
  if (!date) { showToast('⚠️ Introduza a data'); return; }

  appData.checklistState[itemId] = { lastKm: km || null, lastDate: date, done: true };
  // 6. manter o conta-km coerente
  if (km > appData.currentKm) appData.currentKm = km;
  saveData(appData);
  document.querySelector('.modal-overlay')?.remove();
  renderChecklist();
  showToast('✅ Atualizado com sucesso!');
}

// ---- ADD MAINTENANCE ----
function setupAddForm() {
  document.getElementById('add-date').value = today();
  document.getElementById('add-km').value = appData.currentKm || '';
  
  const select = document.getElementById('checks-select');
  select.innerHTML = MAINTENANCE_ITEMS.map(item => `
    <div class="check-mini-item" onclick="toggleCheckMini(this, '${item.id}')">
      <div class="check-mini-cb" id="cb-${item.id}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" style="display:none"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="check-mini-label">${item.name}</div>
    </div>
  `).join('');
}

function toggleCheckMini(el, id) {
  el.classList.toggle('selected');
  const cb = el.querySelector('.check-mini-cb svg');
  if (cb) cb.style.display = el.classList.contains('selected') ? 'block' : 'none';
}

function saveMaintenance() {
  const date = document.getElementById('add-date').value;
  const km = parseInt(document.getElementById('add-km').value);
  const cost = parseFloat(document.getElementById('add-cost').value) || 0;
  const garage = document.getElementById('add-garage').value.trim();
  const notes = document.getElementById('add-notes').value.trim();
  
  if (!date || !km) { showToast('⚠️ Preencha data e quilometragem'); return; }
  
  const selectedItems = [...document.querySelectorAll('#checks-select .check-mini-item.selected')]
    .map(el => {
      const id = el.querySelector('.check-mini-cb').id.replace('cb-', '');
      const item = MAINTENANCE_ITEMS.find(i => i.id === id);
      return item ? item.name : '';
    }).filter(Boolean);
  
  if (!selectedItems.length) { showToast('⚠️ Selecione pelo menos um item'); return; }
  
  const record = {
    id: Date.now().toString(),
    date, km, cost, garage, notes,
    items: selectedItems,
    itemIds: selectedItems.map(name => MAINTENANCE_ITEMS.find(i => i.name === name)?.id).filter(Boolean),
    createdAt: new Date().toISOString()
  };
  
  appData.maintenances.unshift(record);
  
  // Auto-update checklist state for done items
  selectedItems.forEach(name => {
    const item = MAINTENANCE_ITEMS.find(i => i.name === name);
    if (item) {
      appData.checklistState[item.id] = { lastKm: km, lastDate: date, done: true };
    }
  });
  
  // Update current km if higher
  if (km > appData.currentKm) appData.currentKm = km;
  
  saveData(appData);
  showToast('✅ Manutenção registada!');
  navigateTo('history');
}

// ---- HISTORY ----
function renderHistory() {
  const list = document.getElementById('history-list');
  
  if (!appData.maintenances.length) {
    list.innerHTML = `
      <div class="hist-empty">
        <div class="hist-empty-icon">📋</div>
        <div>Sem manutenções registadas</div>
        <div class="text-muted text-sm mt-8">Adicione a primeira manutenção clicando em "Registar"</div>
      </div>
    `;
    return;
  }
  
  list.innerHTML = appData.maintenances.map(m => `
    <div class="hist-item">
      <div class="hist-header">
        <div>
          <div class="hist-date">${formatDate(m.date)}</div>
          <div class="hist-km">📍 ${m.km.toLocaleString('pt-PT')} km${m.garage ? ` · ${escapeHtml(m.garage)}` : ''}</div>
        </div>
        <div style="text-align:right">
          <div class="hist-cost">${m.cost ? Number(m.cost).toFixed(2) + '€' : '—'}</div>
          <button class="del-btn mt-8" onclick="deleteRecord('${escapeHtml(m.id)}')">Apagar</button>
        </div>
      </div>
      <div class="hist-tags">
        ${m.items.map(i => `<span class="hist-tag">${escapeHtml(i)}</span>`).join('')}
      </div>
      ${m.notes ? `<div class="hist-notes">💬 ${escapeHtml(m.notes)}</div>` : ''}
    </div>
  `).join('');
}

function deleteRecord(id) {
  if (!confirm('Apagar este registo?')) return;
  const removed = appData.maintenances.find(m => m.id === id);
  appData.maintenances = appData.maintenances.filter(m => m.id !== id);
  if (removed) revertChecklistFor(removed);
  saveData(appData);
  renderHistory();
  showToast('🗑 Registo apagado');
}

function recordItemIds(m) {
  if (Array.isArray(m.itemIds)) return m.itemIds;
  return (m.items || []).map(name => MAINTENANCE_ITEMS.find(i => i.name === name)?.id).filter(Boolean);
}

// Ao apagar um registo, repõe no checklist o registo anterior mais recente
// (só se o estado atual tiver vindo do registo apagado).
function revertChecklistFor(removed) {
  recordItemIds(removed).forEach(itemId => {
    const st = appData.checklistState[itemId];
    if (!st || st.lastKm !== removed.km || st.lastDate !== removed.date) return;
    const previous = appData.maintenances
      .filter(m => recordItemIds(m).includes(itemId))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.km - a.km)[0];
    if (previous) appData.checklistState[itemId] = { lastKm: previous.km, lastDate: previous.date, done: true };
    else delete appData.checklistState[itemId];
  });
}

// ---- INFO / PARTS / RESET ----
function renderInfo() {
  // Parts
  document.getElementById('parts-list').innerHTML = PARTS.map(p => `
    <div class="part-item">
      <div class="part-name">${p.name}</div>
      <div class="part-spec">${p.spec}</div>
      <div class="part-note">${p.note}</div>
    </div>
  `).join('');
  
  // Reset steps
  document.getElementById('reset-steps').innerHTML = RESET_STEPS.map((s, i) => `
    <div class="step-item">
      <div class="step-num">${i + 1}</div>
      <div class="step-text"><strong>${s.step}</strong><br>${s.detail}</div>
    </div>
  `).join('');
  
  // Specs
  renderVehicleHeader();
  fillVehicleForm();
  document.getElementById('specs-list').innerHTML = getSpecs().map(s => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:0.83rem;">
      <span style="color:var(--text-secondary)">${s.label}</span>
      <span style="font-weight:500;text-align:right;max-width:60%">${s.value}</span>
    </div>
  `).join('');
}

function switchInfoTab(tab) {
  if (tab === 'obd' && typeof obdInitUI === 'function') obdInitUI();
  ['parts','reset','specs','car','obd'].forEach(t => {
    document.getElementById('tab-content-' + t).style.display = t === tab ? 'block' : 'none';
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
}

// ---- EXPORT CSV ----
function exportCSV() {
  if (!appData.maintenances.length) { showToast('⚠️ Sem dados para exportar'); return; }
  
  // Separador ';' e vírgula decimal: é o que o Excel em português espera.
  const cell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [['Data','Quilometragem','Custo (€)','Oficina','Itens','Notas']];
  appData.maintenances.forEach(m => {
    rows.push([
      m.date, m.km, (Number(m.cost) || 0).toFixed(2).replace('.', ','), m.garage || '',
      (m.items || []).join(' | '), m.notes || ''
    ]);
  });

  const csv = rows.map(r => r.map(cell).join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `megane3_historico_${today()}.csv`;
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('✅ CSV exportado!');
}

// ---- BACKUP / RESTORE (JSON) ----
function exportBackup() {
  const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `megane3_backup_${today()}.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('✅ Backup guardado!');
}

function importBackup(input) {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object' || !Array.isArray(data.maintenances) || typeof data.checklistState !== 'object') throw new Error();
      if (!confirm(`Restaurar backup com ${data.maintenances.length} registo(s)? Os dados atuais serão substituídos.`)) return;
      appData = { ...defaultData, ...data, currentKm: parseInt(data.currentKm) || 0, vehicle: { ...defaultData.vehicle, ...(data.vehicle || {}) } };
      renderVehicleHeader();
      saveData(appData);
      renderHistory();
      showToast('✅ Backup restaurado!');
    } catch {
      showToast('⚠️ Ficheiro de backup inválido');
    }
  };
  reader.readAsText(file);
}

// ---- UTILS ----
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  renderVehicleHeader();
  renderDashboard();
  
  // Enter key on km input
  document.getElementById('km-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') updateKm();
  });
  
  // Service Worker registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
