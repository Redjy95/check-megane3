// ============================================================
//  CHECK MÉGANE 3 — OBD (ELM327 Bluetooth LE)
//  Funciona no Chrome (Android) e no Bluefy (iPhone).
//  Usar só com o carro parado.
// ============================================================

// Serviços BLE usados pelos adaptadores ELM327 mais comuns
const OBD_SERVICES = [
  0xfff0, 0xffe0, 0x18f0,
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2' // Vgate iCar Pro BLE
];

const obd = {
  device: null,
  writeChar: null,
  buffer: '',
  pending: null,      // { resolve, reject, timer }
  queue: Promise.resolve(),
  busy: false
};

// ---- LIGAÇÃO ----
function obdSupported() {
  return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
}

async function obdConnect() {
  if (!obdSupported()) return;
  obdSetStatus('A procurar adaptador…');
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'OBD' }, { namePrefix: 'Vgate' }, { namePrefix: 'IOS-Vlink' }, { namePrefix: 'V-LINK' }, { namePrefix: 'Veepeak' }, { services: [0xfff0] }, { services: [0xffe0] }],
      optionalServices: OBD_SERVICES
    });
    obd.device = device;
    device.addEventListener('gattserverdisconnected', obdOnDisconnect);
    obdSetStatus('A ligar a ' + (device.name || 'adaptador') + '…');
    const server = await device.gatt.connect();

    // Encontrar uma característica para escrever e outra para receber (notify)
    let writeChar = null, notifyChar = null;
    for (const service of await server.getPrimaryServices()) {
      let chars;
      try { chars = await service.getCharacteristics(); } catch { continue; }
      for (const c of chars) {
        if (!notifyChar && (c.properties.notify || c.properties.indicate)) notifyChar = c;
        if (!writeChar && (c.properties.write || c.properties.writeWithoutResponse)) writeChar = c;
      }
      if (writeChar && notifyChar) break;
    }
    if (!writeChar || !notifyChar) throw new Error('Adaptador não compatível (sem canal de dados).');

    obd.writeChar = writeChar;
    await notifyChar.startNotifications();
    notifyChar.addEventListener('characteristicvaluechanged', obdOnData);

    obdSetStatus('A iniciar o ELM327…');
    for (const cmd of ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0']) {
      await obdSend(cmd, cmd === 'ATZ' ? 4000 : 2000);
    }
    // Primeiro pedido ao carro (pode demorar enquanto procura o protocolo)
    const first = await obdSend('0100', 12000);
    if (!/41\s?00/.test(first.replace(/\s/g, ''))) {
      obdLog('Resposta ao 0100: ' + first);
      throw new Error('O carro não respondeu. Confirme que a ignição está ligada.');
    }
    obdSetConnected(true);
    obdSetStatus('Ligado a ' + (device.name || 'adaptador'), 'ok');
  } catch (e) {
    if (e && e.name === 'NotFoundError') { obdSetStatus('Nenhum adaptador escolhido.'); return; }
    obdSetStatus('⚠️ ' + (e.message || e), 'error');
    obdDisconnect();
  }
}

function obdDisconnect() {
  try { obd.device?.gatt?.connected && obd.device.gatt.disconnect(); } catch {}
  obdOnDisconnect();
}

function obdOnDisconnect() {
  obd.writeChar = null;
  if (obd.pending) { clearTimeout(obd.pending.timer); obd.pending.reject(new Error('Ligação perdida')); obd.pending = null; }
  obdSetConnected(false);
}

// ---- COMUNICAÇÃO ----
function obdOnData(e) {
  obd.buffer += new TextDecoder().decode(e.target.value);
  if (obd.buffer.includes('>') && obd.pending) {
    const text = obd.buffer.replace('>', '').trim();
    obd.buffer = '';
    clearTimeout(obd.pending.timer);
    const p = obd.pending; obd.pending = null;
    p.resolve(text);
  }
}

// Envia um comando e espera pela resposta (até ao ">" do ELM327). Os comandos ficam em fila.
function obdSend(cmd, timeout = 5000) {
  const run = () => new Promise(async (resolve, reject) => {
    if (!obd.writeChar) return reject(new Error('Não ligado'));
    obd.buffer = '';
    obd.pending = {
      resolve: text => { obdLog(`> ${cmd}\n${text}`); resolve(text); },
      reject,
      timer: setTimeout(() => { obd.pending = null; obdLog(`> ${cmd}\n(sem resposta)`); reject(new Error('Sem resposta do adaptador')); }, timeout)
    };
    try {
      const data = new TextEncoder().encode(cmd + '\r');
      if (obd.writeChar.properties.writeWithoutResponse) await obd.writeChar.writeValueWithoutResponse(data);
      else await obd.writeChar.writeValue(data);
    } catch (err) { clearTimeout(obd.pending?.timer); obd.pending = null; reject(err); }
  });
  const p = obd.queue.then(run, run);
  obd.queue = p.catch(() => {});
  return p;
}

// Bytes de dados de uma resposta "41 xx ..." (modo 01), ou null
function obdBytes(text, mode, pid) {
  const hex = obdCleanHex(text);
  const head = (0x40 + mode).toString(16).toUpperCase() + (pid !== undefined ? pid.toString(16).toUpperCase().padStart(2, '0') : '');
  const i = hex.indexOf(head);
  if (i < 0) return null;
  const rest = hex.slice(i + head.length);
  const bytes = [];
  for (let j = 0; j + 1 < rest.length; j += 2) bytes.push(parseInt(rest.slice(j, j + 2), 16));
  return bytes;
}

// Junta as linhas de uma resposta (também multi-trama "0: 1: …") em hex contínuo
function obdCleanHex(text) {
  return text.split(/[\r\n]+/)
    .map(l => l.trim())
    .filter(l => l && !/SEARCHING|BUS INIT|STOPPED/i.test(l))
    .filter((l, idx, arr) => !(arr.length > 1 && idx === 0 && /^[0-9A-F]{3}$/i.test(l))) // comprimento da multi-trama
    .map(l => l.replace(/^[0-9A-F]:/i, ''))
    .join('').replace(/[^0-9A-F]/gi, '').toUpperCase();
}

function obdNoData(text) {
  return /NO DATA|ERROR|UNABLE|\?|CAN ERROR|STOPPED/i.test(text);
}

// ---- LEITURAS ----
async function obdReadLive() {
  return obdRun(async () => {
    const out = {};
    const volt = await obdSend('ATRV');
    const v = parseFloat(volt.replace(/[^0-9.]/g, ''));
    if (!isNaN(v)) out.battery = v;
    const temp = obdBytes(await obdSend('0105'), 1, 0x05);
    if (temp && temp.length >= 1) out.coolant = temp[0] - 40;
    const rpm = obdBytes(await obdSend('010C'), 1, 0x0c);
    if (rpm && rpm.length >= 2) out.rpm = Math.round((rpm[0] * 256 + rpm[1]) / 4);
    const spd = obdBytes(await obdSend('010D'), 1, 0x0d);
    if (spd && spd.length >= 1) out.speed = spd[0];
    obdShowLive(out);
  });
}

// Decodifica códigos de avaria (modo 03). CAN: 43 + nº de códigos + 2 bytes por código.
function obdParseDtcs(text) {
  if (obdNoData(text) && !/43/.test(text)) return [];
  const bytes = obdBytes(text, 3);
  if (!bytes) return [];
  let data = bytes;
  if (bytes.length % 2 === 1 && bytes[0] * 2 <= bytes.length - 1) data = bytes.slice(1, 1 + bytes[0] * 2);
  const letters = ['P', 'C', 'B', 'U'];
  const codes = [];
  for (let i = 0; i + 1 < data.length; i += 2) {
    const a = data[i], b = data[i + 1];
    if (a === 0 && b === 0) continue;
    codes.push(letters[a >> 6] + ((a >> 4) & 3) + (a & 15).toString(16).toUpperCase() + b.toString(16).toUpperCase().padStart(2, '0'));
  }
  return [...new Set(codes)];
}

async function obdReadDtcs() {
  return obdRun(async () => {
    const codes = obdParseDtcs(await obdSend('03', 8000));
    obdShowDtcs(codes);
    // Regista o diagnóstico no checklist
    if (appData.currentKm) {
      appData.checklistState.diagnostic = { lastKm: appData.currentKm, lastDate: today(), done: true };
      saveData(appData);
      showToast('✅ Diagnóstico registado no checklist');
    }
  });
}

async function obdClearDtcs() {
  if (!confirm('Apagar os códigos de avaria? Faça-o só depois de resolver o problema. A luz do motor apaga, mas volta se a avaria continuar.')) return;
  return obdRun(async () => {
    const r = await obdSend('04', 8000);
    if (/44/.test(obdCleanHex(r))) { showToast('✅ Códigos apagados'); obdShowDtcs([]); }
    else showToast('⚠️ O carro não aceitou (ignição ligada, motor desligado?)');
  });
}

// Tenta ler o conta-km (PID A6). Muitos carros de 2010 não respondem.
async function obdReadOdometer() {
  return obdRun(async () => {
    const el = document.getElementById('obd-km');
    const support = obdBytes(await obdSend('01A0'), 1, 0xa0);
    const odo = obdBytes(await obdSend('01A6'), 1, 0xa6);
    if (odo && odo.length >= 4) {
      const km = Math.round(((odo[0] << 24 >>> 0) + (odo[1] << 16) + (odo[2] << 8) + odo[3]) / 10);
      el.innerHTML = `Conta-km: <strong>${fmtNum(km)} km</strong>`;
      if (km > 0 && confirm(`O carro indica ${fmtNum(km)} km. Atualizar a quilometragem da app?`)) {
        appData.currentKm = km;
        saveData(appData);
        showToast('✅ Quilometragem atualizada!');
      }
      return;
    }
    const dist = obdBytes(await obdSend('0131'), 1, 0x31);
    const distTxt = dist && dist.length >= 2 ? ` Distância desde a última limpeza de avarias: ${fmtNum((dist[0] * 256 + dist[1]))} km.` : '';
    el.innerHTML = `<span style="color:var(--accent-yellow)">O carro não fornece o conta-km pelo OBD standard${support ? '' : ' (PID A6 não suportado)'}.</span>${distTxt}`;
  });
}

// Evita comandos em simultâneo e mostra erros
async function obdRun(fn) {
  if (!obd.writeChar) { showToast('⚠️ Ligue primeiro ao adaptador'); return; }
  if (obd.busy) return;
  obd.busy = true; obdSetBusy(true);
  try { await fn(); }
  catch (e) { showToast('⚠️ ' + (e.message || e)); }
  finally { obd.busy = false; obdSetBusy(false); }
}

// ---- UI ----
function obdInitUI() {
  const unsupported = document.getElementById('obd-unsupported');
  const panel = document.getElementById('obd-panel');
  if (!unsupported || !panel) return;
  unsupported.style.display = obdSupported() ? 'none' : '';
  panel.style.display = obdSupported() ? '' : 'none';
  obdSetConnected(!!obd.writeChar);
}

function obdSetStatus(text, kind) {
  const el = document.getElementById('obd-status');
  if (!el) return;
  el.textContent = text;
  el.style.color = kind === 'ok' ? 'var(--accent-green)' : kind === 'error' ? 'var(--accent-yellow)' : 'var(--text-secondary)';
}

function obdSetConnected(on) {
  const actions = document.getElementById('obd-actions');
  const btn = document.getElementById('obd-connect-btn');
  if (actions) actions.style.display = on ? '' : 'none';
  if (btn) {
    btn.textContent = on ? 'Desligar' : 'Ligar ao adaptador OBD';
    btn.onclick = on ? obdDisconnect : obdConnect;
  }
  if (!on && document.getElementById('obd-status')?.textContent.startsWith('Ligado')) obdSetStatus('Desligado');
}

function obdSetBusy(on) {
  document.querySelectorAll('#obd-actions button').forEach(b => { b.disabled = on; b.style.opacity = on ? 0.5 : 1; });
}

function obdShowLive(d) {
  const row = (label, val) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="text-muted">${label}</span><strong>${val}</strong></div>`;
  const batt = d.battery !== undefined
    ? `${d.battery.toFixed(1)} V <span class="text-muted" style="font-weight:400">(${d.battery >= 13.2 ? 'a carregar' : d.battery >= 12.4 ? 'boa' : d.battery >= 12.0 ? 'fraca' : 'muito fraca'})</span>`
    : '—';
  document.getElementById('obd-live').innerHTML =
    row('Bateria', batt) +
    row('Temperatura do motor', d.coolant !== undefined ? d.coolant + ' °C' : '—') +
    row('Rotações', d.rpm !== undefined ? fmtNum(d.rpm) + ' rpm' : '—') +
    row('Velocidade', d.speed !== undefined ? d.speed + ' km/h' : '—');
}

function obdShowDtcs(codes) {
  document.getElementById('obd-dtcs').innerHTML = codes.length
    ? `<div style="color:var(--accent-red);margin-bottom:6px">${codes.length} código(s) de avaria:</div>` +
      codes.map(c => `<span class="hist-tag" style="margin:0 6px 6px 0;display:inline-block">${c}</span>`).join('') +
      '<div class="text-muted text-sm" style="margin-top:6px">Pesquise o código (ex.: "P0380 Renault") ou leve a um mecânico.</div>'
    : '<span style="color:var(--accent-green)">✓ Sem códigos de avaria</span>';
}

function obdLog(text) {
  const el = document.getElementById('obd-log');
  if (!el) return;
  el.textContent = (el.textContent + '\n' + text).trim().split('\n').slice(-200).join('\n');
}
