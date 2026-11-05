'use strict';
let playerHp = 100, aiHp = 100, playerScore = 0, aiScore = 0;
let isPlayerShield = false, isAiShield = false, akCd = 0;
let phase = 'player';
const WINNING_SCORE = 4;
const SPELLS = {
  STU: { name: '昏昏倒地', latin: 'Stupefy', power: 20, type: 'attack', color: '#f97316' },
  INC: { name: '行行火現', latin: 'Incendio', power: 30, type: 'attack', color: '#eab308' },
  AK: { name: '阿哇呾喀呾啦', latin: 'Avada Kedavra', type: 'half_hp', color: '#2ecc71' },
  CRU: { name: '咒咒虐', latin: 'Crucio', power: 25, type: 'attack', color: '#a855f7' },
  PRO: { name: '屏屏障', latin: 'Protego', type: 'defend', color: '#3b82f6' },
  RID: { name: '叱叱，荒唐', latin: 'Riddikulus', power: 20, type: 'attack', color: '#f59e0b' },
  EPI: { name: '快快復甦', latin: 'Episkey', power: 35, type: 'heal', color: '#10b981' },
  REN: { name: '復原咒', latin: 'Rennervate', power: 20, type: 'heal', color: '#06b6d4' }
};
const el = id => document.getElementById(id);
function chant(latin) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(latin);
    utter.lang = 'en-GB';
    utter.pitch = .95;
    window.speechSynthesis.speak(utter);
  } catch {}
}
function cast(key, human) {
  const spell = SPELLS[key];
  const who = human ? '你' : '電腦';
  let message = `${who}施展【${spell.name}】：`;
  chant(spell.latin);
  if (spell.type === 'heal') {
    const hp = human ? playerHp : aiHp;
    const amount = Math.min(spell.power, 100 - hp);
    if (human) playerHp += amount; else aiHp += amount;
    showDmg(human ? 'p1' : 'ai', `+${amount}`, spell.color);
    message += `恢復 ${amount} HP。`;
  } else if (spell.type === 'defend') {
    if (human) isPlayerShield = true; else isAiShield = true;
    message += '護盾已就緒，反彈下一次攻擊。';
  } else {
    const reflected = human ? isAiShield : isPlayerShield;
    if (reflected) {
      if (human) isAiShield = false; else isPlayerShield = false;
    }
    const hitPlayer = human ? reflected : !reflected;
    const hp = hitPlayer ? playerHp : aiHp;
    const damage = spell.type === 'half_hp' ? Math.floor(hp / 2) : Math.min(hp, spell.power);
    if (hitPlayer) playerHp -= damage; else aiHp -= damage;
    showDmg(hitPlayer ? 'p1' : 'ai', `-${damage}${reflected ? ' 反彈' : ''}`, spell.color);
    message += `${reflected ? '被護盾反彈！' : ''}${hitPlayer ? '你' : '電腦'}受到 ${damage} 點傷害。`;
  }
  updateLog(message);
}
function playerCast(key) {
  if (phase !== 'player' || !Object.hasOwn(SPELLS, key) || (key === 'AK' && akCd > 0)) return;
  phase = 'ai-ready';
  if (key === 'AK') akCd = 3;
  else if (akCd > 0) akCd--;
  cast(key, true);
  checkWin();
  updateUI();
}
function aiTurn() {
  if (phase !== 'ai-ready') return;
  phase = 'player';
  const keys = ['STU', 'INC', 'PRO', 'EPI', 'RID', 'CRU'];
  cast(keys[Math.floor(Math.random() * keys.length)], false);
  checkWin();
  updateUI();
}
function continueGame() {
  if (phase === 'ai-ready') aiTurn();
  else if (phase === 'round-end') resetRound();
}
function checkWin() {
  if (phase === 'round-end' || phase === 'match-end' || (playerHp > 0 && aiHp > 0)) return false;
  const won = aiHp <= 0;
  if (won) playerScore++; else aiScore++;
  phase = Math.max(playerScore, aiScore) >= WINNING_SCORE ? 'match-end' : 'round-end';
  updateLog(`${won ? '你' : '電腦'}贏得本局！比分 ${playerScore}：${aiScore}。${phase === 'match-end' ? '比賽結束，率先四勝！按「重新開始」再玩。' : '閱讀結果後按「開始下一局」。'}`);
  return true;
}
function updateUI() {
  for (const [id, hp, shield] of [['p1', playerHp, isPlayerShield], ['ai', aiHp, isAiShield]]) {
    el(`hp-${id}`).style.width = `${hp}%`;
    el(`hp-text-${id}`).textContent = `${hp}/100${shield ? ' 🛡️' : ''}`;
    el(`card-${id}`).setAttribute('aria-label', `${id === 'p1' ? '玩家' : '電腦'} ${hp} HP${shield ? '，護盾就緒' : ''}`);
  }
  el('akBadge').textContent = akCd ? `CD: ${akCd}` : 'READY';
  document.querySelectorAll('[data-spell]').forEach(card => {
    const disabled = phase !== 'player' || (card.dataset.spell === 'AK' && akCd > 0);
    card.setAttribute('aria-disabled', String(disabled));
    card.querySelector('button').disabled = disabled;
  });
  el('turnFlowPrompt').textContent = { player: '輪到你：選擇一個魔咒', 'ai-ready': '先閱讀結果，再按繼續', 'round-end': '本局結束', 'match-end': '比賽結束 · 率先四勝' }[phase];
  el('continueBtn').hidden = phase !== 'ai-ready' && phase !== 'round-end';
  el('continueBtn').textContent = phase === 'round-end' ? '開始下一局' : '繼續：電腦出招';
  renderGems();
}
function renderGems() {
  for (const [id, score, color] of [['p1ScoreGems', playerScore, 'blue'], ['aiScoreGems', aiScore, 'emerald']]) {
    el(id).innerHTML = Array.from({length: WINNING_SCORE}, (_, i) => `<div class="w-3 h-3 rounded-sm border ${i < score ? `bg-${color}-500 border-${color}-300` : 'bg-zinc-900 border-zinc-700'}"></div>`).join('');
    el(id).setAttribute('aria-label', `${score} 勝，共需四勝`);
  }
}
function updateLog(message) {
  el('battleLogText').textContent = message;
  el('resultText').textContent = message;
  const line = document.createElement('p');
  line.textContent = message;
  el('history').appendChild(line);
}
function showDmg(target, text, color) {
  const card = el(`card-${target}`);
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const node = document.createElement('div');
  node.className = 'float-dmg';
  node.textContent = text;
  node.style.color = color;
  node.style.left = `${rect.left + rect.width / 2 - 15}px`;
  node.style.top = `${rect.top}px`;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 1200);
}
function resetRound() {
  playerHp = aiHp = 100;
  isPlayerShield = isAiShield = false;
  akCd = 0;
  phase = 'player';
  el('history').innerHTML = '';
  updateLog('新一局開始！選擇魔咒出招。');
  updateUI();
}
function restartGame() {
  try { window.speechSynthesis?.cancel(); } catch {}
  document.querySelectorAll('.float-dmg').forEach(node => node.remove());
  playerScore = aiScore = 0;
  resetRound();
}
updateUI();
