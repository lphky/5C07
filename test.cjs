const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/game.js','utf8').split('// ---- boot ----')[0];
const context=vm.createContext({setTimeout:()=>0,clearTimeout:()=>{},document:{querySelector:()=>({focus:()=>{}}),getElementById:()=>({hidden:true,textContent:''})}});
vm.runInContext(source+`;render=()=>{};logMessage=()=>{};clearLog=()=>{};buildCards=()=>{};openResult=()=>{};var lastEvents=[];playEvents=(events,done)=>{lastEvents=events;done();};`,context);
const run=s=>vm.runInContext(s,context);
function setup(mode='1v1'){run(`players={};turnQueue=${JSON.stringify(mode==='1v1'?['p1','p3']:['p1','p2','p3','p4'])};for(const id of turnQueue)players[id]={id,name:id,team:['p1','p2'].includes(id)?1:2,isAi:id!=='p1',hp:100,maxHp:100,stun:false,akCd:0};teamScores={1:0,2:0};currentRound=1;turnCount=1;selectedActions={};phase='select';`);}
function act(actions){run(`selectedActions=${JSON.stringify(actions)};resolveTurn();`);}
const a=(spell,target)=>({spell,target});
setup();act({p1:a('AK','p3'),p3:a('AK','p1')});assert.equal(run('teamScores[1]'),1);assert.equal(run('teamScores[2]'),0);
setup();act({p1:a('AK','p3'),p3:a('Riddikulus','p3')});assert.equal(run('players.p1.hp'),60);assert.equal(run('players.p1.akCd'),5);for(let i=0;i<5;i++)act({p1:a('Protego','p1'),p3:a('Protego','p3')});assert.equal(run('players.p1.akCd'),0);
setup();act({p1:a('Crucio','p3'),p3:a('Patronum','p3')});assert.equal(run('players.p3.hp'),100);assert.equal(run('players.p3.stun'),false);
setup();act({p1:a('Incendio','p3'),p3:a('Protego','p3')});assert.equal(run('players.p3.hp'),100);
setup();act({p1:a('Sectumsempra','p3'),p3:a('Protego','p3')});assert.equal(run('players.p3.hp'),75);
setup();act({p1:a('Incendio','p3'),p3:a('Expelliarmus','p1')});assert.equal(run('players.p3.hp'),100);
setup();act({p1:a('Imperio','p3')});assert.equal(run('players.p3.hp'),75);
setup('2v2');act({p1:a('Imperio','p3')});assert.equal(run('players.p4.hp'),75);
setup();run('players.p1.hp=90');act({p1:a('Episkey','p1')});assert.equal(run('players.p1.hp'),100);
setup();run('players.p1.stun=true');act({p1:a('Rennervate','p1')});assert.equal(run('players.p1.stun'),false);assert.equal(run('players.p3.hp'),100);
setup('2v2');run('players.p1.stun=true');act({p1:a('Stupefy','p3'),p2:a('Rennervate','p1')});assert.equal(run('players.p3.hp'),80);
setup('2v2');run('players.p1.hp=0');act({p1:a('AK','p3'),p2:a('Stupefy','p3')});assert.equal(run('players.p3.hp'),80);assert.equal(run('teamScores[1]'),0);
setup();run('teamScores[1]=3');act({p1:a('AK','p3')});assert.equal(run('teamScores[1]'),4);assert.equal(run('phase'),'over');
setup('2v2');act({p1:a('Crucio','p3'),p2:a('Protego','p2'),p3:a('Stupefy','p2'),p4:a('Rennervate','p3')});
assert.equal(run('JSON.stringify(lastEvents.map(e=>e.stage))'),JSON.stringify(['指令揭曉','優先 ① 復原','優先 ② 防禦','④ 行動','④ 行動']));
assert.equal(run('lastEvents[3].snap.p3.hp'),65);assert.equal(run('lastEvents[4].snap.p2.hp'),100);
assert.equal(run('lastEvents[0].rows.length'),4);
setup();run('players.p3.hp=10');act({p1:a('Stupefy','p3')});assert.equal(run('lastEvents.at(-1).tone'),'win');assert.equal(run('teamScores[1]'),1);assert.equal(run('phase'),'roundEnd');
run('nextRound()');assert.equal(run('players.p3.hp'),100);assert.equal(run('currentRound'),2);assert.equal(run('phase'),'select');
console.log('16 combat and playback scenarios passed');
