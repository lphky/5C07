'use strict';

const SPELLS = {
  Stupefy: { zh: '昏昏倒地', en: 'Stupefy', cat: 'attack', icon: '💥', target: 'enemy', short: '20 傷害', detail: '造成 20 點普通傷害。會被「屏屏障」擋下。', color: '#e67e22' },
  Incendio: { zh: '行行火現', en: 'Incendio', cat: 'attack', icon: '🔥', target: 'enemy', short: '30 傷害', detail: '造成 30 點普通傷害。會被「屏屏障」擋下。', color: '#f39c12' },
  Sectumsempra: { zh: '神鋒無影', en: 'Sectumsempra', cat: 'attack', icon: '🗡️', target: 'enemy', short: '25 傷害・穿透屏障', detail: '造成 25 點傷害，無視「屏屏障」。', color: '#ecf0f1' },
  AK: { zh: '阿哇呾喀呾啦', en: 'Avada Kedavra', cat: 'dark', icon: '💀', target: 'enemy', short: '命中即贏本局', detail: '命中即贏得本局。若目標本回合施放「叱叱，荒唐」，綠光變成黃鴨，施法者反噬 40 HP。使用後冷卻 5 回合，每局重設。', color: '#2ecc71' },
  Crucio: { zh: '咒咒虐', en: 'Crucio', cat: 'dark', icon: '🌩️', target: 'enemy', short: '35 傷害＋昏迷', detail: '造成 35 點傷害，目標下回合昏迷（跳過行動）。屏障擋不住，只有「護法現身」可以擋下。', color: '#e74c3c' },
  Imperio: { zh: '噩噩令', en: 'Imperio', cat: 'dark', icon: '🌀', target: 'enemy', short: '控制攻擊隊友 25', detail: '控制目標攻擊自己的隊友，造成 25 點傷害；1 對 1 時目標會傷害自己。屏障擋不住，只有「護法現身」可以擋下。', color: '#9b59b6' },
  Protego: { zh: '屏屏障', en: 'Protego', cat: 'defense', icon: '🛡️', target: 'self', short: '擋普通攻擊', detail: '優先發動。本回合擋下「昏昏倒地」、「行行火現」及繳械咒；擋不住黑魔法及「神鋒無影」。', color: '#3498db' },
  Patronum: { zh: '疾疾，護法現身', en: 'Expecto Patronum', cat: 'defense', icon: '🦌', target: 'ally', short: '擋咒咒虐／噩噩令', detail: '優先發動。為自己或隊友擋下本回合的「咒咒虐」及「噩噩令」。', color: '#a0aec0' },
  Riddikulus: { zh: '叱叱，荒唐', en: 'Riddikulus', cat: 'defense', icon: '🐤', target: 'self', short: '反彈索命咒', detail: '優先發動。本回合若被索命咒指向，綠光變成黃鴨，施法者反噬 40 HP。', color: '#f1c40f' },
  Expelliarmus: { zh: '去去武器走', en: 'Expelliarmus', cat: 'defense', icon: '🪄', target: 'enemy', short: '取消對方攻擊', detail: '優先發動。取消目標本回合的攻擊魔咒（防禦及治療不受影響）。會被「屏屏障」擋下。', color: '#e74c3c' },
  Episkey: { zh: '快快復甦', en: 'Episkey', cat: 'support', icon: '💚', target: 'ally', short: '回復 35 HP', detail: '為自己或隊友回復 35 HP，上限 100。倒下的巫師不能治療。', color: '#2ecc71' },
  Rennervate: { zh: '復原咒', en: 'Rennervate', cat: 'support', icon: '✨', target: 'ally', short: '解除隊友昏迷', detail: '最優先發動。解除隊友昏迷，令其本回合可以行動。自己昏迷時無法施放。', color: '#3498db' }
};

const CATS = [
  { id: 'attack', title: '攻擊', color: '#ef7a5a' },
  { id: 'dark', title: '黑魔法', color: '#b07cf5' },
  { id: 'defense', title: '防禦與反制', color: '#5aa9f0' },
  { id: 'support', title: '支援', color: '#43c38a' }
];

const GUARD_SPELLS = ['Protego', 'Patronum', 'Riddikulus'];
const PRIORITY_SPELLS = [...GUARD_SPELLS, 'Expelliarmus', 'Rennervate'];
const AVATARS = { p1: '🧙‍♂️', p2: '🧙‍♀️', p3: '🦹', p4: '🧝' };
const SPEED_MS = { slow: 3600, normal: 2400, fast: 1300, step: 0 };

let players = {};
let turnQueue = [];
let mode = '1v1';
let teamScores = { 1: 0, 2: 0 };
let currentRound = 1;
let turnCount = 1;
let selectedActions = {};
let sel = { spell: null, target: null };
let phase = 'menu';
let epoch = 0;
let timer = null;
let pb = null;
let paused = false;
let lastRound = null;
let audioCtx = null;
let speed = 'normal';
try { speed = localStorage.getItem('duel-speed') || 'normal'; } catch { speed = 'normal'; }
if (!(speed in SPEED_MS)) speed = 'normal';

const teamName = team => (team === 1 ? '玩家隊' : '電腦隊');
const nameOf = id => players[id]?.name ?? id;

function targets(id, key) {
  const p = players[id];
  const kind = SPELLS[key]?.target;
  if (!p || !kind) return [];
  return turnQueue.filter(t => players[t].hp > 0 && (
    kind === 'enemy' ? players[t].team !== p.team :
    kind === 'self' ? t === id :
    players[t].team === p.team));
}

/* ---------------- Game flow ---------------- */

function stopPending() {
  clearTimeout(timer);
  if (pb) clearTimeout(pb.timer);
  pb = null;
  epoch++;
}

function startGame(m) {
  if (!['1v1', '2v2'].includes(m)) return;
  stopPending();
  mode = m;
  turnQueue = m === '1v1' ? ['p1', 'p3'] : ['p1', 'p2', 'p3', 'p4'];
  const names = m === '1v1'
    ? { p1: '你', p3: '電腦' }
    : { p1: '你', p2: '盟友', p3: '對手甲', p4: '對手乙' };
  players = {};
  for (const id of turnQueue) {
    players[id] = { id, name: names[id], team: ['p1', 'p2'].includes(id) ? 1 : 2, isAi: id !== 'p1', hp: 100, maxHp: 100, stun: false, akCd: 0 };
  }
  teamScores = { 1: 0, 2: 0 };
  currentRound = 1;
  turnCount = 1;
  lastRound = null;
  clearLog();
  buildCards();
  logMessage(`${m === '1v1' ? '1 對 1 決鬥' : '2 對 2 團隊戰'}開始，先取得 4 局勝利者奪冠。`, 'highlight');
  beginTurn();
}

function beginTurn() {
  selectedActions = {};
  sel = { spell: null, target: null };
  phase = 'select';
  logMessage(`第 ${currentRound} 局 · 第 ${turnCount} 回合`, 'turn');
  render();
  if (players.p1.hp <= 0) startResolution();
}

function selectSpell(key) {
  if (phase !== 'select' || !players.p1 || players.p1.hp <= 0 || !SPELLS[key]) return;
  if (key === 'AK' && players.p1.akCd > 0) return;
  sel.spell = key;
  const possible = targets('p1', key);
  sel.target = possible.length === 1 ? possible[0] : (possible.includes(sel.target) ? sel.target : null);
  render();
}

function selectTarget(id) {
  if (phase !== 'select' || !sel.spell || !targets('p1', sel.spell).includes(id)) return;
  sel.target = id;
  render();
}

function cancelSelection() {
  if (phase !== 'select') return;
  sel = { spell: null, target: null };
  render();
}

function confirmCurrentPlayerTurn() {
  if (phase !== 'select' || !sel.spell || !targets('p1', sel.spell).includes(sel.target)) return;
  selectedActions.p1 = { spell: sel.spell, target: sel.target };
  startResolution();
}

function aiChoose(id) {
  const p = players[id];
  const allies = turnQueue.filter(t => players[t].team === p.team && players[t].hp > 0);
  const pool = Object.keys(SPELLS).filter(k => {
    if (k === 'AK') return p.akCd === 0;
    if (k === 'Rennervate') return allies.some(t => t !== id && players[t].stun);
    if (k === 'Episkey') return allies.some(t => players[t].hp < players[t].maxHp);
    return true;
  });
  const key = p.hp < 45 && Math.random() < 0.6 ? 'Episkey' : pool[Math.floor(Math.random() * pool.length)];
  const ts = targets(id, key);
  let target = ts[Math.floor(Math.random() * ts.length)];
  if (key === 'Episkey') target = ts.reduce((a, b) => (players[b].hp < players[a].hp ? b : a));
  if (key === 'Rennervate') target = ts.find(t => t !== id && players[t].stun) ?? target;
  return { spell: key, target };
}

function startResolution() {
  phase = 'thinking';
  render();
  const token = epoch;
  const go = () => {
    if (token !== epoch || phase !== 'thinking') return;
    if (paused) { timer = setTimeout(go, 300); return; }
    for (const id of turnQueue) {
      if (players[id].isAi && players[id].hp > 0) selectedActions[id] = aiChoose(id);
    }
    resolveTurn();
  };
  timer = setTimeout(go, 1000);
}

function resolveTurn() {
  phase = 'playing';
  const result = computeTurn();
  playEvents(result.events, () => finishTurn(result));
}

function finishTurn({ winner, reason }) {
  if (winner !== null) winRound(winner, reason);
  else { turnCount++; beginTurn(); }
}

function computeTurn() {
  const events = [];
  const guards = {};
  const blocked = new Set(turnQueue.filter(id => players[id].stun));
  for (const id of blocked) players[id].stun = false;
  const actions = Object.fromEntries(Object.entries(selectedActions).filter(([id, a]) =>
    players[id] && players[id].hp > 0 && SPELLS[a.spell] && targets(id, a.spell).includes(a.target) &&
    !(a.spell === 'AK' && players[id].akCd > 0)));

  const snap = () => Object.fromEntries(turnQueue.map(id => [id, {
    hp: players[id].hp,
    stun: players[id].stun || blocked.has(id),
    guards: [...(guards[id] ?? [])]
  }]));
  const push = ev => events.push({ ...ev, snap: snap() });
  const hurt = (id, amount) => { players[id].hp = Math.max(0, players[id].hp - amount); return { id, text: `-${amount}`, cls: 'dmg' }; };

  push({
    kind: 'reveal',
    stage: '指令揭曉',
    rows: turnQueue.filter(id => players[id].hp > 0).map(id => ({ id, action: actions[id] ?? null, stunned: blocked.has(id) }))
  });

  for (const [id, a] of Object.entries(actions)) {
    if (a.spell !== 'Rennervate' || blocked.has(id)) continue;
    const woke = blocked.delete(a.target);
    push({
      stage: '優先 ① 復原', actor: id, spell: a.spell, target: a.target, tone: woke ? 'heal' : 'fail',
      result: woke ? `${nameOf(a.target)}清醒過來，本回合可以行動` : `${nameOf(a.target)}沒有昏迷，魔咒沒有效果`,
      fx: woke ? [{ id: a.target, text: '清醒', cls: 'heal' }] : []
    });
  }

  for (const [id, a] of Object.entries(actions)) {
    if (blocked.has(id) || !GUARD_SPELLS.includes(a.spell)) continue;
    (guards[a.target] ??= new Set()).add(a.spell);
    const text = {
      Protego: `${nameOf(a.target)}張開屏障，本回合擋下普通攻擊`,
      Patronum: `${nameOf(a.target)}受護法守護，本回合不受黑魔法影響`,
      Riddikulus: `${nameOf(a.target)}準備好把索命咒變成黃鴨`
    }[a.spell];
    push({ stage: '優先 ② 防禦', actor: id, spell: a.spell, target: a.target, tone: 'guard', result: text });
  }

  const interrupted = new Set();
  for (const [id, a] of Object.entries(actions)) {
    if (blocked.has(id) || a.spell !== 'Expelliarmus') continue;
    const shielded = guards[a.target]?.has('Protego');
    if (!shielded) interrupted.add(a.target);
    push({
      stage: '優先 ③ 繳械', actor: id, spell: a.spell, target: a.target, tone: shielded ? 'guard' : 'hit',
      result: shielded ? `被${nameOf(a.target)}的屏障擋下` : `${nameOf(a.target)}的魔杖被打飛，本回合攻擊魔咒失效`,
      fx: [{ id: a.target, text: shielded ? '擋下' : '繳械', cls: shielded ? 'block' : 'info' }]
    });
  }

  let winner = null;
  let reason = '';
  const usedAK = new Set();
  for (const id of turnQueue) {
    const p = players[id];
    const a = actions[id];
    if (!a || p.hp <= 0) continue;
    if (blocked.has(id)) {
      push({ stage: '④ 行動', actor: id, tone: 'fail', result: `${nameOf(id)}昏迷中，跳過本回合`, fx: [{ id, text: '💫', cls: 'info' }] });
      continue;
    }
    const key = a.spell;
    if (PRIORITY_SPELLS.includes(key)) continue;
    const ev = { stage: '④ 行動', actor: id, spell: key, target: a.target };
    if (interrupted.has(id) && SPELLS[key].target === 'enemy') {
      push({ ...ev, tone: 'fail', result: `魔杖已被繳械，「${SPELLS[key].zh}」沒有發出` });
      continue;
    }
    const t = players[a.target];
    if (t.hp <= 0) {
      push({ ...ev, tone: 'fail', result: `${nameOf(a.target)}已經倒下，魔咒落空` });
      continue;
    }
    if (key === 'AK') {
      p.akCd = 5;
      usedAK.add(id);
      if (guards[a.target]?.has('Riddikulus')) {
        const fx = hurt(id, 40);
        push({ ...ev, tone: 'hit', sound: 'duck', result: `🐤 綠光變成一群黃鴨！${nameOf(id)}受到 40 點反噬`, fx: [fx] });
      } else {
        winner = p.team;
        reason = `${nameOf(id)}的索命咒命中${nameOf(a.target)}`;
        push({ ...ev, tone: 'win', result: `索命咒命中！${teamName(p.team)}立即贏得本局`, fx: [{ id: a.target, text: 'KO', cls: 'dmg' }] });
        break;
      }
    } else if (key === 'Episkey') {
      const amount = Math.min(35, t.maxHp - t.hp);
      t.hp += amount;
      push({ ...ev, tone: amount ? 'heal' : 'fail', result: amount ? `${nameOf(a.target)}回復 ${amount} HP` : `${nameOf(a.target)}生命值已滿，沒有效果`, fx: amount ? [{ id: a.target, text: `+${amount}`, cls: 'heal' }] : [] });
    } else if ((key === 'Crucio' || key === 'Imperio') && guards[a.target]?.has('Patronum')) {
      push({ ...ev, tone: 'guard', result: '🦌 護法擋下了黑魔法', fx: [{ id: a.target, text: '擋下', cls: 'block' }] });
    } else if (key === 'Crucio') {
      const fx = hurt(a.target, 35);
      t.stun = true;
      push({ ...ev, tone: 'hit', result: `${nameOf(a.target)}受到 35 點傷害，下回合昏迷`, fx: [fx] });
    } else if (key === 'Imperio') {
      const victim = turnQueue.find(v => v !== a.target && players[v].team === t.team && players[v].hp > 0) || a.target;
      const fx = hurt(victim, 25);
      push({ ...ev, tone: 'hit', result: victim === a.target ? `${nameOf(a.target)}被控制，攻擊了自己，受到 25 點傷害` : `${nameOf(a.target)}被控制，攻擊隊友${nameOf(victim)}，造成 25 點傷害`, fx: [fx] });
    } else {
      const amount = { Stupefy: 20, Incendio: 30, Sectumsempra: 25 }[key];
      if (key !== 'Sectumsempra' && guards[a.target]?.has('Protego')) {
        push({ ...ev, tone: 'guard', result: `${nameOf(a.target)}的屏障擋下了攻擊`, fx: [{ id: a.target, text: '擋下', cls: 'block' }] });
      } else {
        const fx = hurt(a.target, amount);
        push({ ...ev, tone: 'hit', result: `${nameOf(a.target)}受到 ${amount} 點${key === 'Sectumsempra' ? '穿透' : ''}傷害`, fx: [fx] });
      }
    }
  }

  for (const id of turnQueue) if (!usedAK.has(id)) players[id].akCd = Math.max(0, players[id].akCd - 1);

  if (winner === null) {
    const alive = team => turnQueue.some(id => players[id].team === team && players[id].hp > 0);
    if (!alive(1)) { winner = 2; reason = '玩家隊全員倒下'; }
    else if (!alive(2)) { winner = 1; reason = '電腦隊全員倒下'; }
    if (winner !== null) push({ stage: '本局結束', tone: 'win', result: `${reason}，${teamName(winner)}贏得本局` });
  }
  return { events, winner, reason };
}

function winRound(team, reason) {
  teamScores[team]++;
  lastRound = { team, reason, round: currentRound };
  logMessage(`🏆 ${teamName(team)}贏得第 ${currentRound} 局（${reason}）`, 'highlight');
  phase = teamScores[team] >= 4 ? 'over' : 'roundEnd';
  render();
  openResult();
}

function nextRound() {
  if (phase !== 'roundEnd') return;
  currentRound++;
  turnCount = 1;
  for (const p of Object.values(players)) { p.hp = p.maxHp; p.stun = false; p.akCd = 0; }
  beginTurn();
}

// ---- boot ----

/* ---------------- Interface ---------------- */

const $ = id => document.getElementById(id);
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function clearLog() { $('battle-log').replaceChildren(); }

function logMessage(text, cls = '') {
  const log = $('battle-log');
  const el = document.createElement('div');
  if (cls) el.className = cls;
  el.textContent = text;
  log.append(el);
  while (log.children.length > 300) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}

function whoHTML(id) {
  return `<span class="who t${players[id].team}">${AVATARS[id]} ${nameOf(id)}</span>`;
}
function chipHTML(key) {
  const s = SPELLS[key];
  return `<span class="chip" style="--c:${s.color}">${s.icon} ${s.zh}</span>`;
}

function buildCards() {
  for (const team of [1, 2]) {
    const col = $('team' + team);
    col.replaceChildren();
    for (const id of turnQueue.filter(t => players[t].team === team)) {
      const card = document.createElement('article');
      card.className = `card team-${team}${id === 'p1' ? ' you' : ''}`;
      card.id = 'card-' + id;
      card.dataset.id = id;
      card.innerHTML = `
        <div class="avatar" id="av-${id}" aria-hidden="true">${AVATARS[id]}</div>
        <div class="card-info">
          <div class="card-name">${nameOf(id)}<span class="role">${id.toUpperCase()}${players[id].isAi ? ' · AI' : ''}</span></div>
          <div class="hp"><div class="hp-bar"><i></i></div><span class="hp-num"></span></div>
          <div class="badges"></div>
        </div>`;
      col.append(card);
    }
  }
}

function updateCards(snap, ev) {
  for (const id of turnQueue) {
    const card = $('card-' + id);
    if (!card) continue;
    const p = players[id];
    const s = snap?.[id] ?? { hp: p.hp, stun: p.stun, guards: [] };
    const pct = Math.max(0, s.hp / p.maxHp * 100);
    const bar = card.querySelector('.hp-bar i');
    bar.style.width = pct + '%';
    bar.className = pct <= 30 ? 'low' : pct <= 60 ? 'mid' : '';
    card.querySelector('.hp-num').textContent = `${s.hp}/${p.maxHp}`;

    const badges = [];
    if (s.hp <= 0) badges.push('<span class="badge down">已倒下</span>');
    else {
      if (s.stun) badges.push('<span class="badge stun">💫 昏迷</span>');
      for (const g of s.guards) badges.push(`<span class="badge guard">${SPELLS[g].icon} ${{ Protego: '屏障', Patronum: '護法', Riddikulus: '荒唐' }[g]}</span>`);
      if (p.akCd > 0) badges.push(`<span class="badge cd">💀 索命咒冷卻 ${p.akCd}</span>`);
    }
    const targetable = !snap && phase === 'select' && sel.spell && targets('p1', sel.spell).includes(id);
    if (targetable && sel.target === id) badges.push('<span class="badge target">🎯 目標</span>');
    card.querySelector('.badges').innerHTML = badges.join('');

    card.classList.toggle('defeated', s.hp <= 0);
    card.classList.toggle('targetable', !!targetable);
    card.classList.toggle('targeted', !!targetable && sel.target === id);
    card.classList.toggle('acting', !!ev && ev.actor === id);
    card.classList.toggle('aimed', !!ev && ev.target === id && ev.actor !== id);
    if (targetable) {
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `以 ${nameOf(id)} 作為目標`);
    } else {
      card.removeAttribute('tabindex');
      card.removeAttribute('role');
      card.removeAttribute('aria-label');
    }
  }
}

function renderScore() {
  for (const team of [1, 2]) {
    $('pips-' + team).innerHTML = [0, 1, 2, 3].map(i => `<span class="pip${i < teamScores[team] ? ' on' : ''}"></span>`).join('');
  }
  $('round-label').textContent = `第 ${currentRound} 局`;
  $('turn-label').textContent = phase === 'menu' ? '未開始' : `回合 ${turnCount}`;
}

function setBanner(html, animate = true) {
  const b = $('banner');
  b.innerHTML = html;
  if (animate && !reducedMotion()) { b.classList.remove('enter'); void b.offsetWidth; b.classList.add('enter'); }
}

function renderIdleBanner() {
  let html;
  if (phase === 'select') {
    html = `<div class="ev-stage">第 ${currentRound} 局 · 第 ${turnCount} 回合</div>
      <h2 class="idle-title">輪到你選擇魔咒</h2>
      <p class="ev-note">所有巫師同時下指令，之後按次序逐步結算：<br>復原 → 防禦 → 繳械 → 其他魔咒</p>`;
  } else if (phase === 'thinking') {
    html = players.p1?.hp > 0
      ? `<div class="ev-stage">指令已鎖定</div><h2 class="idle-title">你：${chipHTML(selectedActions.p1.spell)}</h2>
         <p class="ev-note">電腦正在選擇指令<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span></p>`
      : `<div class="ev-stage">你已倒下</div><h2 class="idle-title">盟友繼續作戰</h2>
         <p class="ev-note">本局餘下回合會自動進行<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span></p>`;
  } else if ((phase === 'roundEnd' || phase === 'over') && lastRound) {
    html = `<div class="ev-stage">第 ${lastRound.round} 局結束</div>
      <h2 class="idle-title">${lastRound.team === 1 ? '🏆' : '💀'} ${teamName(lastRound.team)}勝出</h2>
      <p class="ev-note">${lastRound.reason}</p>`;
  } else {
    html = `<div class="ev-stage">霍格華茲決鬥場</div><h2 class="idle-title">請選擇遊戲模式</h2>
      <p class="ev-note">按右上角「選單」開始</p>`;
  }
  setBanner(html, false);
}

function renderSpells() {
  const p1 = players.p1;
  document.querySelectorAll('[data-spell]').forEach(b => {
    const key = b.dataset.spell;
    b.disabled = phase !== 'select' || !p1 || p1.hp <= 0 || (key === 'AK' && p1.akCd > 0);
    b.setAttribute('aria-pressed', String(sel.spell === key));
    if (key === 'AK') b.querySelector('.spell-tag').textContent = p1?.akCd ? `冷卻中，尚餘 ${p1.akCd} 回合` : SPELLS.AK.short;
  });
}

function renderDetail() {
  const d = $('detail');
  const focusKey = d.contains(document.activeElement) ? document.activeElement.dataset.fk : null;
  if (!sel.spell || phase !== 'select') {
    d.innerHTML = `<div class="detail-empty">
      <div class="detail-big" aria-hidden="true">🪄</div>
      <p><strong>第一步：選擇一個魔咒</strong></p>
      <p>點選魔咒卡後，這裡會顯示效果及可選目標。</p>
      <ul class="tips">
        <li>🛡️ 防禦、繳械及復原會<strong>優先</strong>結算</li>
        <li>💀 索命咒命中即贏本局，但小心「荒唐」反彈</li>
        <li>💫 被咒咒虐擊中會昏迷一回合</li>
      </ul></div>`;
    return;
  }
  const s = SPELLS[sel.spell];
  const cat = CATS.find(c => c.id === s.cat);
  const ts = targets('p1', sel.spell);
  const ready = ts.includes(sel.target);
  d.innerHTML = `
    <div class="detail-head" style="--c:${cat.color}">
      <span class="detail-big" aria-hidden="true">${s.icon}</span>
      <div><h3>${s.zh}</h3><small>${s.en} · ${cat.title}</small></div>
    </div>
    <p class="detail-text">${s.detail}</p>
    <p class="detail-label">第二步：選擇目標${ts.length > 1 ? ' <span class="muted">（亦可直接點角色卡）</span>' : ''}</p>
    <div class="target-list">${ts.map(id => `<button type="button" data-target="${id}" data-fk="t-${id}" aria-pressed="${sel.target === id}">${AVATARS[id]} ${nameOf(id)}</button>`).join('')}</div>
    <div class="summary${ready ? ' ready' : ''}">${ready ? `你將對 <strong>${nameOf(sel.target)}</strong> 施展 <strong>${s.zh}</strong>` : '請先選擇目標'}</div>
    <div class="detail-actions">
      <button type="button" class="ghost" data-act="cancel" data-fk="cancel">取消</button>
      <button type="button" class="primary" data-act="confirm" data-fk="confirm" ${ready ? '' : 'disabled'}>確認發動 ✦</button>
    </div>`;
  if (focusKey) d.querySelector(`[data-fk="${focusKey}"]`)?.focus();
}

function renderCommand() {
  const steps = [...$('steps').children];
  const stage = phase !== 'select' ? 3 : !sel.spell ? 0 : !sel.target ? 1 : 2;
  steps.forEach((li, i) => {
    li.classList.toggle('now', i === stage);
    li.classList.toggle('done', i < stage);
  });
  renderSpells();
  renderDetail();
  const lock = $('command-lock');
  const msg = {
    menu: '<p>請先選擇遊戲模式</p>',
    thinking: '<p>🤖 電腦正在選擇指令…</p>',
    playing: '<p>⏳ 回合結算中，請看上方決鬥場</p><p class="muted">可在右上角調整結算速度，或按「略過動畫」</p>',
    roundEnd: '<p>本局結束</p>',
    over: '<p>比賽結束</p>'
  }[phase];
  lock.hidden = !msg;
  if (msg) lock.innerHTML = `<div>${msg}</div>`;
}

function renderPlayback() {
  const box = $('playback');
  box.hidden = !pb;
  $('banner').classList.toggle('clickable', !!pb);
  if (!pb) return;
  const n = pb.events.length;
  const last = pb.i >= n - 1;
  $('pb-progress').textContent = `第 ${pb.i + 1} / ${n} 步`;
  const next = $('pb-next');
  next.textContent = last ? '完成本回合 ▶' : '下一步 ▶';
  next.classList.toggle('primary', speed === 'step');
  next.classList.toggle('ghost', speed !== 'step');
  $('pb-skip').hidden = last;
}

function render() {
  if (!$('banner')) return;
  renderScore();
  const ev = pb ? pb.events[pb.i] : null;
  updateCards(ev?.snap ?? null, ev);
  renderCommand();
  if (!pb) renderIdleBanner();
  renderPlayback();
}

/* ---------------- Paced playback ---------------- */

function playEvents(events, done) {
  pb = { events, i: -1, done, token: epoch, timer: null };
  renderCommand();
  pbAdvance();
}

function pbAdvance() {
  if (!pb || pb.token !== epoch) return;
  clearTimeout(pb.timer);
  pb.i++;
  if (pb.i >= pb.events.length) {
    const done = pb.done;
    pb = null;
    done();
    return;
  }
  showEvent(pb.events[pb.i]);
  pbSchedule();
}

function pbSchedule() {
  if (!pb || speed === 'step' || paused) return;
  clearTimeout(pb.timer);
  const ev = pb.events[pb.i];
  const factor = ev.kind === 'reveal' ? 1 + 0.25 * ev.rows.length : 1;
  pb.timer = setTimeout(pbAdvance, SPEED_MS[speed] * factor);
}

function pbSkip() {
  if (!pb || pb.token !== epoch) return;
  clearTimeout(pb.timer);
  for (let i = pb.i + 1; i < pb.events.length; i++) logEvent(pb.events[i]);
  const done = pb.done;
  pb = null;
  done();
}

function eventHTML(ev) {
  if (ev.kind === 'reveal') {
    const rows = ev.rows.map(r => {
      const a = r.action;
      const body = a
        ? `${chipHTML(a.spell)}${a.target !== r.id ? `<span class="arrow">→</span>${whoHTML(a.target)}` : '<span class="muted">（自己）</span>'}`
        : '<span class="muted">沒有指令</span>';
      return `<li>${whoHTML(r.id)}${r.stunned ? '<em>💫 昏迷中</em>' : ''}${body}</li>`;
    }).join('');
    return `<div class="ev-stage">${ev.stage}</div><ul class="reveal">${rows}</ul>
      <p class="ev-note">接下來按優先次序逐步結算</p>`;
  }
  let line = ev.actor ? whoHTML(ev.actor) : '';
  if (ev.spell) {
    line += chipHTML(ev.spell);
    if (ev.target && ev.target !== ev.actor) line += `<span class="arrow">→</span>${whoHTML(ev.target)}`;
  }
  return `<div class="ev-stage">${ev.stage}</div>
    ${line ? `<div class="ev-line">${line}</div>` : ''}
    <p class="ev-result tone-${ev.tone}">${ev.result}</p>`;
}

function logEvent(ev) {
  if (ev.kind === 'reveal') {
    const parts = ev.rows.map(r => `${nameOf(r.id)}${r.stunned ? '（昏迷）' : ''}：${r.action ? SPELLS[r.action.spell].zh + (r.action.target !== r.id ? ` → ${nameOf(r.action.target)}` : '') : '沒有指令'}`);
    logMessage(`指令揭曉｜${parts.join('；')}`);
    return;
  }
  const cls = { hit: 'danger', heal: 'heal', guard: 'guard', win: 'highlight' }[ev.tone] ?? '';
  const head = ev.spell ? `${nameOf(ev.actor)}【${SPELLS[ev.spell].zh}】${ev.target && ev.target !== ev.actor ? `→ ${nameOf(ev.target)}` : ''}：` : '';
  logMessage(head + ev.result, cls);
}

function showEvent(ev) {
  setBanner(eventHTML(ev));
  updateCards(ev.snap, ev);
  renderPlayback();
  logEvent(ev);
  if (ev.spell && ev.actor) beam(ev.actor, ev.target, SPELLS[ev.spell].color);
  for (const f of ev.fx ?? []) floatText(f);
  playSound(ev.sound ?? (ev.tone === 'hit' || ev.tone === 'win' ? 'hit' : ev.spell ? 'cast' : null));
}

function floatText({ id, text, cls }) {
  const card = $('card-' + id);
  if (!card) return;
  const el = document.createElement('span');
  el.className = `float ${cls}`;
  el.textContent = text;
  card.append(el);
  setTimeout(() => el.remove(), 1700);
  if (reducedMotion()) return;
  const anim = cls === 'dmg' ? 'shake' : cls === 'heal' ? 'glow' : null;
  if (anim) { card.classList.remove(anim); void card.offsetWidth; card.classList.add(anim); setTimeout(() => card.classList.remove(anim), 900); }
}

let beamFrame = 0;
function beam(from, to, color) {
  if (reducedMotion()) return;
  const cv = $('fx-canvas');
  const ctx = cv.getContext?.('2d');
  const a = $('av-' + from)?.getBoundingClientRect();
  const b = $('av-' + to)?.getBoundingClientRect();
  if (!ctx || !a || !b) return;
  const r = cv.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  cv.width = r.width * dpr;
  cv.height = r.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const x1 = a.x + a.width / 2 - r.x, y1 = a.y + a.height / 2 - r.y;
  const x2 = b.x + b.width / 2 - r.x, y2 = b.y + b.height / 2 - r.y;
  const start = performance.now();
  const id = ++beamFrame;
  const frame = now => {
    if (id !== beamFrame) return;
    const k = (now - start) / 1100;
    ctx.clearRect(0, 0, r.width, r.height);
    if (k >= 1) return;
    const grow = Math.min(1, k * 3);
    ctx.globalAlpha = 1 - Math.max(0, (k - 0.45) / 0.55);
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.lineCap = 'round';
    if (from === to) {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x1, y1, 30 + 18 * grow, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + (x2 - x1) * grow, y1 + (y2 - y1) * grow);
      ctx.stroke();
      if (grow === 1) {
        ctx.beginPath();
        ctx.arc(x2, y2, 10 + 30 * (k - 0.33), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function playSound(type) {
  if (!type) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const now = audioCtx.currentTime;
    o.type = type === 'hit' ? 'sawtooth' : type === 'duck' ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(type === 'hit' ? 180 : type === 'duck' ? 650 : 450, now);
    o.frequency.exponentialRampToValueAtTime(type === 'hit' ? 60 : type === 'duck' ? 320 : 880, now + 0.22);
    g.gain.setValueAtTime(0.07, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.onended = () => { o.disconnect(); g.disconnect(); };
    o.start(now);
    o.stop(now + 0.26);
  } catch { /* sound is optional */ }
}

/* ---------------- Dialogs ---------------- */

function setPaused(value) {
  paused = value;
  if (paused) { if (pb) clearTimeout(pb.timer); }
  else pbSchedule();
}

function openMenu() {
  const inGame = ['select', 'thinking', 'playing'].includes(phase);
  $('resume-btn').hidden = !inGame;
  setPaused(true);
  if (!$('mode-dialog').open) $('mode-dialog').showModal();
  $('mode-dialog').querySelector('[data-mode]').focus();
}

function closeMenu() {
  $('mode-dialog').close();
}

function openResult() {
  const card = $('result-card');
  const won = lastRound.team === 1;
  const final = phase === 'over';
  const scoreHTML = `<div class="result-score">
      <span class="team1">玩家隊<span class="big">${teamScores[1]}</span></span>
      <span class="big muted">:</span>
      <span class="team2">電腦隊<span class="big">${teamScores[2]}</span></span>
    </div>`;
  if (final) {
    card.innerHTML = `<div class="result-emoji">${won ? '🏆' : '🌧️'}</div>
      <h2 id="result-title">${won ? '恭喜！玩家隊奪得決鬥冠軍' : '電腦隊奪冠，下次再挑戰'}</h2>
      <p class="result-reason">決勝局：${lastRound.reason}</p>${scoreHTML}
      <div class="result-actions">
        <button type="button" class="primary" data-result="again">再玩一次（${mode === '1v1' ? '1 對 1' : '2 對 2'}）</button>
        <button type="button" class="ghost" data-result="menu">選擇其他模式</button>
      </div>`;
  } else {
    card.innerHTML = `<div class="result-emoji">${won ? '✨' : '💀'}</div>
      <h2 id="result-title">第 ${lastRound.round} 局 · ${teamName(lastRound.team)}勝出</h2>
      <p class="result-reason">${lastRound.reason}</p>${scoreHTML}
      <p class="muted">先取得 4 勝者奪冠。下一局所有巫師回復滿 HP，索命咒冷卻重設。</p>
      <div class="result-actions">
        <button type="button" class="primary" data-result="next">開始第 ${lastRound.round + 1} 局</button>
      </div>`;
  }
  $('result-dialog').showModal();
  card.querySelector('.primary').focus();
}

function buildRulesTable() {
  $('rules-table').tBodies[0].innerHTML = CATS.flatMap(c => Object.entries(SPELLS).filter(([, s]) => s.cat === c.id)
    .map(([, s]) => `<tr><td>${s.icon} ${s.zh}<br><small class="muted">${s.en}</small></td><td>${c.title}</td><td>${s.detail}</td></tr>`)).join('');
}

function buildSpells() {
  const box = $('spells');
  for (const c of CATS) {
    const h = document.createElement('h3');
    h.className = 'cat-title';
    h.style.setProperty('--c', c.color);
    h.textContent = c.title;
    const grid = document.createElement('div');
    grid.className = 'spell-grid';
    for (const [key, s] of Object.entries(SPELLS).filter(([, s]) => s.cat === c.id)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'spell';
      b.dataset.spell = key;
      b.style.setProperty('--c', c.color);
      b.innerHTML = `<span class="spell-icon" aria-hidden="true">${s.icon}</span>
        <span class="spell-name">${s.zh}<small>${s.en}</small></span>
        <span class="spell-tag">${s.short}</span>`;
      b.addEventListener('click', () => {
        selectSpell(key);
        if (window.matchMedia('(max-width: 900px)').matches) $('detail').scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      });
      grid.append(b);
    }
    box.append(h, grid);
  }
}

function boot() {
  buildSpells();
  buildRulesTable();
  $('speed').value = speed;
  $('speed').addEventListener('change', e => {
    speed = e.target.value;
    try { localStorage.setItem('duel-speed', speed); } catch { /* optional */ }
    if (pb) { clearTimeout(pb.timer); pbSchedule(); }
    renderPlayback();
  });

  $('detail').addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.target) { selectTarget(t.dataset.target); $('detail').querySelector('[data-act="confirm"]')?.focus(); }
    else if (t.dataset.act === 'confirm') confirmCurrentPlayerTurn();
    else if (t.dataset.act === 'cancel') cancelSelection();
  });

  const pickCard = e => {
    const card = e.target.closest('.card.targetable');
    if (!card) return false;
    selectTarget(card.dataset.id);
    return true;
  };
  $('arena').addEventListener('click', e => {
    if (pickCard(e)) return;
    if (pb && e.target.closest('#banner')) pbAdvance();
  });
  $('arena').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && pickCard(e)) e.preventDefault();
  });
  document.addEventListener('keydown', e => {
    if (!pb || paused || document.querySelector('dialog[open]')) return;
    if (e.target.closest?.('button, select, input, summary, .card')) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); pbAdvance(); }
  });

  $('pb-next').addEventListener('click', pbAdvance);
  $('pb-skip').addEventListener('click', pbSkip);
  $('menu-btn').addEventListener('click', openMenu);
  $('rules-btn').addEventListener('click', () => { setPaused(true); $('rules-dialog').showModal(); $('rules-close').focus(); });
  $('rules-close').addEventListener('click', () => $('rules-dialog').close());
  $('rules-dialog').addEventListener('close', () => { if (!$('mode-dialog').open) setPaused(false); });

  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    playSound('cast');
    closeMenu();
    startGame(b.dataset.mode);
  }));
  $('resume-btn').addEventListener('click', closeMenu);
  $('mode-dialog').addEventListener('cancel', e => { if (phase === 'menu' || phase === 'over' || phase === 'roundEnd') e.preventDefault(); });
  $('mode-dialog').addEventListener('close', () => { setPaused(false); if (phase === 'over') openResult(); });

  $('result-dialog').addEventListener('cancel', e => e.preventDefault());
  $('result-card').addEventListener('click', e => {
    const action = e.target.closest('[data-result]')?.dataset.result;
    if (!action) return;
    $('result-dialog').close();
    if (action === 'next') nextRound();
    else if (action === 'again') startGame(mode);
    else if (action === 'menu') { phase = 'menu'; render(); openMenu(); }
  });

  render();
  openMenu();
}

if (typeof document !== 'undefined' && document.getElementById('banner')) boot();
