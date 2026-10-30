import {genericLoss,lossMessage} from './loss-feedback.js';
import { createArtLoader } from './art-loading.js';
import { STORYBOOK_MARBLE_FRAMES } from './storybook-marble-frames.js';
import {rewindFrame,lossDragonPose} from './loss-animation.js';
import { ShellArt } from './shell-art.js';
import { dragonPose, PARTY_BEATS } from './dragon-animation.js';
import { JUMP, POP_HOLD, POP_RATE, jumpTiming, jumpShape, crossingPoint, popScale, popFlash, finaleHang, finaleClock, FINALE_HANG_EXTRA } from './jump-motion.js';
import { createSoundtrack, SOUNDTRACKS, soundtrackId } from './music.js';
import { createBiteSound } from './bite-sound.js';
import { createSfx, SFX_DUCKS, COLOR_STEP, collectStep, chainKind } from './sound-fx.js';
import { MECHANIC_HELP, MECHANIC_SEEN_KEY, readSeenMechanics, unseenMechanics } from './mechanic-tutorial.js';
import { EarlyLevelHelp } from './early-level-help.js';
import { REWARDS_KEY, normalizeRewards, spendHint, spendUndo, grantUndo, grantVideoReward } from './rewards.js';
import { LIVES_KEY, MAX_LIVES, normalizeLives, spendLife, grantLife, lifeCountdown } from './lives.js';
import { playNativeHaptic } from './native-haptics.js';
import { SIZE, LEVELS as CLASSIC_LEVELS, getMoves, applyMove, getHint, isMovable, pegHardness, jumpEffect, puzzleKey } from './game-rules.js';
import { BOARD_SHAPES } from './board-shapes.js';
import { CAMPAIGN, goalProgress, goalComplete, normalizeProgress, completeLevel, solveGoal } from './campaign.js';
import CHAPTERS from './campaign-chapters.js';
import { createGameplayScenes } from './gameplay-scenes.js';
import LEVEL_600 from './level-600-data.js';
import { createJuice } from './juice.js';
import { META_KEY, withGoldenBall, goldenWasEaten } from './meta-rules.js';
import { createMetaLayer } from './meta-ui.js';
const CHALLENGE_INDEX=CAMPAIGN.length+CLASSIC_LEVELS.length;
const LAST_PLAYABLE_LEVEL=100; // The Coming soon marker follows the final level of region 1.
const LEVELS=[...CAMPAIGN,...CLASSIC_LEVELS,{...LEVEL_600,cells:CLASSIC_LEVELS[0].cells}];
const CHAPTER_NAMES=['Morning at Miso’s','The Flower Courtyard','Bookshop Naps','Riverside Market','Craft Room Tangles','Orchard Picnic','Clover Garden','The Old Mill Bakery','Lantern Lane','The Grand Tasting Party','Forest Threshold','Dewdrop Mushrooms','The Blue Stream','Branch Nests','The Brambles','Mossy Paths','The Pond','Fireflies','The Ancient Oak','Blackberry Feast'];
const EARLY_LEVEL_NAMES=['First Order','Another Jump','A Short Route','Choose the Raspberry Treats','Three Raspberry Treats','Open a Path','Prepare First','A Café Break','Two Flavors','Share the Jumps','Think Ahead','An Easy Order','Two Routes','The Detour','Prepare the Apricot Treat','Find the Rhythm','A Two-Flavor Plan','Plan the Path','Keep Your Supports','The Courtyard Tasting','A New Order','Your Choice','Two Paths','Sweet Pause','The Bookshop Garden','Apricot and Company','Cross the Paths','An Easy Jump','Five Mint Treats','A Shared Order','Flavor Crossing','Free Treat','The Apricot Harvest','Flavor Pairs','Find Your Route','Three and Served','Choose Your Five','Open Paths','A Big Order','The Café Banquet'];
const LEVEL_ROLES=['Breather','Observe','Practice','Choose','Prepare','Connect','Combine','Plan','Master','Chapter Challenge'];
const displayLevelName=index=>EARLY_LEVEL_NAMES[index]||`${CHAPTER_NAMES[Math.floor(index/10)]} · ${LEVEL_ROLES[index%10]}`;
const $ = id => document.getElementById(id);
const game=$('game'), canvas=$('scene'), ctx=canvas.getContext('2d',{alpha:true}), controls=$('board-controls'), menu=$('menu'), pauseMenu=$('pause-menu');
const preferences={sound:true,music:true,sfx:true,haptics:true,motion:matchMedia('(prefers-reduced-motion: reduce)').matches,storybook:false,musicTrack:'cozy',meta:true};
const STORAGE={settings:'meow-munchies-settings',campaign:'meow-munchies-campaign'};
try{const saved=JSON.parse(localStorage.getItem(STORAGE.settings)||'{}');Object.assign(preferences,saved);if(!Object.hasOwn(saved,'music'))preferences.music=saved.sound!==false;if(!Object.hasOwn(saved,'sfx'))preferences.sfx=saved.sound!==false;}catch{}
preferences.storybook=false;
// Keep the full map economy available: Shop, Pachinko, Collection and daily rewards.
preferences.meta=preferences.meta!==false;
const juice=createJuice(game,{reduced:()=>preferences.motion});
preferences.musicTrack=soundtrackId(preferences.musicTrack);
const artLoader=createArtLoader();
const splashLogo=$('splash-logo'), bittenLogo=artLoader.image('assets/meow-munchies/logo.svg');
const foregroundLayer=$('foreground-rocks');
const chapterScenery=createGameplayScenes(game,foregroundLayer,$('gameplay-ambient'));
let chapterSceneryReady=Promise.resolve();
let entrance=null,startingGame=false;
const clamp01=value=>Math.max(0,Math.min(1,value));
const modernMarbleAtlas=artLoader.image('assets/meow-munchies/munchies-atlas-v1.webp'),storybookMarbles={};
for(const color of ['mint','pink','orange','socket']){
  storybookMarbles[color]=artLoader.image(`assets/storybook/marbles/${color}.webp`);
}
for(const [color,frame] of Object.entries(STORYBOOK_MARBLE_FRAMES)){
  game.style.setProperty(`--storybook-${color}-size`,frame.backgroundSize);
  game.style.setProperty(`--storybook-${color}-position`,frame.backgroundPosition);
}
const dragonLayer=$('dragon-layer');
// Reuse one alpha mask so a white glint follows the painted sprite, including shells.
const emphasisMask=document.createElement('canvas');emphasisMask.width=emphasisMask.height=256;
const emphasisCtx=emphasisMask.getContext('2d');
const dragonStyles={
  modern:['assets/meow-munchies/miso-idle-v2.png','assets/meow-munchies/miso-anticipation-v2.png','assets/meow-munchies/miso-delighted-v2.png','assets/meow-munchies/miso-sad-v2.png'],
  storybook:['assets/meow-munchies/miso-idle-v2.png','assets/meow-munchies/miso-anticipation-v2.png','assets/meow-munchies/miso-delighted-v2.png','assets/meow-munchies/miso-sad-v2.png'],
};
let dragonSources=preferences.storybook?dragonStyles.storybook:dragonStyles.modern;
dragonLayer.src=dragonSources[0];
const dragonVariants=new Map(Object.values(dragonStyles).flat().map(src=>[src,artLoader.image(src)]));
const biteArt=['bite-nam-v1.webp','bite-mmm-v1.webp','bite-rico-v1.webp',...Array.from({length:4},(_,i)=>`bite-combo-${i+2}-v1.webp`)].map(file=>artLoader.image(`assets/${file}`));
let lastBiteVariant=-1;
const winExpressions=[
  {text:'Order served!',file:'served.svg'},
  {text:'Miso approves!',file:'served.svg'},
  {text:'That hit the spot!',file:'served.svg'},
].map(({text,file})=>({text,image:artLoader.image(`assets/meow-munchies/${file}`)}));
function prepareMarbles(storybook=preferences.storybook){
  return Promise.all((storybook?Object.values(storybookMarbles):[modernMarbleAtlas]).map(image=>artLoader.load(image)));
}
function warmPlayArt(){
  const poses=dragonSources.map(src=>dragonVariants.get(src));
  Promise.all([...poses,...biteArt,...winExpressions.map(item=>item.image),catDiamondArt].map(image=>artLoader.load(image))).catch(error=>console.warn('Optional artwork unavailable',error));
}
let lastWinVariant=-1;
const stoneArt=new Image();
const catDiamondArt=artLoader.image('assets/ui/meta/cat-diamond-v1.webp');
const shellArt=new ShellArt();
let supportImpact=null;
const mechanicDialog=$('mechanic-intro');
let seenMechanics=new Set(),activeMechanic=null,mechanicDemoStart=0;
try{seenMechanics=readSeenMechanics(localStorage.getItem(MECHANIC_SEEN_KEY));}catch{}
let currentDragonFrame=0;
// Dragon mood: whether the last bite was food in the order, and the next beat of the order party.
let biteLiked=true,cheerBeat=9;
let W=390,H=844,pitch=52,board={x:15,y:67,size:360}, mouth={x:220,y:576},dragonBox={},levelIndex=0,level,pegs=[],history=[],moves=[],selected=null,hint=null,drag=null,jump=null,returning=null,falling=[],particles=[],capturePulses=[],time=0,lastFrame=0,accumulator=0,raf=0,feedbackUntil=0,chew=0,lastPop=-2,streak=0,keyboardCell='3,3',resultDue=0,audio=null,soundtrack=null,biteSound=null,sfx=null,ready=false;
let progress=normalizeProgress(null);try{progress=normalizeProgress(JSON.parse(localStorage.getItem(STORAGE.campaign)||'null'));}catch{}
let rewards=normalizeRewards(null,progress.completed);
try{rewards=normalizeRewards(JSON.parse(savedValue(REWARDS_KEY,LEGACY_REWARDS_KEY)||'null'),progress.completed);}catch{}
let chapterHintEarned=false,adKind=null,adTimer=0,adReturnFocus=null,attemptFailed=false,undoRemaining=rewards.undos,pendingLifeAction=null;
let lossNoticeUntil=0;
let lives=normalizeLives(null);
try{lives=normalizeLives(JSON.parse(localStorage.getItem(LIVES_KEY)||'null'));}catch{}
const earlyLevelHelp=new EarlyLevelHelp();
let contextualMessage='';
let idleMove=null,idleMoveActionAt=-1,idleMoveShownAt=0;
let mapOpen=false,mapFrame=null,mapReady=false,mapCompletedLevel=null,metaLayer=null;
const mapLayer=$('level-map');
const query=new URLSearchParams(location.search);
const localPreview= ['localhost','127.0.0.1'].includes(location.hostname)?Number(query.get('nivel'))-1:-1;
const previewIndex=Number.isInteger(localPreview)&&localPreview>=0&&localPreview<CAMPAIGN.length?localPreview:-1;
const requestedLevel=Number(query.get('level'))-1;
const mapEntry=query.get('play')==='1'&&Number.isInteger(requestedLevel)&&requestedLevel>=0&&requestedLevel<LAST_PLAYABLE_LEVEL&&requestedLevel<=progress.completed;
const localDirectPreview=previewIndex>=0&&query.get('direct')==='1';
const startIndex=query.get('reto')==='600'?CHALLENGE_INDEX:mapEntry?requestedLevel:previewIndex>=0?previewIndex:Math.min(progress.completed,LAST_PLAYABLE_LEVEL-1);
let cheerAt=-9,stampedColors=new Set(),chain=0,chainRun=0,chainUntil=-9,chainDepth=0,shownRun=-1,shownLink=0,chainWordUntil=0,deliveries=[],drawnOrder='',winWaveAt=-1,won=false,hintWorker=null,hintRequest=0,hintBusy=false,hintTimeout=0,confetti=[],landing=null,transitioning=false,autoContinueAt=0,mapTransitionTimer=0,lost=null,lastPlayedMove=null,playedMoves=[];
const VICTORY={PLAYING:'PLAYING',TRIGGERED:'VICTORY_TRIGGERED',CLEARING:'CLEARING_REMAINING_BALLS',CELEBRATION:'FINAL_CELEBRATION',REWARDS:'REWARDS_REVEAL',WAITING:'WAITING_FOR_CONTINUE',TRANSITIONING:'TRANSITIONING'};
let victoryPhase=VICTORY.PLAYING,victoryStartedAt=0,victoryClears=new Map(),victoryReward={balls:0,golden:0},victoryCelebrated=false,victoryRewardSound=false;
// A chain survives this long (game seconds) from one jump landing to the next jump.
const CHAIN_WINDOW=4;
// Reused by render for the jumping ball: no allocation per frame.
const jumpPose={t:0,u:0,height:0,sx:1,sy:1,sink:0};
function clearLoss({keepNotice=false}={}){
  lossRecoveryGuard.cancel({dispose:true});
  if(lost)$('instruction').textContent='';
  lost?.animations?.forEach(animation=>animation.cancel());
  lost=null;lastPlayedMove=null;game.classList.remove('order-lost');
  game.classList.remove('loss-animating');delete game.dataset.lossPhase;
  lockLossControls(false);$('lost-heart').hidden=true;
  if(!keepNotice)hideLossNotice();
  controls.removeAttribute('aria-disabled');
}
function cancelPositionCheck(){}
function checkCurrentPosition(){
  if(!level||won||lost||paused()||jump||drag||returning||falling.length||transitioning||startingGame||entrance||controls.getAttribute('aria-busy')==='true')return;
  if(moves.length===0)setLoss();
}
function setLoss(why){
  if(won||lost)return;
  const hasMoves=getMoves(level,pegs).length>0;
  if(hasMoves)return;
  cancelPositionCheck(true);
  const fallback=isCampaign()?genericLoss(level,pegs):{reason:'stuck',colors:[],balls:[]};
  lost={...fallback,...why,move:lastPlayedMove,shown:false,at:0,explained:true,terminal:!hasMoves};
  if(!attemptFailed){attemptFailed=true;readLatestLives();lives=spendLife(lives);saveLives();renderLives();}
  resultDue=0;cancelDrag();cancelHint();clearEarlyLevelHelp();selected=null;hint=null;idleMove=null;
  controls.setAttribute('aria-busy','false');update();
  prepareLossRecovery();
}
function showPositionRecovery(){
  if(!lost||lost.shown||paused()||won||jump||drag||returning||falling.length||chew>=.45)return;
  lost.shown=true;lost.at=time;lost.reactionStartedAt=performance.now();lost.decisionAt=time+(preferences.motion?.9:2.65);update();game.classList.add('order-lost');
  $('feedback').classList.remove('show');feedbackUntil=0;$('chain-banner').classList.remove('play');$('chain-glow').classList.remove('play');
  const message=isCampaign()?lossMessage(lost):`No jumps remain and there are still ${pegs.length} treats. Finish with one treat to complete the puzzle.`;
  $('instruction').textContent='';$('loss-copy').textContent=message;
  $('loss-detail').textContent='You lost one life. Restart, quit, or undo your last move.';
  $('loss-notice').hidden=true;$('loss-actions').hidden=true;
  $('loss-undo').hidden=!history.length||!undoRemaining;$('loss-undo-count').textContent=String(undoRemaining);lossNoticeUntil=0;
  game.classList.add('loss-animating');game.dataset.lossPhase='reaction';lockLossControls(true);
  lost.animations=animateLostHeart();
  renderLives();tone('heartbreak');buzz([12,40,12,60,30]);
}
function showLossDecision(){
  if(!lost?.shown||lost.decisionShown||time<lost.decisionAt)return;
  lost.decisionShown=true;game.dataset.lossPhase='decision';
  $('loss-notice').hidden=false;$('loss-actions').hidden=false;
  const target=!$('loss-undo').hidden?$('loss-undo'):$('loss-retry');
  target.focus({preventScroll:true});
  speak($('loss-copy').textContent+' You lost one life. Choose restart, quit, or undo.');
}

const names={any:'Any flavor',pink:'Raspberry',mint:'Mint',orange:'Apricot'};
const chapterWashes=[
  ['#d9ead247','#fbdca52e'],['#e8e6ba4f','#f7d6bd38'],['#e4eabb4f','#eacda638'],['#e6e7cf4c','#edcbb63d'],
  ['#d4e7d554','#c5dabe35'],['#dce9cd51','#e7c1a738'],['#d5ecd450','#d2dfaa38'],['#e7e5bd50','#efcda83b'],
  ['#cbe5cb54','#d8e9c338'],['#e5e9bb4e','#f5d2ad3d'],['#b9dcc857','#bfdac74b'],['#c5ddd05a','#c1d8df4d'],
  ['#b8d8d15a','#afd2dd4c'],['#bbdcc45a','#c4d8c44d'],['#a7cdb75e','#b7d1bb4c'],['#c2dec457','#a8c7bb4f'],
  ['#b6d9c85a','#a7d0d94b'],['#bdd4bb59','#b3c9ad4c'],['#accdb358','#b4c6ac4d'],['#bed6c65c','#accbc254'],
];
const isCampaign=()=>level?.kind==='campaign';
const isChallenge=()=>levelIndex===CHALLENGE_INDEX;
const paused=()=>mapOpen||!$('loading').hidden||menu.open||pauseMenu.open||$('reset-progress-dialog').open||$('level-menu').open||$('lives-dialog').open||$('reward-offer').open||$('reward-video').open||mechanicDialog.open||transitioning||startingGame||!!entrance||(!lost&&lives.count===0);
function clearEarlyLevelHelp(){
  if(contextualMessage&&$('instruction').textContent===contextualMessage)$('instruction').textContent='';
  contextualMessage='';$('order-card').classList.remove('order-help');
}
function earlyLevelMessage(reason){
  if(reason==='order')return 'That treat is not on the order. The treat you jump over counts—check the flavor above.';
  if(levelIndex>=3)return reason==='mistakes'
    ?'Check the order: serve a treat of that flavor by jumping over it.'
    :'Miso needs the treats on the café order. Find a jump that serves one of them.';
  return reason==='mistakes'
    ?'Try jumping one treat over another into an empty plate.'
    :'Find two adjacent treats and an empty plate. The middle treat flies down to Miso.';
}
function showEarlyLevelHelp(){
  if(!$('loss-notice').hidden)return;
  if(level?.mechanicIntroduction)return;
  const reason=earlyLevelHelp.tick(time,{blocked:paused()||!!drag||!!jump||!!returning||falling.length>0||hintBusy||won||!!lost||!$('result').hidden});
  if(reason){contextualMessage=earlyLevelMessage(reason);$('instruction').textContent=contextualMessage;$('order-card').classList.add('order-help');}
  if(contextualMessage&&!earlyLevelHelp.visible(time))clearEarlyLevelHelp();
}
function updateIdleMove(){
  if(!isCampaign()||(levelIndex>=4&&!level.mechanicIntroduction)||paused()||won||lost||jump||drag||returning||falling.length||hint||hintBusy||!$('result').hidden||time-earlyLevelHelp.lastAction<4){idleMove=null;idleMoveActionAt=-1;return;}
  if(idleMoveActionAt!==earlyLevelHelp.lastAction){
    idleMoveActionAt=earlyLevelHelp.lastAction;
    idleMove=solveGoal(level,pegs,20000).move;
    idleMoveShownAt=time;
    if(idleMove&&selected&&selected!==idleMove.from){selected=null;update();}
  }
}
function saveProgress(){try{localStorage.setItem(STORAGE.campaign,JSON.stringify(progress));}catch{}}
function saveRewards(){try{localStorage.setItem(REWARDS_KEY,JSON.stringify(rewards));}catch{}}
function saveLives(){try{localStorage.setItem(LIVES_KEY,JSON.stringify(lives));}catch{}}
function readLatestLives(){
  try{const saved=localStorage.getItem(LIVES_KEY);if(saved)lives=normalizeLives(JSON.parse(saved));}catch{}
  lives=normalizeLives(lives);
  saveLives();
}
function renderLives(){
  const updated=normalizeLives(lives);
  if(updated.count!==lives.count||updated.nextAt!==lives.nextAt){lives=updated;saveLives();if(ready&&level)update();}
  const balance=`${lives.count} of ${MAX_LIVES}`;
  $('lives-count').textContent=String(lives.count);
  $('hud-lives-count').textContent=String(lives.count);
  try{const wallet=JSON.parse(savedValue(META_KEY,LEGACY_META_KEY)||'null');$('hud-coins-count').textContent=String(wallet?.balls||0);$('hud-diamonds-count').textContent=String(wallet?.golden||0);}catch{$('hud-coins-count').textContent='0';$('hud-diamonds-count').textContent='0';}
  $('lives-open').setAttribute('aria-label',`Lives: ${balance}. View life recharge`);
  $('menu-lives-count').textContent=balance+' lives';
  if(!lost&&!$('loss-notice').hidden){
    $('loss-actions').hidden=lives.count>0;
    if(lives.count&&lossNoticeUntil===Infinity)lossNoticeUntil=time+5;
  }
  $('lives-title').textContent=lives.count?'Your Lives':'Out of Lives';
  $('lives-balance').textContent=balance+' lives';$('lives-recharge').textContent=lives.count===MAX_LIVES?'All lives are ready.':`Next life in ${lifeCountdown(lives)}`;
  $('lives-watch').hidden=lives.count===MAX_LIVES;
  $('lives-close').hidden=lives.count===0;
}
function showLives(){
  if(adKind||mapOpen||transitioning||lost||$('lives-dialog').open)return;
  if(menu.open)closeMenu();readLatestLives();renderLives();cancelDrag();
  if(!$('lives-dialog').open)$('lives-dialog').showModal();
  (lives.count?$('lives-close'):$('lives-watch')).focus({preventScroll:true});
}
function maybeShowLives(){
  if(!ready||lives.count||mapOpen||lost||!$('loss-notice').hidden||$('lives-dialog').open||!$('loading').hidden||menu.open||$('level-menu').open||mechanicDialog.open||adKind||transitioning||startingGame||entrance)return;
  showLives();
}
function closeLifeDialogs(){
  if($('lives-dialog').open)$('lives-dialog').close();
}
function lockLossControls(locked){
  controls.inert=locked;$('game-hud').inert=locked;$('play-tools').inert=locked;
  if(locked)controls.setAttribute('aria-busy','true');
}
function hideLossNotice(){
  $('loss-notice').hidden=true;$('loss-actions').hidden=true;lossNoticeUntil=0;
}
function animateLostHeart(){
  const heart=$('lost-heart'),count=$('lives-count'),button=$('lives-open');heart.hidden=false;
  $('lost-life-remaining').textContent=lives.count===0?'That was your last life':lives.count===1?'1 life remaining':`${lives.count} lives remaining`;
  const reduced=preferences.motion;
  // A big heart pops up in the middle of the board, shakes, breaks in two and fades
  // before the board rewinds. The life control at the bottom pulses at the same time.
  const animations=[heart.animate(reduced?[{opacity:1},{opacity:1,offset:.7},{opacity:0}]:[
    {opacity:0,transform:'scale(.35)'},
    {opacity:1,transform:'scale(1.14)',offset:.12},
    {opacity:1,transform:'scale(1)',offset:.2},
    {opacity:1,transform:'translateX(-6px) rotate(-3deg)',offset:.25},
    {opacity:1,transform:'translateX(6px) rotate(3deg)',offset:.29},
    {opacity:1,transform:'none',offset:.33},
    {opacity:1,transform:'none',offset:.82},
    {opacity:0,transform:'scale(.94) translateY(10px)'},
  ],{duration:reduced?800:2800,fill:'forwards',easing:'ease-out'})];
  for(const [side,direction] of [['left',-1],['right',1]]){
    animations.push($('lost-heart-'+side).animate(reduced?[
      {transform:'translateX('+(direction*7)+'px)'},{transform:'translateX('+(direction*7)+'px)'},
    ]:[
      {transform:'translate(0,0) rotate(0)'},{transform:'translate(0,0) rotate(0)',offset:.33},
      {transform:'translate('+(direction*16)+'px, 6px) rotate('+(direction*16)+'deg)',offset:.48},
      {transform:'translate('+(direction*24)+'px, 22px) rotate('+(direction*26)+'deg)'},
    ],{duration:reduced?800:2800,fill:'forwards',easing:'ease-out'}));
  }
  animations.push(count.animate(reduced?[
    {color:'#b72f46'},{color:'#b72f46',offset:.75},{color:'#255e57'},
  ]:[
    {transform:'scale(1)',color:'#b72f46'},
    {transform:'scale(1.3)',color:'#b72f46',offset:.13},
    {transform:'scale(1.1)',color:'#b72f46',offset:.28},
    {transform:'scale(1.3)',color:'#b72f46',offset:.45},
    {transform:'scale(1.1)',color:'#b72f46',offset:.65},
    {transform:'scale(1)',color:'#255e57'},
  ],{duration:reduced?800:2500,easing:'ease-in-out'}));
  animations.push(button.animate(reduced?[
    {boxShadow:'0 0 0 3px #fff9ed, 0 0 0 7px #e34261'},
    {boxShadow:'0 0 0 3px #fff9ed, 0 0 0 7px #e34261',offset:.75},
    {boxShadow:'0 0 0 3px #fff9ed00, 0 0 0 7px #e3426100'},
  ]:[
    {transform:'scale(1)',boxShadow:'0 0 0 0 #fff9ed, 0 0 0 0 #e3426100'},
    {transform:'scale(1.42)',boxShadow:'0 0 0 3px #fff9ed, 0 0 0 7px #e34261',offset:.13},
    {transform:'scale(1.12)',boxShadow:'0 0 0 3px #fff9ed00, 0 0 0 11px #e3426100',offset:.29},
    {transform:'scale(1.42)',boxShadow:'0 0 0 3px #fff9ed, 0 0 0 7px #e34261',offset:.45},
    {transform:'scale(1.12)',boxShadow:'0 0 0 3px #fff9ed00, 0 0 0 11px #e3426100',offset:.66},
    {transform:'scale(1)',boxShadow:'0 0 0 0 #fff9ed00, 0 0 0 0 #e3426100',offset:.85},
    {transform:'scale(1)',boxShadow:'0 0 0 0 #fff9ed00, 0 0 0 0 #e3426100'},
  ],{duration:reduced?800:2500,easing:'ease-in-out'}));
  return animations;
}
const lossRecoveryGuard={cancel(){}};
function prepareLossRecovery(){
  if(!lost)return;
  // With terminal no-move losses, the immediately preceding position is the
  // only checkpoint needed: it necessarily had the move that just resolved.
  lost.restoreSteps=history.length?1:0;
  lost.recovering=false;
  renderLives();
}
function tickPositionRecovery(){
  if(!lost?.shown||paused()||lost.recovering||time<lost.nextReverseAt)return;
  if(!lost.restoreSteps){
    pegs=level.pegs.map(peg=>({...peg}));if(preferences.meta)pegs=withGoldenBall(level,pegs);history=[];playedMoves=[];
    finishLossRecovery();return;
  }
  if(!lost.reverse){
    const index=history.length-1,move=playedMoves[index];
    if(!move||!history[index])return;
    lost.reverse={move,before:history[index],after:pegs,start:time,duration:preferences.motion?.16:.55};lost.reverseStarted=true;
    game.dataset.lossPhase='rewinding';update();return;
  }
  if(time-lost.reverse.start<lost.reverse.duration)return;
  const focus=lost.reverse.move.from;
  pegs=lost.reverse.before.map(peg=>({...peg}));history.pop();playedMoves.pop();lost.restoreSteps--;
  lost.reverse=null;update();
  if(!lost.restoreSteps)finishLossRecovery(focus);else lost.nextReverseAt=time+.04;
}
function finishLossRecovery(focus){
  cancelPositionCheck(true);clearLoss({keepNotice:true});cancelHint();cancelDrag();resetWinCelebration();
  lastPlayedMove=playedMoves.at(-1)||null;attemptFailed=false;won=false;
  jump=null;returning=null;falling=[];particles=[];capturePulses=[];confetti=[];landing=null;supportImpact=null;juice.clear();winWaveAt=-1;
  chew=0;lastPop=-2;streak=0;cheerAt=-9;resultDue=0;selected=null;hint=null;idleMove=null;idleMoveActionAt=-1;
  currentDragonFrame=0;dragonLayer.src=dragonSources[0];$('result').hidden=true;$('feedback').classList.remove('show');
  clearEarlyLevelHelp();earlyLevelHelp.moved(time);controls.setAttribute('aria-busy','false');
  keyboardCell=focus||getMoves(level,pegs)[0]?.from||'3,3';update();renderLives();
  game.dataset.lossPhase='recovered';
  $('loss-detail').textContent=lives.count?'You are back at a safe position. Try another jump.':'You are back at a safe position. Recover a life to continue.';
  $('loss-actions').hidden=lives.count>0;lossNoticeUntil=lives.count?time+6:Infinity;
  if(lives.count)focusBoard();else $('loss-retry').focus({preventScroll:true});
  speak('You are back before the dead end.'+(lives.count?' Try another jump.':' You are out of lives. Watch the video to recover one.'));
}
function retryLevel(){
  readLatestLives();renderLives();
  if(!lives.count){if(lost)offerAd('life');else showLives();return;}
  closeLifeDialogs();loadLevel(levelIndex);focusBoard();
}
$('lives-open').onclick=showLives;$('menu-lives').onclick=showLives;
$('lives-close').onclick=()=>{readLatestLives();if(lives.count){$('lives-dialog').close();focusBoard();}};
$('lives-watch').onclick=()=>offerAd('life');
function refundFailedAttemptLife(){
  if(!attemptFailed)return false;
  readLatestLives();lives=grantLife(lives);saveLives();renderLives();attemptFailed=false;
  return true;
}
$('loss-retry').onclick=()=>{if(!lost)return;if(!lives.count){offerAd('life');return;}clearLoss();attemptFailed=false;retryLevel();};
$('loss-undo').onclick=()=>{if(!lost||!history.length||!undoRemaining)return;clearLoss();undoMove();refundFailedAttemptLife();};
$('loss-map').onclick=()=>{if(!lost)return;clearLoss();attemptFailed=false;closeLifeDialogs();showMap();};
$('lives-map').onclick=()=>{closeLifeDialogs();showMap();};
$('lives-dialog').addEventListener('cancel',event=>{event.preventDefault();$('lives-close').click();});
saveLives();renderLives();
window.setInterval(renderLives,1000);
window.addEventListener('storage',event=>{if(event.key===LIVES_KEY){readLatestLives();renderLives();if(ready&&level)update();}});
function offerAd(kind){
  if(adKind||mapOpen||!['hint','life'].includes(kind)||(kind==='hint'&&won))return;
  if(menu.open)closeMenu();
  cancelDrag();adKind=kind;adReturnFocus=document.activeElement;
  $('reward-title').textContent=kind==='life'?'One More Life':'Need a Hint?';
  $('reward-copy').textContent=kind==='life'
    ?'Watch a 3-second demo video to recover a life and keep playing.'
    :'You have used all your hints. Watch a 3-second demo video to get one hint.';
  $('reward-offer').showModal();$('reward-watch').focus();
}
function closeAdOffer(){
  if($('reward-offer').open)$('reward-offer').close();
  adKind=null;adReturnFocus?.focus({preventScroll:true});adReturnFocus=null;
}
function cancelReward(){
  window.clearTimeout(adTimer);adTimer=0;adKind=null;adReturnFocus=null;
  for(const id of ['reward-offer','reward-video'])if($(id).open)$(id).close();
}
$('reward-cancel').onclick=closeAdOffer;
$('reward-offer').addEventListener('cancel',event=>{event.preventDefault();closeAdOffer();});
$('reward-watch').onclick=()=>{
  if(!adKind||adTimer)return;
  $('reward-offer').close();
  const started=performance.now(),kind=adKind,retry=kind==='life'&&(!!lost||lives.count===0);
  $('reward-countdown').textContent='3';$('reward-progress').value=0;
  $('reward-video').showModal();
  const tick=()=>{
    const elapsed=Math.min(3000,performance.now()-started),remaining=Math.max(0,3000-elapsed);
    $('reward-countdown').textContent=String(Math.ceil(remaining/1000));$('reward-progress').value=elapsed/1000;
    if(remaining>0){adTimer=window.setTimeout(tick,80);return;}
    adTimer=0;$('reward-video').close();adKind=null;
    if(kind==='life'){readLatestLives();lives=grantLife(lives);saveLives();renderLives();}
    if(kind==='hint'){rewards=grantVideoReward(rewards,'hint');saveRewards();}
    if(retry){
      if(lost){clearLoss();attemptFailed=false;retryLevel();}
      else retryLevel();
      speak('You recovered one life. The level starts again.');
      adReturnFocus=null;return;
    }
    update();const message=kind==='life'?'You recovered one life.':'You earned one hint.';
    $('instruction').textContent=message;speak(message);
    (kind==='life'?$('lives-close'):adReturnFocus)?.focus({preventScroll:true});adReturnFocus=null;
  };
  tick();
};
$('reward-video').addEventListener('cancel',event=>event.preventDefault());
// The painted shapes are not centered in the four equal atlas quadrants.
// Crop around each shape's visible center so marbles, empty sockets and
// selection rings all share the same board coordinates.
const atlasRects={
  mint:[0,0,625,625],
  pink:[625,0,625,625],
  orange:[0,625,625,625],
  socket:[625,625,625,625]
};
const center=id=>{const [x,y]=id.split(',').map(Number);return{x:board.x+(x+.5)*pitch,y:board.y+(y+.5)*pitch};};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function resize(){
  cancelDrag(); W=game.clientWidth; H=window.visualViewport?.height||window.innerHeight;game.style.height=H+'px';
  const hudTop=parseFloat(getComputedStyle(document.querySelector('.hud')).top)||20;
  const margin=Math.max(9,W*.038),size=W-2*margin;pitch=size/SIZE;
  game.style.setProperty('--board-marble-size',(pitch*.82)+'px');
  const hudHeight=document.querySelector('.hud').getBoundingClientRect().height;
  const boardGap=H<700?12:16;
  board={x:margin,y:hudTop+hudHeight+boardGap,size};
  const boardBackdrop=$('board-backdrop'),backdropPad=Math.max(7,pitch*.13);
  Object.assign(boardBackdrop.style,{left:(board.x-backdropPad)+'px',top:(board.y-backdropPad)+'px',width:(board.size+backdropPad*2)+'px',height:(board.size+backdropPad*2)+'px'});
  const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);juice.resize(W,H,dpr);
  const available=H-(board.y+board.size);const dh=Math.min(W*.82,Math.max(190,available*1.02));const dw=dh;
  dragonBox={x:(W-dw)/2,y:Math.max(board.y+board.size+10,H-dh-42),w:dw,h:dh};
  mouth={x:dragonBox.x+dw*.5,y:dragonBox.y+dh*.57};
  Object.assign(dragonLayer.style,{left:dragonBox.x+'px',top:dragonBox.y+'px',width:dw+'px',height:dh+'px'});
  controls.style.cssText=`left:${board.x}px;top:${board.y}px;width:${board.size}px;height:${board.size}px`;
  placeBoardControls();
  $('instruction').style.top=(board.y+board.size+12)+'px';$('loss-notice').style.top=(board.y+board.size+12)+'px';$('feedback').style.top=Math.min(mouth.y-42,board.y+board.size+55)+'px';$('lost-heart').style.top=(board.y+board.size*.5)+'px';$('chain-banner').style.top=Math.min(mouth.y-90,board.y+board.size+34)+'px';$('meta-reward').style.top=(board.y+board.size*.5+Math.min(110,board.size*.3))+'px';$('win-burst').style.top=(board.y+board.size*.5)+'px';
  $('result').style.top=Math.max(180,Math.min(H-280,board.y+board.size-60))+'px';if(!$('result').hidden)placeResult();falling=[];
}
function placeResult(){const result=$('result');result.style.top=Math.max(45,Math.min(parseFloat(result.style.top)||0,H-result.offsetHeight-12))+'px';}
function cancelHint(){hintRequest++;hintWorker?.terminate();hintWorker=null;clearTimeout(hintTimeout);hintBusy=false;}
function loadLevel(index){
  if(!Number.isInteger(index)||index<0||index>=LEVELS.length)return;
  if(index>=LAST_PLAYABLE_LEVEL&&index<CAMPAIGN.length&&index!==previewIndex)return;
  if(index<CAMPAIGN.length&&index>progress.completed&&index!==previewIndex)return;
  closeLifeDialogs();cancelReward();
  cancelPositionCheck(true);clearLoss();closeMechanicIntro();resetWinCelebration();juice.clear();cheerAt=-9;stampedColors.clear();$('chain-banner').classList.remove('play');$('chain-glow').classList.remove('play');winWaveAt=-1;supportImpact=null;cancelHint();controls.setAttribute('aria-busy','false');cancelDrag();levelIndex=index;level=LEVELS[index];pegs=level.pegs.map(p=>({...p}));if(preferences.meta)pegs=withGoldenBall(level,pegs);history=[];playedMoves=[];undoRemaining=rewards.undos;selected=null;hint=null;idleMove=null;idleMoveActionAt=-1;jump=null;returning=null;falling=[];particles=[];capturePulses=[];confetti=[];landing=null;chew=0;lastPop=-2;currentDragonFrame=0;dragonLayer.src=dragonSources[0];streak=0;cheerBeat=9;biteLiked=true;chain=0;chainDepth=0;chainUntil=-9;shownRun=-1;shownLink=0;chainWordUntil=0;deliveries=[];drawnOrder='';$('chain-banner').className='chain-banner';$('order-card').classList.remove('fx-order-done');resultDue=0;won=false;attemptFailed=false;chapterHintEarned=false;$('result').hidden=true;$('feedback').classList.remove('show');
  if(pegs.some(peg=>peg.type==='stone')&&!stoneArt.src)stoneArt.src='assets/storybook-stone-v1.webp';
  shellArt.preload(pegs);
  const wash=chapterWashes[(level.chapter||Math.ceil((index+1)/10))-1]||['#ffffff00','#ffffff00'];
  game.style.setProperty('--chapter-top',wash[0]);game.style.setProperty('--chapter-bottom',wash[1]);
  const chapter=Math.ceil((index+1)/10),region=isCampaign()?Math.ceil(chapter/10):1;
  chapterSceneryReady=chapterScenery.show(index,isCampaign(),preferences.storybook);
  game.dataset.region=String(region);
  game.dataset.chapter=String(chapter);
  game.dataset.boardShape=level.boardShape||'cross';
  $('level-label').textContent=isChallenge()?'LEVEL 600':isCampaign()?'LEVEL '+(index+1):index===CAMPAIGN.length?'CLASSIC':'PRACTICE';
  $('level-select').value=isChallenge()?'challenge':isCampaign()?'campaign':String(index);
  $('order-card').setAttribute('aria-label',isCampaign()?'Café order':'Classic solitaire');
  clearEarlyLevelHelp();$('instruction').textContent='';
  earlyLevelHelp.start(isCampaign()&&(index<5||!!level.mechanicIntroduction),time);
  keyboardCell=getMoves(level,pegs)[0]?.from||'3,3';
  createBoardControls(level.cells);
  update();refreshLevels();
}
function drawObjectives(){
  const objectives=isCampaign()?goalProgress(level,pegs):[{color:'any',total:level.pegs.length-1,collected:level.pegs.length-pegs.length}];
  // A chip counts a ball when its star lands, so the number, the tick and the burst arrive together.
  if(isCampaign()&&!lost)for(const d of deliveries)if(d.until>time){const g=objectives.find(g=>g.color===d.color);if(g&&g.collected>0)g.collected--;}
  const total=objectives.reduce((n,g)=>n+g.total,0),captured=objectives.reduce((n,g)=>n+g.collected,0);
  $('order-fill').style.width=(100*captured/total)+'%';
  $('order-card').classList.toggle('order-done',isCampaign()&&captured===total);
  // Rebuilding the chips restarts their animations: skip it when nothing visible changed (a tap, a selection).
  const key=(isCampaign()?'':pegs.length)+objectives.map(g=>g.color+g.collected+'/'+g.total+(lost?.shown&&!lost.reverseStarted&&lost.colors.includes(g.color)?'x':'')).join();
  if(key===drawnOrder)return;drawnOrder=key;
  $('objectives').replaceChildren();
  for(const g of objectives){
    const el=document.createElement('div');el.className='goal-item'+(g.color==='any'?' any-goal':'')+(g.collected===g.total?' done':'')+(g.collected===g.total&&stampedColors.has(g.color)?' stamped':'')+(lost?.shown&&!lost.reverseStarted&&lost.colors.includes(g.color)?' blocked':'');el.dataset.color=g.color;el.dataset.count=g.collected;
    el.setAttribute('aria-label',isCampaign()?`${names[g.color]}: ${g.collected} of ${g.total}${lost?.shown&&!lost.reverseStarted&&lost.colors.includes(g.color)?'. Order cannot be completed':''}`:`${pegs.length} treats remaining. Leave one treat.`);
    const icon=g.color==='any'
      ?'<span class="any-marbles" aria-hidden="true"><span class="marble-icon mint"></span><span class="marble-icon orange"></span><span class="marble-icon pink"></span></span>'
      :`<span aria-hidden="true" class="marble-icon ${g.color}"></span>`;
    el.innerHTML=`${icon}<div><div class="goal-number">${isCampaign()?g.collected:pegs.length}<em> / ${isCampaign()?g.total:1}</em></div><div class="goal-name">${isCampaign()?names[g.color]:'Leave one treat'}</div></div>${g.collected===g.total?'<span class="goal-check" aria-hidden="true">✓</span>':''}`;
    $('objectives').append(el);
  }
}
function update({refreshOrder=true}={}){
  moves=getMoves(level,pegs);if(refreshOrder)drawObjectives();controls.setAttribute('aria-disabled',String(!!lost||!lives.count));
  for(const id of ['hint','quick-hint'])$(id).disabled=moves.length===0||won||!!lost||hintBusy||!!jump||!lives.count;
  $('undo-count').textContent=String(undoRemaining);
  $('undo').disabled=!history.length||!undoRemaining||won||!!lost||!!jump||!!returning||falling.length>0||!lives.count;
  $('undo').setAttribute('aria-label',`Undo. ${undoRemaining} uses remaining${history.length?'':'. Nothing to undo'}`);
  $('quick-hint').classList.toggle('is-searching',hintBusy);
  $('hint-count').textContent=hintBusy?'…':String(rewards.hints||'+1');
  $('hint').innerHTML=`<span aria-hidden="true">✦</span>${rewards.hints?'Hint · '+rewards.hints:'+1 hint'}`;
  $('quick-hint').classList.toggle('bonus-ready',rewards.hints===0&&moves.length>0);
  $('quick-hint').setAttribute('aria-label',rewards.hints?`Hint. ${rewards.hints} available`:'Watch demo video to get 1 hint');
  for(const b of controls.children){const p=pegs.find(p=>p.id===b.dataset.cell);const [x,y]=b.dataset.cell.split(',').map(Number);b.setAttribute('aria-label',`Row ${y+1}, column ${x+1}: ${p?(p.type==='stone'?'fixed ceramic saucer':`${({mint:'mint biscuit',pink:'raspberry macaron',orange:'apricot mochi'}[p.color])}${p.type==='shell'&&pegHardness(p)>1?', wrapped: jump twice to serve':''}`):'empty plate'}`);b.setAttribute('aria-pressed',String(selected===b.dataset.cell));b.tabIndex=b.dataset.cell===keyboardCell?0:-1;}
}
function speak(text){$('announcer').textContent=text;}
function focusBoard(){if(mechanicDialog.open)return;controls.querySelector(`[data-cell="${keyboardCell}"]`)?.focus({preventScroll:true});}
function announceHint(){if(!hint)return;const [fx,fy]=hint.from.split(',').map(Number),[tx,ty]=hint.to.split(',').map(Number);keyboardCell=hint.from;update();focusBoard();speak(`Hint: row ${fy+1}, column ${fx+1}, to row ${ty+1}, column ${tx+1}.`);}
function openMenu(){if(transitioning)return;cancelDrag();$('menu-level-progress').textContent=`${Math.min(progress.completed,LAST_PLAYABLE_LEVEL)} of ${LAST_PLAYABLE_LEVEL} levels completed`;menu.showModal();$('menu-close').focus();}
function closeMenu(){if(menu.open)menu.close();$('menu-open').focus();}
function openMetaSettings(){if(transitioning)return;cancelDrag();menu.classList.add('meta-settings-open');$('menu-title').textContent='Settings';menu.querySelector('.eyebrow').textContent='MEOW MUNCHIES';menu.querySelector('.menu-disclosure')?.setAttribute('open','');menu.showModal();$('menu-close').focus();}
function closeMetaSettings(){menu.classList.remove('meta-settings-open');$('menu-title').textContent='Paused';menu.querySelector('.eyebrow').textContent='CAFÉ BREAK';closeMenu();}
function syncPauseControls(){for(const [id,key] of [['pause-music','music'],['pause-sound','sfx'],['pause-haptics','haptics']]){$(id).setAttribute('aria-pressed',String(!!preferences[key]));$(id).classList.toggle('is-off',!preferences[key]);}}
function openPause(){if(transitioning||mapOpen)return;cancelDrag();syncPauseControls();pauseMenu.showModal();$('pause-continue').focus();}
function closePause(){if(pauseMenu.open)pauseMenu.close();$('menu-open').focus();}
function openProgressReset(){
  $('reset-progress-error').hidden=true;
  $('reset-progress-dialog').showModal();$('reset-progress-cancel').focus({preventScroll:true});
}
function closeProgressReset(){
  $('reset-progress-dialog').close();$('reset-progress-open').focus({preventScroll:true});
}
function resetProgress(){
  try{
    localStorage.setItem(STORAGE.campaign,JSON.stringify(normalizeProgress(null)));
    localStorage.setItem(REWARDS_KEY,JSON.stringify(normalizeRewards(null,0)));
    localStorage.setItem(LIVES_KEY,JSON.stringify(normalizeLives(null)));
    localStorage.removeItem(MECHANIC_SEEN_KEY);
  }catch{
    $('reset-progress-error').hidden=false;return;
  }
  // Start a fresh session so the board, map camera and pending rewards reset together.
  metaLayer.reset();
  location.replace('/');
}
$('reset-progress-open').onclick=openProgressReset;
$('reset-progress-cancel').onclick=closeProgressReset;
$('reset-progress-confirm').onclick=resetProgress;
$('reset-progress-dialog').addEventListener('cancel',event=>{event.preventDefault();closeProgressReset();});
function setScreenURL(url,replace=false){
  if(location.pathname+location.search===url)return;
  window.history[replace?'replaceState':'pushState'](null,'',url);
}
function restartGameLoop(){
  cancelAnimationFrame(raf);lastFrame=0;accumulator=0;raf=requestAnimationFrame(frame);
}
function hideMap(){
  resetWinCelebration();mapOpen=false;mapLayer.hidden=true;sendMapState('pause');metaLayer.mapHidden();
  game.inert=false;game.removeAttribute('aria-hidden');
  game.classList.remove('to-map');transitioning=false;
  restartGameLoop();
}
function ensureMap(){
  if(mapFrame)return;
  mapFrame=document.createElement('iframe');mapFrame.title='Level map';mapFrame.allow='autoplay';
  // Keep decoded art and the WebGL world alive. Its loop sleeps during play.
  mapFrame.src=`/map/?embedded=1&prewarm=1&style=${preferences.storybook?'storybook':'original'}`;mapLayer.replaceChildren(mapFrame);
}
function sendMapState(action){
  if(!mapReady)return;
  mapFrame.contentWindow.postMessage({type:'meow-munchies-map-host',action,
    completed:progress.completed,completedLevel:mapCompletedLevel,reducedMotion:preferences.motion,
    hints:rewards.hints,undos:rewards.undos},location.origin);
}
function showMap(completedLevel=null,{route=true,replace=false}={}){
  closeLifeDialogs();cancelReward();
  cancelPositionCheck(true);clearLoss();closeMechanicIntro();
  cancelDrag();cancelHint();if(menu.open)menu.close();if($('level-menu').open)$('level-menu').close();
  resetWinCelebration();mapOpen=true;transitioning=false;game.inert=true;game.setAttribute('aria-hidden','true');
  cancelAnimationFrame(raf);raf=0;
  mapCompletedLevel=completedLevel;ensureMap();
  mapLayer.hidden=false;mapLayer.classList.toggle('reduced-motion',preferences.motion);
  sendMapState('show');
  if(route)setScreenURL(completedLevel?`/map/?completed=${completedLevel}`:'/map/',replace);
  game.classList.remove('to-map');unlockAudio(false);metaLayer.mapShown();
}
async function enterLevel(number,{route=true}={}){
  if(!Number.isInteger(number)||number<1||number>LAST_PLAYABLE_LEVEL||number>progress.completed+1)return;
  hideMap();$('loading').hidden=true;startingGame=false;
  if(route)setScreenURL(`/?play=1&level=${number}`);
  loadLevel(number-1);resize();unlockAudio(false);
  await revealPlayfield();focusBoard();
}
function showHome({route=true}={}){
  closeLifeDialogs();cancelReward();
  cancelPositionCheck(true);clearLoss();closeMechanicIntro();
  hideMap();won=false;startingGame=false;$('result').hidden=true;
  const loading=$('loading');loading.hidden=false;loading.classList.remove('splash-starting');loading.classList.add('splash-ready','splash-playable');
  game.classList.add('splash-pending');
  splashLogo.getAnimations().forEach(animation=>animation.cancel());
  document.querySelector('.splash-action').getAnimations().forEach(animation=>animation.cancel());
  splashLogo.src='assets/meow-munchies/logo.svg';$('splash-play').disabled=false;
  if(route)setScreenURL('/');unlockAudio(false);
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==mapFrame?.contentWindow||event.data?.type!=='meow-munchies-map')return;
  if(event.data.action==='ready'){mapReady=true;sendMapState(mapOpen?'show':'pause');return;}
  if(!mapOpen)return;
  if(event.data.action==='audio')unlockAudio(true);
  else if(event.data.action==='play')enterLevel(event.data.level);
  else if(event.data.action==='home')showHome();
});
window.addEventListener('popstate',()=>{
  if(location.pathname==='/map/'||new URLSearchParams(location.search).get('map')==='1')showMap(null,{route:false});
  else{const number=Number(new URLSearchParams(location.search).get('level'));if(number>0)enterLevel(number,{route:false});else showHome({route:false});}
});
function openLevels(){if(transitioning)return;showMap();}
function closeLevels(){if($('level-menu').open)$('level-menu').close();$('levels-open').focus();}
function refreshLevels(){
  $('campaign-progress').textContent=`${Math.min(progress.completed,LAST_PLAYABLE_LEVEL)} of ${LAST_PLAYABLE_LEVEL} orders completed`;
  $('level-grid').replaceChildren();
  for(const chapter of CHAPTERS){
    const section=document.createElement('section');section.className='chapter-block';section.dataset.region=String(chapter.region);
    if(chapter.id===1||CHAPTERS[chapter.id-2]?.region!==chapter.region){
      const region=document.createElement('div');region.className='region-heading';
      region.textContent=chapter.region===1?'Whisker Lane':'Blackberry Forest';section.append(region);
    }
    const heading=document.createElement('div');heading.className='chapter-heading';
    const title=document.createElement('h3');title.textContent=CHAPTER_NAMES[chapter.id-1];
    const caption=document.createElement('span');caption.textContent=`CHAPTER ${chapter.id} · ${chapter.levels[0]}–${chapter.levels[1]}`;
    heading.append(caption,title);section.append(heading);
    const grid=document.createElement('div');grid.className='chapter-levels';
    for(let i=chapter.levels[0]-1;i<chapter.levels[1];i++){
      const b=document.createElement('button'),completed=i<progress.completed,locked=(i>progress.completed||i>=LAST_PLAYABLE_LEVEL)&&i!==previewIndex;b.dataset.level=String(i);
      b.className=(completed?'completed ':'')+(i===levelIndex?'current':'');b.disabled=locked;
      b.setAttribute('aria-label',`Level ${i+1}, ${displayLevelName(i)}${completed?', completed':locked?', locked':''}`);
      b.innerHTML=`${i+1}${completed?'<span aria-hidden="true">✓</span>':locked?'<span aria-hidden="true">·</span>':''}`;
      if(i===levelIndex)b.setAttribute('aria-current','step');
      b.onclick=()=>{loadLevel(i);closeLevels();};grid.append(b);
    }
    section.append(grid);$('level-grid').append(section);
  }
  $('campaign-continue').textContent=progress.completed>=LAST_PLAYABLE_LEVEL?'Replay Level 100':'Continue · Level '+(progress.completed+1);
}
function savePreferences(){try{localStorage.setItem(STORAGE.settings,JSON.stringify(preferences));}catch{}}
const musicSelect=$('music-track');
for(const item of SOUNDTRACKS)musicSelect.add(new Option(item.title,item.id));
musicSelect.value=preferences.musicTrack;
musicSelect.onchange=()=>{
  preferences.musicTrack=soundtrackId(musicSelect.value);savePreferences();
  if(preferences.music){unlockAudio(true);soundtrack?.select(preferences.musicTrack,true);}
  else soundtrack?.select(preferences.musicTrack);
};
$('music-preview').onclick=()=>{
  if(!preferences.music){preferences.music=true;preferences.sound=true;$('sound').checked=true;savePreferences();}
  unlockAudio(true);soundtrack?.select(preferences.musicTrack,true);soundtrack?.preview();
};
for(const name of ['sound','haptics','motion']){$(name).checked=preferences[name];$(name).onchange=()=>{preferences[name]=$(name).checked;if(name==='sound'){preferences.music=preferences.sound;preferences.sfx=preferences.sound;}game.classList.toggle('reduced-motion',preferences.motion);savePreferences();if(name==='sound'){if(preferences.sound)unlockAudio();else stopAudio();}};}
function applyStorybookStyle(){
  game.classList.toggle('storybook-style',preferences.storybook);
  dragonSources=preferences.storybook?dragonStyles.storybook:dragonStyles.modern;
  dragonLayer.src=dragonSources[currentDragonFrame]||dragonSources[0];
  if(level)chapterSceneryReady=chapterScenery.show(levelIndex,isCampaign(),preferences.storybook);
  if(mapFrame){mapReady=false;mapFrame.src=`/map/?embedded=1&prewarm=1&style=${preferences.storybook?'storybook':'original'}`;}
}
// The map meta layer owns the bottom navigation and its connected economy screens.
metaLayer=createMetaLayer({reduced:()=>preferences.motion,sound:(kind,step)=>tone(kind,step),buzz,speak,
  pauseMap:()=>sendMapState('pause'),resumeMap:()=>{mapCompletedLevel=null;sendMapState('show');},
  openSettings:openMetaSettings,
  grantLife:()=>{readLatestLives();while(lives.count<MAX_LIVES)lives=grantLife(lives);saveLives();renderLives();if(level)update();},
  livesFull:()=>{readLatestLives();return lives.count>=MAX_LIVES;},
  getLives:()=>{readLatestLives();return lives.count;},
  onWalletChange:wallet=>{$('hud-coins-count').textContent=String(wallet.balls);$('hud-diamonds-count').textContent=String(wallet.golden);},
  grantHint:(amount=1)=>{for(let i=0;i<amount;i++)rewards=grantVideoReward(rewards,'hint');saveRewards();if(level)update();},
  grantUndo:(amount=1)=>{rewards=grantUndo(rewards,amount);undoRemaining=rewards.undos;saveRewards();if(level)update();}});
let metaReward=null;
function payMetaReward(){
  const edible=list=>list.filter(peg=>peg.type!=='stone').length;
  metaReward=metaLayer.levelWon({levelId:level.id,eaten:edible(level.pegs)-edible(pegs),goldenEaten:goldenWasEaten(pegs,history)});
}
function showMetaReward(){
  const reward=metaReward;metaReward=null;if(!reward)return;
  const el=$('meta-reward');
  el.innerHTML=`<span><i aria-hidden="true"></i>+${reward.balls} coins</span>`+(reward.golden?'<span class="golden"><i aria-hidden="true"></i>+1 Diamond</span>':'');
  el.hidden=false;
}
function goldenCaptured(id){
  const p=center(id);
  juice.glow(p.x,p.y,'gold',{radius:pitch*1.8,life:.45});juice.ring(p.x,p.y,'gold',{from:pitch*.3,to:pitch*1.4,life:.45,width:8});
  juice.burst(p.x,p.y,'gold',{count:22,speed:300,size:[5,10],life:[.6,1]});juice.kick(3,.25);
  $('instruction').textContent='Diamond! Use it in Pachinkat to earn café rewards.';speak('Diamond!');
}
function drawGoldenBall(x,y,r,alpha=1,sx=1,sy=1,target=ctx){
  target.save();target.globalAlpha=alpha;target.translate(x,y);target.scale(sx,sy);
  if(catDiamondArt.complete&&catDiamondArt.naturalWidth){target.drawImage(catDiamondArt,-r*1.12,-r*1.12,r*2.24,r*2.24);target.restore();return;}
  // Asset failures still render a cat-shaped jewel, never the retired gold ball.
  const jewel=target.createLinearGradient(-r,-r,r,r);jewel.addColorStop(0,'#fff6ff');jewel.addColorStop(.35,'#bcefe8');jewel.addColorStop(.72,'#8fcbe9');jewel.addColorStop(1,'#e7a8d1');
  target.fillStyle=jewel;target.strokeStyle='#7d665f';target.lineWidth=Math.max(1.5,r*.07);target.lineJoin='round';
  target.beginPath();target.moveTo(-r*.78,-r*.25);target.lineTo(-r*.62,-r*.88);target.lineTo(-r*.12,-r*.62);target.lineTo(r*.12,-r*.62);target.lineTo(r*.62,-r*.88);target.lineTo(r*.78,-r*.25);target.lineTo(r*.62,r*.5);target.lineTo(0,r*.9);target.lineTo(-r*.62,r*.5);target.closePath();target.fill();target.stroke();
  target.fillStyle='#76504a';for(const ex of [-.28,.28]){target.beginPath();target.arc(ex*r,-.08*r,r*.08,0,Math.PI*2);target.fill();}
  target.fillStyle='#df7894';target.beginPath();target.moveTo(0,r*.08);target.lineTo(-r*.09,r*.18);target.lineTo(r*.09,r*.18);target.closePath();target.fill();
  target.restore();
}
function applyMetaMode(){
  $('meta-test-tools').hidden=!preferences.meta;metaLayer.setEnabled(preferences.meta);
  const note=$('meta-mode-note');
  note.textContent='Adds Diamonds, Pachinkat, the Shop, and the Album around the map.';
  if(!preferences.meta){metaReward=null;$('meta-reward').hidden=true;return;}
  if(level&&!history.length&&!jump&&!won)pegs=withGoldenBall(level,pegs);
  else if(level&&!pegs.some(peg=>peg.golden)&&!history.some(snapshot=>snapshot.some(peg=>peg.golden)))
    note.textContent='Enabled. A Diamond will appear when you restart this level or enter another compatible level.';
}
$('meta-mode').checked=preferences.meta;
$('meta-mode').onchange=()=>{preferences.meta=$('meta-mode').checked;savePreferences();applyMetaMode();};
$('meta-fill-lives').onclick=()=>{readLatestLives();while(lives.count<MAX_LIVES)lives=grantLife(lives);saveLives();renderLives();if(level)update();speak('Lives filled.');};
applyMetaMode();
$('storybook-style').checked=preferences.storybook;
$('storybook-style').onchange=async()=>{
  const next=$('storybook-style').checked;
  try{
    await Promise.all([prepareMarbles(next),...dragonStyles[next?'storybook':'modern'].map(src=>artLoader.load(dragonVariants.get(src)))]);
    if($('storybook-style').checked!==next)return;
    preferences.storybook=next;applyStorybookStyle();warmPlayArt();savePreferences();
  }catch{ $('storybook-style').checked=preferences.storybook; }
};
applyStorybookStyle();
$('menu-open').onclick=openPause;$('menu-close').onclick=closeMetaSettings;$('resume').onclick=closeMetaSettings;
$('pause-continue').onclick=closePause;
$('pause-music').onclick=()=>{preferences.music=!preferences.music;savePreferences();syncPauseControls();if(preferences.music){unlockAudio();syncMusic();}else soundtrack?.pause();};
$('pause-sound').onclick=()=>{preferences.sfx=!preferences.sfx;savePreferences();syncPauseControls();if(preferences.sfx)unlockAudio();else{sfx?.stop();biteSound?.stop();}};
$('pause-haptics').onclick=()=>{preferences.haptics=!preferences.haptics;savePreferences();syncPauseControls();if(preferences.haptics)buzz(8);};
$('pause-howto').onclick=()=>{const copy=$('pause-howto-copy'),show=copy.hidden;copy.hidden=!show;$('pause-howto').setAttribute('aria-expanded',String(show));};
$('levels-open').onclick=showLives;$('levels-close').onclick=closeLevels;$('menu-levels').onclick=openLevels;
if(['localhost','127.0.0.1'].includes(location.hostname)){
  $('challenge-open').hidden=false;
  $('challenge-open').onclick=()=>{loadLevel(CHALLENGE_INDEX);closeMenu();};
}
$('campaign-continue').onclick=()=>{loadLevel(Math.min(progress.completed,LAST_PLAYABLE_LEVEL-1));closeLevels();};
for(const dialog of [menu,$('level-menu')])dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
pauseMenu.addEventListener('cancel',event=>{event.preventDefault();closePause();});
let lifeActionReturn='menu';
function requestLifeAction(action,returnTo='menu'){
  closeMenu();closePause();pendingLifeAction=action;lifeActionReturn=returnTo;
  $('life-warning-confirm').textContent=action==='restart'?'Restart':'Return to Map';
  $('life-warning').showModal();$('life-warning-cancel').focus({preventScroll:true});
}
function confirmLifeAction(){
  $('life-warning').close();
  if(!attemptFailed&&history.length){readLatestLives();lives=spendLife(lives);attemptFailed=true;saveLives();renderLives();}
  const action=pendingLifeAction;pendingLifeAction=null;
  if(action==='restart')retryLevel();else showMap();
}
$('restart').onclick=()=>requestLifeAction('restart');
$('quit').onclick=()=>requestLifeAction('quit');
$('pause-quit').onclick=()=>requestLifeAction('quit','pause');
$('life-warning-confirm').onclick=confirmLifeAction;
$('life-warning-cancel').onclick=()=>{$('life-warning').close();pendingLifeAction=null;lifeActionReturn==='pause'?openPause():openMenu();};
$('life-warning').addEventListener('cancel',event=>{event.preventDefault();$('life-warning-cancel').click();});
function undoMove(){
  if(!history.length||!undoRemaining||won||lost||jump||returning||falling.length)return;
  cancelPositionCheck(true);cancelHint();cancelDrag();
  pegs=history.pop().map(peg=>({...peg}));playedMoves.pop();lastPlayedMove=playedMoves.at(-1)||null;
  rewards=spendUndo(rewards);undoRemaining=rewards.undos;saveRewards();selected=null;hint=null;deliveries=[];drawnOrder='';chain=0;chainDepth=history.length;resultDue=0;
  update();checkCurrentPosition();tone('pick');buzz(5);speak(`Move undone. ${undoRemaining} undo uses remaining.`);
}
$('undo').onclick=undoMove;
function requestHint(){
  if(won||lost||hintBusy||jump||!lives.count)return;
  if(rewards.hints===0){offerAd('hint');return;}
  earlyLevelHelp.requestedHint(time);clearEarlyLevelHelp();unlockAudio();cancelDrag();if(menu.open)closeMenu();
  if(!isCampaign()){hint=getHint(level,pegs);if(hint){rewards=spendHint(rewards);saveRewards();}selected=hint?.from||null;update();announceHint();return;}
  cancelHint();const request=hintRequest;hintBusy=true;update();
  const finish=result=>{
    if(request!==hintRequest)return;
    cancelHint();
    if(result.status==='found'){rewards=spendHint(rewards);saveRewards();hint=result.move;selected=hint.from;$('instruction').textContent='Jump the highlighted treat over another treat into an empty plate.';announceHint();}
    else if(result.status==='dead'){$('instruction').textContent=moves.length?'No hint was found. Try another jump.':'No moves remain.';checkCurrentPosition();}
    else {$('instruction').textContent='No hint was found. Try another jump or restart the level.';speak('Try another jump or restart the level.');}
    update();
  };
  try{
    hintWorker=new Worker(new URL('./hint-worker.js',import.meta.url),{type:'module'});
    hintWorker.onmessage=({data})=>{if(data.request===request)finish(data);};hintWorker.onerror=()=>finish({status:'error'});
    hintTimeout=setTimeout(()=>finish({status:'budget'}),5000);
    hintWorker.postMessage({request,index:levelIndex,pegs,purpose:'check',challenge:isChallenge()});
  }catch{finish({status:'error'});}
}
$('hint').onclick=requestHint;$('quick-hint').onclick=requestHint;
$('level-select').add(new Option('Café Orders','campaign'));
for(const [i,l] of CLASSIC_LEVELS.entries())$('level-select').add(new Option(l.name,i+CAMPAIGN.length));
$('level-select').add(new Option('Level 600 · prototype','challenge'));
$('level-select').onchange=()=>{const value=$('level-select').value;loadLevel(value==='campaign'?Math.min(progress.completed,LAST_PLAYABLE_LEVEL-1):value==='challenge'?CHALLENGE_INDEX:Number(value));closeLevels();};
$('result-secondary').onclick=retryLevel;
function resetWinCelebration(){
  autoContinueAt=0;window.clearTimeout(mapTransitionTimer);mapTransitionTimer=0;
  $('win-burst').hidden=true;$('win-burst').classList.remove('play');$('meta-reward').hidden=true;
  victoryPhase=VICTORY.PLAYING;victoryStartedAt=0;victoryClears.clear();victoryReward={balls:0,golden:0};victoryCelebrated=false;victoryRewardSound=false;
  const sequence=$('victory-sequence');sequence.hidden=true;delete sequence.dataset.phase;
  $('victory-coins-count').textContent='0';$('victory-diamonds-count').textContent='0';
  game.classList.remove('victory-active','victory-trigger');
}
function continueToMap(){
  if(transitioning||mapOpen||!won||!isCampaign())return;
  autoContinueAt=0;transitioning=true;victoryPhase=VICTORY.TRANSITIONING;$('victory-sequence').dataset.phase='transitioning';ensureMap();game.classList.add('to-map');
  const completedLevel=levelIndex+1;
  mapTransitionTimer=window.setTimeout(()=>{mapTransitionTimer=0;showMap(completedLevel);},preferences.motion?0:160);
}
$('victory-continue').onclick=()=>{if(victoryPhase===VICTORY.WAITING)continueToMap();};
$('result-primary').onclick=()=>{if(transitioning)return;if(won&&isCampaign()){continueToMap();return;}loadLevel(levelIndex);if($('result').hidden&&!paused())focusBoard();};
function unlockAudio(gesture=true){
  if(!preferences.music&&!preferences.sfx)return;
  try{
    if(!audio){audio=new (window.AudioContext||window.webkitAudioContext)();soundtrack=createSoundtrack(audio,preferences.musicTrack);biteSound=createBiteSound(audio);sfx=createSfx(audio);audio.onstatechange=syncMusic;}
    if(ready&&!document.hidden)soundtrack.resume(gesture);
    if(audio.state!=='running')audio.resume().then(syncMusic,()=>{});
    else syncMusic();
  }catch{}
}
function stopAudio(){soundtrack?.stop();biteSound?.stop();sfx?.stop();}
function syncMusic(){if(!preferences.music||!ready||document.hidden)soundtrack?.pause();else if(audio?.state==='running')soundtrack?.resume();}
document.addEventListener('click',()=>unlockAudio(true),true);
document.addEventListener('keydown',()=>unlockAudio(true),true);
// Every move and reward cue lives in sound-fx.js. step: semitones (colour, chip ladder,
// meta counters); delay: seconds, so one event can schedule a later cue.
function tone(kind='pick',step=0,delay=0){
  if(!preferences.sfx||!sfx||audio.state!=='running')return;
  if(SFX_DUCKS.has(kind))soundtrack?.duck();
  sfx.play(kind,step,delay);
}
function buzz(ms){if(preferences.haptics&&!playNativeHaptic(ms)&&navigator.vibrate)navigator.vibrate(ms);}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Independent of game time: gameplay stays paused until the last marble settles.
async function revealPlayfield(){
  warmPlayArt();
  const reduced=preferences.motion||matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A deliberate centre-out ripple reads more cleanly than a random scatter,
  // and the tighter stagger gets the player to the board sooner.
  const order=pegs.map(p=>p.id).sort((a,b)=>{
    const [ax,ay]=a.split(',').map(Number),[bx,by]=b.split(',').map(Number);
    return Math.hypot(ax-3,ay-3)-Math.hypot(bx-3,by-3)||(ay-by)||(ax-bx);
  });
  entrance={start:performance.now(),reduced,delays:new Map(order.map((id,i)=>[id,390+i/Math.max(1,order.length-1)*145]))};
  const elements=[controls,document.querySelector('.hud'),document.querySelector('.play-tools')];
  elements.forEach(el=>el.inert=true);
  game.classList.remove('splash-pending');
  const animations=[];
  const enter=(el,from,delay,duration)=>animations.push(el.animate(
    [{opacity:0,translate:reduced?'0 0':from},{opacity:1,translate:'0 0'}],
    {delay:reduced?0:delay,duration:reduced?160:duration,easing:'cubic-bezier(.2,.8,.25,1)',fill:'both'}));
  enter(dragonLayer,'0 70px',80,330);
  enter($('foreground-rocks'),'0 55px',150,300);
  enter(document.querySelector('.hud'),'0 -32px',215,280);
  enter(document.querySelector('.play-tools'),'0 15px',285,230);
  try{await delay(reduced?180:820);}finally{
    entrance=null;animations.forEach(a=>a.cancel());elements.forEach(el=>el.inert=false);
  }
}
async function startGame(){
  if(startingGame)return;
  artLoader.load(bittenLogo).catch(()=>{});
  startingGame=true;$('splash-play').disabled=true;$('loading').classList.add('splash-starting');unlockAudio();
  const reduced=preferences.motion||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const action=document.querySelector('.splash-action');
  action.animate([{opacity:1},{opacity:0}],{duration:120,fill:'forwards'});
  if(!reduced){
    splashLogo.animate([
      {transform:'scale(1) rotate(0deg)'},
      {transform:'scale(1.035,.94) rotate(-2deg)',offset:.35},
      {transform:'scale(.97,1.035) rotate(1.2deg)',offset:.6},
      {transform:'scale(1) rotate(0deg)'}
    ],{duration:340,easing:'ease-out'});
    await delay(120);
  }
  if(bittenLogo.complete&&bittenLogo.naturalWidth)splashLogo.src=bittenLogo.src;
  if(preferences.sfx){soundtrack?.duck();biteSound?.play('logo');}buzz(12);
  await delay(reduced?70:150);
  await splashLogo.animate([{opacity:1},{opacity:0}],{duration:reduced?80:120,fill:'forwards'}).finished;
  $('loading').hidden=true;startingGame=false;showMap();
}

async function advanceToNextLevel(index){
  if(transitioning||!CAMPAIGN[index])return;
  if(preferences.motion||matchMedia('(prefers-reduced-motion: reduce)').matches){loadLevel(index);focusBoard();return;}
  transitioning=true;
  const overlay=$('level-transition'),goals=$('transition-goals');
  $('transition-level').textContent=`LEVEL ${index+1}`;
  goals.replaceChildren();
  const colors=CAMPAIGN[index].goal.any?['mint','orange','pink']:Object.keys(CAMPAIGN[index].goal.colors);
  for(const color of colors){const marble=document.createElement('span');marble.className=`marble-icon ${color}`;goals.append(marble);}
  overlay.hidden=false;
  overlay.classList.remove('is-visible','is-leaving');
  void overlay.offsetWidth;
  overlay.classList.add('is-visible');
  tone('jump');buzz(8);
  try{
    await delay(330);
    loadLevel(index);
    game.classList.remove('level-reveal');
    void game.offsetWidth;
    game.classList.add('level-reveal');
    await delay(170);
    overlay.classList.add('is-leaving');
    overlay.classList.remove('is-visible');
    await delay(450);
  }finally{
    overlay.hidden=true;
    overlay.classList.remove('is-visible','is-leaving');
    game.classList.remove('level-reveal');
    transitioning=false;
    focusBoard();
  }
}
function localPoint(e){const r=game.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function cellAt(p){const x=Math.floor((p.x-board.x)/pitch),y=Math.floor((p.y-board.y)/pitch);const id=`${x},${y}`;return boardCellIds.has(id)?id:null;}
function candidate(p,from,allowSwipe=false){
  const legal=moves.filter(m=>m.from===from);let best=legal.find(m=>distance(center(m.to),p)<pitch*.66);
  if(!best&&allowSwipe){const a=center(from),dx=p.x-a.x,dy=p.y-a.y;const horizontal=Math.abs(dx)>Math.abs(dy);if(Math.hypot(dx,dy)>pitch*.65&&Math.min(Math.abs(dx),Math.abs(dy))<Math.max(Math.abs(dx),Math.abs(dy))*.48){best=legal.find(m=>{const c=center(m.to);return horizontal?Math.abs(c.y-a.y)<1&&Math.sign(c.x-a.x)===Math.sign(dx):Math.abs(c.x-a.x)<1&&Math.sign(c.y-a.y)===Math.sign(dy);});}}
  return best||null;
}
function pick(id){if(!isMovable(pegs.find(p=>p.id===id))){speak('The ceramic saucer cannot move. Jump a treat over it.');tone('stoneTap');return;}if(moves.some(m=>m.from===id))earlyLevelHelp.interacted(time);else earlyLevelHelp.failedAttempt(time);clearEarlyLevelHelp();selected=id;hint=null;update();tone('pick',COLOR_STEP[pegs.find(p=>p.id===id)?.color]||0);buzz(5);const c=center(id);juice.ring(c.x,c.y,pegs.find(p=>p.id===id)?.color,{from:pitch*.3,to:pitch*.62,life:.28,width:4});}
function pointerDown(e){
  if(!ready||paused()||won||lost||!$('result').hidden||jump||drag||e.button>0)return;e.preventDefault();unlockAudio();const point=localPoint(e),id=cellAt(point);if(!id)return;
  const landing=selected&&moves.find(m=>m.from===selected&&m.to===id);if(landing){perform(landing);return;}
  const peg=pegs.find(p=>p.id===id);if(!peg){earlyLevelHelp.failedAttempt(time);clearEarlyLevelHelp();selected=null;update();return;}
  if(!isMovable(peg)){pick(id);return;}
  pick(id);drag={id,pointer:e.pointerId,start:point,point,moved:false,peg,target:null,liftStart:time};controls.setPointerCapture(e.pointerId);
}
function pointerMove(e){if(!drag||drag.pointer!==e.pointerId)return;e.preventDefault();drag.point=localPoint(e);if(!drag.moved&&distance(drag.start,drag.point)>6){drag.moved=true;drag.liftStart=time;}const previous=drag.target?.to;drag.target=candidate(drag.point,drag.id,true);if(drag.target&&drag.target.to!==drag.ticked){drag.ticked=drag.target.to;buzz(3);tone('hover');}}
function pointerUp(e){
  if(!drag||drag.pointer!==e.pointerId)return;e.preventDefault();const d=drag;const p=localPoint(e);d.point=p;const released=dragPosition(d);drag=null;if(controls.hasPointerCapture(e.pointerId))controls.releasePointerCapture(e.pointerId);
  if(d.moved){const target=candidate(p,d.id,true);if(target)perform(target,released);else{earlyLevelHelp.failedAttempt(time);returning={id:d.id,from:released,start:time};tone('invalid');}}
}
function cancelDrag(){if(!drag)return;const pointer=drag.pointer;drag=null;try{if(controls.hasPointerCapture(pointer))controls.releasePointerCapture(pointer);}catch{}}
controls.addEventListener('pointerdown',pointerDown);controls.addEventListener('pointermove',pointerMove);controls.addEventListener('pointerup',pointerUp);controls.addEventListener('pointercancel',cancelDrag);controls.addEventListener('lostpointercapture',cancelDrag);
controls.addEventListener('contextmenu',e=>e.preventDefault());
let controlCells=null,boardCellIds=new Set();
function placeBoardControls(){
  for(const button of controls.children){const [x,y]=button.dataset.cell.split(',').map(Number);button.style.cssText=`left:${x*pitch}px;top:${y*pitch}px;width:${pitch}px;height:${pitch}px`;}
}
function createBoardControls(cells){
  controls.setAttribute('aria-label',`Board: ${BOARD_SHAPES[level.boardShape||'cross'].name}`);
  if(controlCells===cells)return;
  controlCells=cells;boardCellIds=new Set(cells.map(cell=>cell.id));controls.replaceChildren();
  for(const {x,y} of cells){
  const b=document.createElement('button');b.className='cell';b.dataset.cell=`${x},${y}`;b.type='button';controls.append(b);
  b.addEventListener('click',e=>{if(e.detail!==0||jump||paused()||won||lost||!$('result').hidden||!ready)return;unlockAudio();const id=b.dataset.cell;const m=moves.find(m=>m.from===selected&&m.to===id);if(m)perform(m);else if(pegs.some(p=>p.id===id))pick(id);else{earlyLevelHelp.failedAttempt(time);clearEarlyLevelHelp();}});
  b.addEventListener('keydown',e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(delta){e.preventDefault();earlyLevelHelp.interacted(time);const [cx,cy]=b.dataset.cell.split(',').map(Number);const next=`${cx+delta[0]},${cy+delta[1]}`;const target=controls.querySelector(`[data-cell="${next}"]`);if(target){keyboardCell=next;update();target.focus();}}if(e.key==='Escape'){earlyLevelHelp.interacted(time);selected=null;update();}});
  }
  placeBoardControls();
}
function perform(move,releasePosition=null){
  if(won||lost||paused()||!$('result').hidden||jump||!moves.some(m=>m.from===move.from&&m.to===move.to))return;
  cancelPositionCheck();clearLoss();cancelHint();controls.setAttribute('aria-busy','true');const mover=pegs.find(p=>p.id===move.from),captured=pegs.find(p=>p.id===move.over);
  const effect=jumpEffect(captured);
  const useful=effect==='capture'&&isCampaign()&&goalProgress(level,pegs).some(g=>(g.color==='any'||g.color===captured.color)&&g.collected<g.total);
  const unhelpful=effect==='capture'&&isCampaign()&&levelIndex>=3&&!level.goal.any&&!useful;
  // A chain is a run of captures that feed the order (any capture in the classic solitaire), each
  // jump starting within CHAIN_WINDOW of the previous landing. A wasted capture, a pause or a rewind
  // after a lost life (history shorter than at the last jump) ends it; a shell crack or a stone hop
  // keeps it without adding a link. Presentation only: rules, order and saves never read it.
  const feeds=effect==='capture'&&(useful||!isCampaign());
  if(time>chainUntil||history.length!==chainDepth||(effect==='capture'&&!feeds)){chain=0;chainRun++;}
  if(feeds)chain++;
  earlyLevelHelp.moved(time,{unhelpful});clearEarlyLevelHelp();history.push(pegs.map(p=>({...p})));lastPlayedMove=move;playedMoves.push({...move});selected=move.to;hint=null;returning=null;
  tone('takeoff');buzz(4);
  const from=releasePosition||center(move.from);
  juice.burst(from.x,from.y+pitch*.3,'shell',{count:6,speed:70,kind:'dust',size:[4,7],life:[.35,.5],gravity:-40,up:0});
  // A tap crouches before it springs; the ball freezes for a hit-stop as it crosses the one it captures.
  jump={move,mover,captured,effect,useful,releasePosition,start:time,...jumpTiming({dragged:!!releasePosition,reduced:preferences.motion,effect}),
    crossAt:crossingPoint(from,center(move.over),center(move.to)),hitAt:-1,released:false,chain:feeds?chain:0,run:chainRun};
  chainDepth=history.length;chainUntil=time+jump.duration+jump.hitStop+CHAIN_WINDOW;
  resultDue=0;update();$('instruction').textContent='';
}
// Commit the capture when the jumping ball crosses it, independently of its
// later fall and the dragon's bite. The order and its pulse update together.
function captureJump(j){
  if(j.released)return;
  pegs=applyMove(pegs,j.move,level);j.released=true;
  won=isCampaign()?goalComplete(level,pegs):pegs.length===1;
  if(won&&isCampaign()&&!isChallenge()){
    const previousHints=rewards.hints;
    progress=completeLevel(progress,levelIndex);saveProgress();
    rewards=normalizeRewards(rewards,progress.completed);
    chapterHintEarned=rewards.hints>previousHints;
    if(chapterHintEarned)saveRewards();
    if(preferences.meta)payMetaReward();
  }
  if(j.useful&&!preferences.motion)deliveries.push(j.delivery={color:level.goal.any?'any':j.captured.color,until:time+.9});
  update();
  if(j.effect!=='capture'){
    supportImpact={id:j.move.over,start:time,effect:j.effect};tone(j.effect==='crack'?'shellCrack':'stoneBump');buzz(j.effect==='crack'?[6,25,6]:5);
    if(j.effect==='crack'){
      const p=center(j.move.over);sparkles(p.x,p.y,j.captured.color,6,65,'shell');
      juice.burst(p.x,p.y,j.captured.color,{count:9,speed:190,kind:'candy',size:[3,5],life:[.4,.65]});juice.ring(p.x,p.y,'shell',{from:pitch*.25,to:pitch*.8,life:.32,width:5});juice.kick(3,.22);
      speak('Wrapper opened. The treat stays on its plate. Jump over it again to serve it.');
    }else{const p=center(j.move.over);juice.burst(p.x,p.y+pitch*.2,'shell',{count:7,speed:80,kind:'dust',size:[4,7],life:[.35,.55],gravity:-30,up:0});juice.kick(1.5,.16);speak('The ceramic saucer stays in place. You can jump over it again.');}
    return;
  }
  {const p=center(j.move.over),color=j.captured.color;
    juice.glow(p.x,p.y,color,{radius:pitch*1.3,life:.3});juice.ring(p.x,p.y,color,{from:pitch*.3,to:pitch*1.05,life:.36,width:6});
    juice.burst(p.x,p.y,color,{count:12,speed:230,size:[4,8]});juice.burst(p.x,p.y,color,{count:8,speed:330,kind:'spark',size:[3,5],life:[.25,.4],gravity:200});
    juice.kick(2,.18);if(j.captured.type==='shell')tone('shellBreak');
    // A star flies to the order chip. The chip ticks up when it lands: a rising note while the colour
    // fills, a stamp and a chime when it is complete, and a gold sweep across the card for the last one.
    if(j.delivery){
      const d=j.delivery,selector=`[data-color="${d.color}"]`,total=goalProgress(level,pegs).find(g=>g.color===d.color)?.total||1;
      juice.fly(p.x,p.y,color,$('objectives').querySelector(selector),()=>{
        deliveries=deliveries.filter(x=>x!==d);drawObjectives();
        const chip=$('objectives').querySelector(selector);if(!chip)return;
        chip.classList.remove('fx-hit');void chip.offsetWidth;chip.classList.add('fx-hit');
        if(!chip.classList.contains('done')){tone('collect',collectStep(Number(chip.dataset.count),total));return;}
        const last=won&&!deliveries.some(x=>x.until>time);
        celebrateColor(color,chip);if(last)celebrateOrderCard();
        tone(last?'collect':'colorDone',last?12:0);
      });
    }
  }
  speak(isCampaign()?goalProgress(level,pegs).map(g=>`${g.collected} of ${g.total} ${names[g.color]}`).join('. '):pegs.length+' treats.');
  if(preferences.meta&&j.captured.golden)goldenCaptured(j.move.over);
  releaseBall(j.captured,j.move.over,j.useful,j.chain,j.run);
}
const sparkleColors={shell:'#fff0d2',mint:'#77b9a5',pink:'#ee8f86',orange:'#f3b960'};
function sparkles(x,y,color,count,speed,kind='sparkle'){
  if(preferences.motion)return;
  for(let i=0;i<count;i++){const angle=Math.PI*2*(i+.15)/count,force=speed*(.65+Math.random()*.5);particles.push({x,y,vx:Math.cos(angle)*force,vy:Math.sin(angle)*force-speed*.28,life:.38+Math.random()*.2,age:0,color,size:2+Math.random()*2.5,rotation:angle,kind});}
}
function dragPosition(d){const origin=center(d.id),lift=preferences.motion?0:Math.min(1,(time-d.liftStart)/.12);return{x:origin.x+d.point.x-d.start.x,y:origin.y+d.point.y-d.start.y-pitch*.28*lift};}
function shadow(x,y,r,alpha=.16){ctx.save();ctx.fillStyle=`rgba(93,48,25,${alpha})`;ctx.beginPath();ctx.ellipse(x,y,r,r*.34,0,0,Math.PI*2);ctx.fill();ctx.restore();}
function releaseBall(peg,id,useful,link=0,run=0){
  const p=center(id),dy=Math.max(20,mouth.y-p.y),g=1450,pop=160,t=(pop+Math.sqrt(pop*pop+2*g*dy))/g,calm=preferences.motion;
  const goal=useful&&isCampaign()?goalProgress(level,pegs).find(g=>g.color===peg.color||g.color==='any'):null;
  // It pops in place through the hit-stop (hold), swelling with a white flash, then leaves for the mouth.
  falling.push({x:p.x,y:p.y,vx:(mouth.x-p.x)/t,vy:-pop,g,color:peg.color,golden:!!peg.golden,r:pitch*.36,age:0,useful,trail:[],chain:link,run,
    completesOrder:useful&&won,finale:useful&&won,pop:calm?0:1,hold:calm?0:POP_HOLD,peg});
  if(!calm){capturePulses.push({x:p.x,y:p.y,color:peg.color,age:0,life:.3});sparkles(p.x,p.y,peg.color,5,56);}
  // Pink, mint and orange pop on C, E and G; food the order does not need only plops.
  tone(useful||!isCampaign()?'pop':'plop',COLOR_STEP[peg.color]||0);buzz(6);
  // Reduced motion has no flying star: the chip changes now, so its note follows the pop.
  if(goal&&calm){
    const colorDone=goal.collected>=goal.total,chip=colorDone&&$('objectives').querySelector(`[data-color="${goal.color}"]`);
    if(chip)celebrateColor(peg.color,chip);
    tone(colorDone&&!won?'colorDone':'collect',colorDone&&!won?0:collectStep(goal.collected,goal.total),.18);
  }
  // The order's last ball: a riser builds through its hang and peaks as the dragon bites.
  if(useful&&won&&!calm)tone('finaleRise',0,Math.max(0,POP_HOLD+t+FINALE_HANG_EXTRA-.9));
  if(falling.length>24)falling.shift();
}
function eat(ball){chew=1;lastPop=time;biteLiked=ball.useful||!isCampaign();
  // A chain link shows its number once and in order: a link overtaken in the air stays quiet.
  if(ball.run!==shownRun){shownRun=ball.run;shownLink=0;}
  const link=ball.chain>=2&&ball.chain>shownLink?ball.chain:0;if(link)shownLink=link;
  // streak is this bite's chain tier (1-5): it scales the bite art, the bursts, the crunch pitch and the dragon's hop.
  streak=link?Math.min(link,5):1;
  // The dragon munches audibly only when no other food is in the air (it keeps its mouth open for it).
  if(preferences.sfx){soundtrack?.duck();biteSound?.play(ball.completesOrder?'feast':'dragon',streak,falling.length<=1);}buzz([9,23,7]);
  let variant;
  if(streak===1){variant=Math.floor(Math.random()*(lastBiteVariant<0?3:2));if(lastBiteVariant>=0&&variant>=lastBiteVariant)variant++;lastBiteVariant=variant;}
  else variant=streak+1;
  $('feedback-art').src=biteArt[variant].src;
  $('feedback').classList.remove('show');void $('feedback').offsetWidth;$('feedback').classList.add('show');feedbackUntil=time+.75;
  sparkles(mouth.x,mouth.y,ball.color,7,105);
  $('feedback').classList.remove('combo');void $('feedback').offsetWidth;$('feedback').classList.toggle('combo',streak>=2&&!preferences.motion);
  juice.glow(mouth.x,mouth.y,ball.color,{radius:pitch*(1.6+streak*.35),life:.4});
  juice.ring(mouth.x,mouth.y,ball.color,{from:pitch*.3,to:pitch*(1.3+streak*.25),life:.42,width:7});
  juice.burst(mouth.x,mouth.y,ball.color,{count:12+streak*4,speed:260+streak*30,size:[4,9],life:[.5,.85]});
  juice.burst(mouth.x,mouth.y,ball.color,{count:6+streak*2,speed:240,kind:'candy',size:[3,6],life:[.5,.8]});
  juice.burst(mouth.x,mouth.y,'gold',{count:6+streak*3,speed:380,kind:'spark',size:[3,5],life:[.25,.45],gravity:150});
  juice.kick(2.5+streak*1.3,.24+streak*.03);
  celebrateBite(ball,link);
}
// The bite that completes the order: the spotlight opens from the mouth, gold bursts out and a
// wave runs up the board while the dragon starts its party (tickCheer). The corner cannons and
// the screen flash come .26 s later with the win word (winEffects), so they are not doubled here.
function celebrateOrder(ball){
  cheerAt=time;cheerBeat=0;winWaveAt=time;
  juice.irisOut(mouth.x,mouth.y);juice.kick(4,.35);
  juice.glow(mouth.x,mouth.y,'gold',{radius:pitch*4,life:.7});
  juice.ring(mouth.x,mouth.y,'gold',{from:pitch*.4,to:pitch*4,life:.7,width:12});juice.ring(mouth.x,mouth.y,ball.color,{from:pitch*.3,to:pitch*2.6,life:.55,width:8});
  juice.burst(mouth.x,mouth.y,'gold',{count:30,speed:520,size:[6,12],life:[.8,1.3],gravity:520});
  buzz([14,40,20,40,30]);
}
// Hearts float up beside the dragon's head, never across its painted face.
// Anchors are fractions of the dragon box; both art styles share the silhouette.
function dragonHearts(count){
  const {x,y,w,h}=dragonBox,left=Math.ceil(count/2);
  juice.burst(x+w*.12,y+h*.17,'pink',{count:left,speed:140,kind:'heart',size:[6,11],life:[.8,1.2],gravity:-90,spread:.9,angle:-Math.PI*.72,up:0});
  juice.burst(x+w*.9,y+h*.15,'pink',{count:count-left,speed:140,kind:'heart',size:[6,11],life:[.8,1.2],gravity:-90,spread:.9,angle:-Math.PI*.28,up:0});
}
// The order party's beats (PARTY_BEATS in dragon-animation.js): confetti, stars and hearts
// burst from the mouth as the dragon leaps, then dust and a thump as it lands.
function tickCheer(){
  if(cheerBeat>=PARTY_BEATS.length||time-cheerAt<PARTY_BEATS[cheerBeat])return;
  if(cheerBeat++===0){
    for(const color of ['mint','pink','orange'])juice.burst(mouth.x,mouth.y,color,{count:6,speed:600,kind:'confetti',size:[4,7],life:[1,1.5],gravity:760,spread:1.3,up:0});
    juice.burst(mouth.x,mouth.y,'gold',{count:6,speed:480,kind:'star',size:[5,9],life:[.8,1.1],gravity:640,spread:1,up:0});
    dragonHearts(6);return;
  }
  if(preferences.motion)return;
  const feet=Math.min(H-24,dragonBox.y+dragonBox.h*.93);
  juice.burst(dragonBox.x+dragonBox.w*.3,feet,'shell',{count:6,speed:120,kind:'dust',size:[6,10],life:[.4,.6],gravity:-40,spread:Math.PI*.5,angle:Math.PI,up:0});
  juice.burst(dragonBox.x+dragonBox.w*.72,feet,'shell',{count:6,speed:120,kind:'dust',size:[6,10],life:[.4,.6],gravity:-40,spread:Math.PI*.5,angle:0,up:0});
  juice.kick(5,.3);buzz(14);
}
// A finished colour bursts out of its order chip, which glows and gets a check stamp.
// Called when the colour's last star lands on the chip (captureJump), or at capture with reduced motion.
function celebrateColor(color,chip){
  stampedColors.add(level.goal.any?'any':color);
  chip.classList.remove('fx-complete');void chip.offsetWidth;chip.classList.add('fx-complete','stamped');buzz([6,18,10]);
  const r=chip.getBoundingClientRect(),g=game.getBoundingClientRect(),x=r.left-g.left+r.width*.3,y=r.top-g.top+r.height*.5;
  juice.ring(x,y,color,{from:8,to:70,life:.5,width:7});juice.ring(x,y,'gold',{from:4,to:46,life:.4,width:4});
  juice.burst(x,y,color,{count:18,speed:260,size:[4,8],life:[.6,1]});juice.burst(x,y,'gold',{count:10,speed:340,kind:'spark',size:[3,5],life:[.3,.5],gravity:200});
  juice.burst(x,y,color,{count:12,speed:200,kind:'confetti',size:[4,7],life:[.8,1.2],gravity:420});
}
// Every chip is done: a gold sweep crosses the order card, which keeps a gold rim (drawObjectives).
function celebrateOrderCard(){const card=$('order-card');card.classList.remove('fx-order-done');void card.offsetWidth;card.classList.add('fx-order-done');}
// The finished order and each chain link get their own sound and burst. A finished colour
// celebrates at its chip when its star lands (captureJump), or at capture with reduced motion.
function celebrateBite(ball,link){
  if(ball.completesOrder){tone('orderDone');celebrateOrder(ball);return;}
  if(link>=2&&!lost){dragonHearts(1+streak);celebrateChain(link,ball.color);}
}
const CHAIN_WORDS=['','','Double!','Triple!','Quadruple!','Unstoppable!'];
// Each link grows the word, the screen-edge glow, the stinger and the confetti. Nothing blocks input.
function celebrateChain(link,color){
  const tier=Math.min(link,5);
  tone(chainKind(tier));buzz(tier>=4?[8,22,8,22,12]:[8,22,10]);
  const banner=$('chain-banner');banner.textContent=CHAIN_WORDS[tier];
  banner.className='chain-banner show level-'+tier;void banner.offsetWidth;banner.classList.add('play');chainWordUntil=time+.7;
  const glow=$('chain-glow');glow.style.setProperty('--chain',String((tier-1)/4));glow.classList.remove('play');void glow.offsetWidth;glow.classList.add('play');
  if(tier>=3)juice.burst(mouth.x,mouth.y-pitch*.3,color,{count:tier*5,speed:440+tier*30,kind:'confetti',size:[4,7],life:[.8,1.2],gravity:620,angle:-Math.PI/2,spread:1.1,up:.15});
  if(tier>=4)juice.ring(mouth.x,mouth.y-dragonBox.h*.12,'gold',{from:pitch*.6,to:pitch*(1.6+tier*.3),life:.5,width:6});
  if(link===5)juice.flashScreen('#ffe7a6',.16,.32);
}
function step(dt){
  if(paused())return;chew=Math.max(0,chew-dt*2.1);tickCheer();
  // The chain word leaves on game time (with reduced motion it is a plain .show state, no animation).
  if(chainWordUntil&&time>chainWordUntil){$('chain-banner').classList.remove('show');chainWordUntil=0;}
  const hadFalling=falling.length>0;
  for(const b of falling){const fd=b.finale&&!preferences.motion?dt*finaleClock(b.age):dt;if(b.pop)b.pop=Math.max(0,b.pop-fd*POP_RATE);if(b.hold>0){b.hold-=dt;continue;}b.age+=fd;if(b.y>board.y+board.size&&b.y<mouth.y){const remaining=Math.max(.09,(mouth.y-b.y)/Math.max(80,b.vy));const aim=(mouth.x-b.x)/remaining;b.vx+=(aim-b.vx)*Math.min(1,fd*5);}b.vy+=b.g*fd;b.x+=b.vx*fd;b.y+=b.vy*fd;if(b.x<b.r){b.x=b.r;b.vx=Math.abs(b.vx)*.7;}if(b.x>W-b.r){b.x=W-b.r;b.vx=-Math.abs(b.vx)*.7;}if(!preferences.motion){b.trail.unshift({x:b.x,y:b.y});if(b.trail.length>13)b.trail.pop();if(Math.random()<dt*45)juice.burst(b.x+(Math.random()-.5)*b.r,b.y,b.finale&&Math.random()<.5?'gold':b.color,{count:1,speed:25,kind:'glow',size:[2.5,4.5],life:[.25,.4],gravity:-20,up:0});}}
  for(let i=0;i<falling.length;i++)for(let j=i+1;j<falling.length;j++){const a=falling[i],b=falling[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=(a.r+b.r)*.82;if(d>0&&d<min&&!(a.hold>0)&&!(b.hold>0)){const nx=dx/d,ny=dy/d,over=(min-d)*.5;a.x-=nx*over;a.y-=ny*over;b.x+=nx*over;b.y+=ny*over;const velocity=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(velocity<0){a.vx+=velocity*nx*.72;a.vy+=velocity*ny*.72;b.vx-=velocity*nx*.72;b.vy-=velocity*ny*.72;}}}
  falling=falling.filter(b=>{if(b.y>=mouth.y-b.r*.25&&b.vy>0&&Math.abs(b.x-mouth.x)<dragonBox.w*.13){eat(b);return false;}return b.age<4&&b.y<H+b.r;});
  // The landing update runs while the captured treat is still flying, so Undo is
  // temporarily disabled. Refresh once the last treat reaches Miso; otherwise the
  // button keeps that stale disabled state until some unrelated interaction.
  if(hadFalling&&!falling.length)update({refreshOrder:false});
  for(const c of confetti){c.age+=dt;c.vy+=160*dt;c.x+=c.vx*dt;c.y+=c.vy*dt;c.angle+=c.spin*dt;}confetti=confetti.filter(c=>c.age<c.life);
  for(const p of particles){p.age+=dt;p.vy+=450*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}particles=particles.filter(p=>p.age<p.life);
  for(const pulse of capturePulses)pulse.age+=dt;capturePulses=capturePulses.filter(pulse=>pulse.age<pulse.life);
}
function roundedRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function sprite(color,x,y,r,alpha=1,sx=1,sy=1,target=ctx){
  const art=preferences.storybook?(storybookMarbles[color]||storybookMarbles.mint):modernMarbleAtlas;
  if(!art.complete||!art.naturalWidth)return;
  target.save();target.globalAlpha=alpha;target.translate(x,y);target.scale(sx,sy);
  if(preferences.storybook&&color!=='socket')target.drawImage(art,...(STORYBOOK_MARBLE_FRAMES[color]||STORYBOOK_MARBLE_FRAMES.mint).source,-r,-r,r*2,r*2);
  else if(preferences.storybook)target.drawImage(art,-r,-r,r*2,r*2);
  else target.drawImage(art,...(atlasRects[color]||atlasRects.mint),-r,-r,r*2,r*2);
  target.restore();
}
function drawPeg(peg,x,y,r,alpha=1,sx=1,sy=1,target=ctx){
  const age=supportImpact&&supportImpact.id===peg.id?time-supportImpact.start:1;
  const shake=preferences.motion||age>.28?0:Math.sin(age*65)*(1-age/.28)*r*.07;
  x+=shake;
  if(peg.type==='stone'){
    target.save();target.globalAlpha=alpha;target.translate(x,y);target.scale(sx,sy);
    if(stoneArt.complete&&stoneArt.naturalWidth){const w=stoneArt.naturalWidth;target.drawImage(stoneArt,w*.078,w*.082,w*.828,w*.828,-r,-r,r*2,r*2);}
    else{target.fillStyle='#b5ada0';target.beginPath();target.ellipse(0,0,r*.92,r*.86,-.2,0,Math.PI*2);target.fill();}
    target.restore();return;
  }
  if(peg.type==='shell'&&pegHardness(peg)>1){
    if(shellArt.draw(peg,x,y,r,alpha,sx,sy,target))return;
    // A simple colored casing while its painted sprite loads.
    const colors={mint:['#8ec6ac','#477f72'],pink:['#ed9581','#b75e54'],orange:['#f2bc69','#ba8244']};
    const [light,dark]=colors[peg.color]||colors.orange;
    target.save();target.globalAlpha=alpha;target.translate(x,y);target.scale(sx,sy);
    const fill=target.createRadialGradient(-r*.3,-r*.35,r*.08,0,0,r);
    fill.addColorStop(0,light);fill.addColorStop(1,dark);target.fillStyle=fill;
    target.beginPath();target.arc(0,0,r,0,Math.PI*2);target.fill();
    target.strokeStyle=dark;target.lineWidth=Math.max(1,r*.065);target.lineCap='round';
    for(const offset of [-.55,0,.55]){
      target.beginPath();target.moveTo(r*offset,-r*.78);
      target.bezierCurveTo(r*(offset-.35),-r*.28,r*(offset+.32),r*.3,r*offset,r*.78);target.stroke();
    }
    target.restore();return;
  }
  // Durability 1 retains only logical history: no shell artwork or crack overlay.
  if(preferences.meta&&peg.golden){drawGoldenBall(x,y,r,alpha,sx,sy,target);return;}
  sprite(peg.color,x,y,r,alpha,sx,sy,target);
}
function closeMechanicIntro(){
  activeMechanic=null;
  if(mechanicDialog.open)mechanicDialog.close();
}
function maybeShowMechanicIntro(){
  if(!ready||paused()||won||lost||!isCampaign()||!$('result').hidden)return;
  const next=unseenMechanics(pegs,seenMechanics)[0];if(!next)return;
  cancelDrag();clearEarlyLevelHelp();idleMove=null;
  activeMechanic=next;mechanicDemoStart=performance.now();
  if(next==='shell')shellArt.preloadColor('orange');
  const help=MECHANIC_HELP[next];
  $('mechanic-title').textContent=help.title;
  $('mechanic-copy').textContent=help.copy;
  $('mechanic-tip').textContent=help.tip;
  $('mechanic-step').textContent=help.labels[0];
  mechanicDialog.showModal();$('mechanic-ready').focus({preventScroll:true});
}
function acknowledgeMechanic(){
  if(!activeMechanic)return;
  seenMechanics.add(activeMechanic);
  try{localStorage.setItem(MECHANIC_SEEN_KEY,JSON.stringify({version:1,seen:[...seenMechanics]}));}catch{}
  closeMechanicIntro();earlyLevelHelp.interacted(time);maybeShowMechanicIntro();
  if(!mechanicDialog.open)focusBoard();
}
$('mechanic-ready').onclick=acknowledgeMechanic;
mechanicDialog.addEventListener('cancel',event=>{event.preventDefault();acknowledgeMechanic();});
function renderMechanicDemo(stamp){
  if(!mechanicDialog.open||!activeMechanic)return;
  const c=$('mechanic-demo').getContext('2d'),w=300,h=145;
  c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,w,h);
  const reduced=preferences.motion||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t=((stamp-mechanicDemoStart)/1000)%4.6;
  const shell=activeMechanic==='shell',r=23,y=72;
  for(const x of [48,150,252]){c.strokeStyle='#b9ae98';c.lineWidth=1.5;c.beginPath();c.arc(x,y,r+3,0,Math.PI*2);c.stroke();}
  const phase=t<.95?0:t<1.7?1:t<2.7?2:3;
  const first=clamp01((t-.25)/.85),second=clamp01((t-1.8)/.85);
  const progress=phase<2?first:second;
  const x=phase<2?48+204*first:252-204*second;
  drawPeg({color:'mint'},reduced?48:x,reduced?y:y-Math.sin(progress*Math.PI)*42,r,1,1,1,c);
  if(!shell||reduced||t<2.23){
    drawPeg(shell?{color:'orange',type:'shell',durability:reduced||t<.68?2:1}:{type:'stone'},150,y,r,1,1,1,c);
  }else if(t<2.7){
    const drop=clamp01((t-2.23)/.47);drawPeg({color:'orange'},150,y+drop*62,r,1-drop,1,1,c);
  }
  const label=reduced?(shell?'1 jump: open the wrapper · 2 jumps: serve the treat':'Always stays on the board'):MECHANIC_HELP[activeMechanic].labels[phase];
  if($('mechanic-step').textContent!==label)$('mechanic-step').textContent=label;
}
function renderMechanicTutorial(){
  if(!level.mechanicIntroduction||lost||paused()||!$('result').hidden||hint||hintBusy)return;
  // The explanation lives in the pop-up; only offer a contextual nudge after inactivity.
  let text='';
  if(!won&&time-earlyLevelHelp.lastAction>=4){
    if(level.mechanicIntroduction==='shell'){
      const shell=pegs.find(peg=>peg.type==='shell');
      text=shell&&pegHardness(shell)===1?'Wrapper opened! Jump over the treat again to serve it.':'Jump over the wrapped treat.';
    }else text='The ceramic saucer stays. Use it as a support to complete the order.';
  }
  if($('instruction').textContent!==text)$('instruction').textContent=text;
}
function drawSparkle(p){
  const fade=1-p.age/p.life,size=p.size*(.6+fade*.4);
  ctx.save();ctx.globalAlpha=fade*.9;ctx.translate(p.x,p.y);ctx.rotate(p.rotation+p.age*(p.kind==='shell'?7:2));
  ctx.lineWidth=1.5;ctx.lineCap='round';
  if(p.kind==='shell'){
    ctx.fillStyle=sparkleColors[p.color];ctx.strokeStyle={mint:'#477f72',pink:'#b75e54',orange:'#ba8244'}[p.color];
    ctx.beginPath();ctx.moveTo(-size,-size*.6);ctx.lineTo(size*.35,-size);ctx.lineTo(size,size*.25);ctx.lineTo(-size*.25,size*.8);ctx.closePath();ctx.fill();ctx.stroke();
  }else{
    ctx.strokeStyle=sparkleColors[p.color]||'#ffe2a5';ctx.beginPath();ctx.moveTo(-size,0);ctx.lineTo(size,0);ctx.moveTo(0,-size);ctx.lineTo(0,size);ctx.stroke();
  }
  ctx.restore();
}
function drawLoss(){
  const age=time-lost.at,fade=Math.min(1,age/.25);
  if(lost.explained&&lost.move){
    const a=center(lost.move.from),b=center(lost.move.to);
    ctx.save();ctx.globalAlpha=.85*fade;ctx.strokeStyle='#e0605a';ctx.lineWidth=3;ctx.lineCap='round';ctx.setLineDash([6,7]);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo((a.x+b.x)/2,(a.y+b.y)/2-pitch*.9,b.x,b.y);ctx.stroke();ctx.restore();
  }
}
function drawCapturePulse(p){const t=p.age/p.life;ctx.save();ctx.globalAlpha=(1-t)*.65;ctx.strokeStyle=sparkleColors[p.color]||'#ffe2a5';ctx.lineWidth=Math.max(1.5,pitch*.04)*(1-t*.45);ctx.beginPath();ctx.arc(p.x,p.y,pitch*(.22+.37*t),0,Math.PI*2);ctx.stroke();ctx.restore();}
function drawSelectionRing(id){
  const p=center(id);ctx.save();ctx.strokeStyle='#fffde2';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(p.x,p.y,pitch*.46,0,Math.PI*2);ctx.stroke();ctx.restore();
}
function ballEmphasis(age){
  if(preferences.motion)return{scale:1.035,white:.15};
  const fade=clamp01(age/.25),pulse=(1-Math.cos(age*Math.PI*2/1.3))*.5;
  return{scale:1+.12*pulse*fade,white:.44*Math.pow(pulse,3)*fade};
}
function drawPegGlint(peg,x,y,r,alpha,sx,sy,white){
  if(white<.005)return;
  emphasisCtx.clearRect(0,0,256,256);
  drawPeg(peg,128,128,112,1,1,1,emphasisCtx);
  emphasisCtx.globalCompositeOperation='source-in';
  emphasisCtx.fillStyle='#fffaf0';emphasisCtx.fillRect(0,0,256,256);
  emphasisCtx.globalCompositeOperation='source-over';
  ctx.save();ctx.globalAlpha=alpha*white;ctx.translate(x,y);ctx.scale(sx,sy);
  const extent=r*128/112;ctx.drawImage(emphasisMask,-extent,-extent,extent*2,extent*2);ctx.restore();
}
// A short playable lesson scoped to level one, with normal input available.
function renderFirstLevelTutorial(){
  if(!isCampaign()||levelIndex!==0||lost||!$('loss-notice').hidden||paused()||!$('result').hidden)return;
  const move=level.solution[0];
  const text=won?'That’s it! The treat you jump over flies down to Miso and fills the order.':
    selected===move.from?'Pass over the other treat and release in the empty plate.':
    selected?'Try the highlighted treat. You can also tap it, then tap the empty plate.':
    'Jump one treat over another into the empty plate.';
  if(!earlyLevelHelp.visible(time)&&$('instruction').textContent!==text)$('instruction').textContent=text;
  if(won||jump||drag?.moved||!idleMove)return;
  const a=center(move.from),b=center(move.to),phase=((time-idleMoveShownAt)%2.6)/2.6;
  const travel=preferences.motion?0:Math.max(0,Math.min(1,(phase-.2)/.55));
  const eased=travel*travel*(3-2*travel);
  ctx.save();ctx.globalAlpha=preferences.motion?1:phase>.85?(1-phase)/.15:1;
  ctx.font=`${Math.round(pitch*.58)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillText('👆',a.x+(b.x-a.x)*eased,a.y+(b.y-a.y)*eased+pitch*.12);
  ctx.restore();
}
// One falling ball: a faint trail, a stretch with speed and, as it leaves the board, the pop:
// it swells from board size with a white flash, then shrinks to flight size. The order's last
// ball also swells a little and stays in a spotlight while it hangs at the top of its hop.
function drawFalling(b){
  const calm=preferences.motion;
  if(!calm){ctx.save();ctx.fillStyle=sparkleColors[b.color]||'#ffe2a5';for(let i=3;i<b.trail.length;i+=3){const q=b.trail[i];ctx.globalAlpha=.2*(1-i/14);ctx.beginPath();ctx.arc(q.x,q.y,Math.max(1.5,b.r*(.15-i*.005)),0,Math.PI*2);ctx.fill();}ctx.restore();}
  const stretch=calm?0:Math.min(.16,Math.max(0,b.vy)/4500),near=Math.max(0,1-distance(b,mouth)/(pitch*.65)),popped=1-(b.pop||0);
  let size=(1-near*.55)*(b.pop?popScale(popped):1);
  const alpha=b.y<board.y+board.size?1-.25*Math.min(1,popped*1.4):1;
  if(b.finale&&!calm){const hang=finaleHang(b.age);size*=1+.18*hang;juice.spotlight(b.x,b.y,pitch*(1.4+.4*hang));}
  if(preferences.meta&&b.golden)drawGoldenBall(b.x,b.y,b.r*size,1,1-stretch,1+stretch);else sprite(b.color,b.x,b.y,b.r*size,alpha,1-stretch,1+stretch);
  if(b.pop&&b.peg)drawPegGlint(b.peg,b.x,b.y,b.r*size,1,1-stretch,1+stretch,popFlash(popped));
}
function render(){
  tickVictorySequence();
  if(lossNoticeUntil&&time>=lossNoticeUntil)hideLossNotice();
  ctx.clearRect(0,0,W,H);
  const lossReaction=!!lost?.shown;
  const pose=lossReaction?lossDragonPose({elapsed:(performance.now()-lost.reactionStartedAt)/1000,rewinding:!!lost?.reverse,reduced:preferences.motion})
    :dragonPose({elapsed:time-lastPop,approaching:falling.length>0,reduced:preferences.motion,streak,cheer:time-cheerAt,liked:biteLiked});
  const visualFrame=lossReaction?pose.frame:pose.frame===3?0:pose.frame;
  if(visualFrame!==currentDragonFrame){
    const pose=dragonVariants.get(dragonSources[visualFrame]);
    if(pose?.complete&&pose.naturalWidth){currentDragonFrame=visualFrame;dragonLayer.src=dragonSources[visualFrame];}
  }
  const breath=preferences.motion?0:Math.sin(time*2.2)*.006;
  const waiting=!preferences.motion&&falling.length>0?.025:0;
  // The chomp head-shake lives in dragonPose; x is the side-to-side shimmy of a long chain.
  dragonLayer.style.transform=`translate(${pose.x||0}px,${-pose.lift-waiting*40}px) rotate(${pose.rotation||0}deg) scale(${pose.sx+breath+waiting},${pose.sy-breath-waiting*.5})`;
  // Falling food passes behind the board; a ball that is still popping is drawn above it, later.
  for(const b of falling)if(!b.pop)drawFalling(b);
  if(game.classList.contains('splash-pending'))return;
  const entryAge=entrance?performance.now()-entrance.start:Infinity;
  const boardAlpha=entrance?clamp01(entryAge/(entrance.reduced?160:240)):1;
  // A victory-cleared treat vacates its visual cell as soon as its exit starts,
  // so the permanent plate underneath is revealed and remains on the board.
  const occupied=new Set(pegs.filter(peg=>{const clear=victoryClears.get(peg.id);if(!clear)return true;const startsAt=preferences.motion?.06:clear.at;return time-victoryStartedAt<startsAt;}).map(peg=>peg.id));
  const reverse=lost?.reverse,reverseProgress=reverse?clamp01((time-reverse.start)/reverse.duration):0;
  const reverseArt=reverse?rewindFrame(reverse,reverseProgress,{center,mouth,pitch,reduced:preferences.motion}):null;
  if(reverse)occupied.delete(reverse.move.to);
  if(jump){occupied.delete(jump.move.from);occupied.delete(jump.move.to);if(!jump.released)occupied.add(jump.move.over);}
  if(drag?.moved)occupied.delete(drag.id);
  for(const {id} of level.cells){if(occupied.has(id)&&!entrance)continue;const p=center(id);sprite('socket',p.x,p.y,pitch*.46,.82*boardAlpha);}
  if(selected&&!entrance&&selected!==hint?.from&&selected!==idleMove?.from)drawSelectionRing(selected);
  for(const peg of pegs){
    if(reverseArt?.hidden.has(peg.id))continue;
    if(jump&&(peg.id===jump.move.from||peg.id===jump.move.to||(peg.id===jump.move.over&&!jump.released)))continue;
    if(drag?.id===peg.id&&drag.moved||returning?.id===peg.id)continue;
    const clear=victoryClears.get(peg.id),clearAge=clear?(time-victoryStartedAt-(preferences.motion ? .06 : clear.at)):-1;
    if(clear&&clearAge>=(preferences.motion?0:.28))continue;
    const p=center(peg.id),dim=lost?.shown&&!lost.reverseStarted&&lost.balls.includes(peg.id);
    const quake=dim&&!preferences.motion?Math.sin((time-lost.at)*42)*pitch*.07*Math.max(0,1-(time-lost.at)/.6):0;
    const assisted=idleMove?.from===peg.id;
    const indicated=!entrance&&(dim||assisted||hint?.from===peg.id);
    const emphasis=indicated?ballEmphasis(dim?time-lost.at:assisted?time-idleMoveShownAt:time-earlyLevelHelp.lastAction):{scale:1,white:0};
    const squash=landing?.id===peg.id&&!preferences.motion?Math.cos((time-landing.start)*32)*Math.exp(-(time-landing.start)*12)*.22:0;
    const t=entrance?clamp01((entryAge-(entrance.reduced?0:entrance.delays.get(peg.id)))/(entrance.reduced?160:235)):1;
    const entryEase=entrance&&!entrance.reduced?1-Math.pow(1-t,3):t;
    const pop=entrance&&!entrance.reduced ? .72+entryEase*.28+Math.sin(t*Math.PI)*.12 : 1;
    const waveT=winWaveAt<0||preferences.motion?1:clamp01((time-winWaveAt-distance(p,mouth)/pitch*.05)/.42),hop=Math.sin(waveT*Math.PI)*pitch*.22;
    // squash*pitch*.34 keeps a landing ball's bottom planted in its socket while it flattens.
    const x=p.x+quake,y=p.y-hop+squash*pitch*.34+(entrance&&!entrance.reduced?(1-entryEase)*pitch*.16:0);
    const selectionScale=selected===peg.id&&!entrance&&!indicated&&!preferences.motion?1.045+Math.sin(time*4)*.012:1;
    const clearProgress=clear&&clearAge>=0?clamp01(clearAge/(preferences.motion ? .001 : .28)):0;
    const clearScale=clearProgress<.35?1+Math.sin(clearProgress/.35*Math.PI)*.16:1-Math.pow((clearProgress-.35)/.65,.7);
    const entryAlpha=entrance&&!entrance.reduced?clamp01(t*1.7):t;
    const sx=(emphasis.scale*selectionScale+squash)*pop*clearScale,sy=(emphasis.scale*selectionScale-squash)*pop*clearScale,alpha=(dim?entryAlpha*.65:entryAlpha)*(1-clearProgress);
    if(t<=0)continue;
    if(dim){ctx.save();ctx.filter='grayscale(.85)';}
    drawPeg(peg,x,y,pitch*.422,alpha,sx,sy);
    if(dim)ctx.restore();
    drawPegGlint(peg,x,y,pitch*.422,alpha,sx,sy,emphasis.white);
  }
  if(returning){const t=Math.min(1,(time-returning.start)/.2),ease=1-Math.pow(1-t,3),to=center(returning.id),peg=pegs.find(p=>p.id===returning.id);if(peg)drawPeg(peg,returning.from.x+(to.x-returning.from.x)*ease,returning.from.y+(to.y-returning.from.y)*ease,pitch*.44);if(t===1)returning=null;}
  if(drag?.moved){const p=dragPosition(drag);drawPeg(drag.peg,p.x,p.y,pitch*.455);}
  if(lost?.shown&&!lost.reverseStarted)drawLoss();
  if(reverseArt)for(const {peg,x,y,alpha,scale} of reverseArt.sprites)drawPeg(peg,x,y,pitch*.422*scale,alpha);
  for(const pulse of capturePulses)drawCapturePulse(pulse);
  for(const b of falling)if(b.pop)drawFalling(b);
  if(jump){
    // Crouch, a true parabola, a hit-stop over the captured ball, then the landing squash (jump-motion.js).
    const j=jump,calm=preferences.motion,s=jumpShape(j,time,calm,jumpPose),r=pitch*.422,a=j.releasePosition||center(j.move.from),b=center(j.move.to);
    const lift=pitch*(j.releasePosition?.38:.72),x=a.x+(b.x-a.x)*s.u,y=a.y+(b.y-a.y)*s.u;
    // The ball about to be captured flinches as the jumper comes down on it.
    if(!j.released){const over=center(j.move.over),pressure=calm?0:clamp01(1-(j.crossAt-s.u)/.25);drawPeg(j.captured,over.x,over.y+pressure*pitch*.03,r,1,1+pressure*.14,1-pressure*.15);}
    if(!calm){
      shadow(x,y+pitch*.24,pitch*(.34-s.height*.08),.16-s.height*.07);
      // Three fading copies a little behind on the same arc read as speed.
      if(s.t<1)for(let i=1;i<=3;i++){const g=s.u-i*JUMP.ghostLag;if(g<=0)break;drawPeg(j.mover,a.x+(b.x-a.x)*g,a.y+(b.y-a.y)*g-4*g*(1-g)*lift,r*(1-i*.07),.36-i*.1);}
    }
    // During the hit-stop the jumper swells for an instant, as if it pushed off the ball below.
    const puff=j.hitAt>=0&&!calm?Math.sin(Math.min(1,(time-j.hitAt)/Math.max(j.hitStop,.001))*Math.PI)*.08:0;
    drawPeg(j.mover,x,y-s.height*lift+s.sink*r,r,1,s.sx+puff,s.sy+puff);
    if(!j.released&&s.u>=j.crossAt){if(j.hitStop)j.hitAt=time;captureJump(j);}
    if(s.t===1){jump=null;controls.setAttribute('aria-busy','false');tone('land');buzz(7);landing={id:j.move.to,start:time};for(const angle of [0,Math.PI])juice.burst(b.x,b.y+pitch*.32,'shell',{count:8,speed:95,kind:'dust',size:[4,8],life:[.35,.55],gravity:-40,spread:Math.PI*.9,angle,up:0});update({refreshOrder:false});if(won)resultDue=time+.65;else checkCurrentPosition();}
  }
  for(const c of confetti){ctx.save();ctx.globalAlpha=Math.min(1,(c.life-c.age)*2);ctx.translate(c.x,c.y);ctx.rotate(c.angle);ctx.fillStyle=c.color;ctx.fillRect(-3,-5,6,10);ctx.restore();}
  for(const p of particles)drawSparkle(p);
  renderFirstLevelTutorial();renderMechanicTutorial();checkCurrentPosition();showPositionRecovery();showLossDecision();
  if(feedbackUntil&&time>feedbackUntil){$('feedback').classList.remove('show');feedbackUntil=0;}
  if(resultDue&&time>=resultDue&&!jump&&falling.length===0&&chew<.45&&!paused()){resultDue=0;showResult();}
}
function winEffects(){ensureMap();if(preferences.sfx&&(!preferences.music||soundtrack?.celebrate()!==true)&&time-cheerAt>1.5)tone('win');buzz([10,35,15]);chew=1;if(winWaveAt<0)winWaveAt=time;
  {const cx=W*.5,cy=board.y+board.size*.5;juice.confettiCannons();juice.flashScreen('#fffbe8',.4,.4);juice.kick(6,.45);juice.glow(cx,cy,'gold',{radius:W*.55,life:.6});juice.ring(cx,cy,'gold',{from:20,to:W*.6,life:.6,width:10});juice.burst(cx,cy,'gold',{count:22,speed:420,size:[6,12],life:[.8,1.2],gravity:420});}
  if(!preferences.motion)for(let i=0;i<12;i++)confetti.push({x:W*.5,y:board.y+board.size*.4,vx:(Math.random()-.5)*170,vy:-90-Math.random()*110,angle:Math.random()*6,spin:(Math.random()-.5)*4,age:0,life:1.1,color:['#ffdf72','#38c79c','#f17391','#fff5d9'][i%4]});}
// A won order skips the card: the dragon's word pops over the board and the map
// opens once it has played. Tapping the word opens the map straight away.
function startVictorySequence(){
  if(victoryPhase!==VICTORY.PLAYING)return;
  victoryPhase=VICTORY.TRIGGERED;victoryStartedAt=time;victoryReward=metaReward?{balls:metaReward.balls||0,golden:metaReward.golden||0}:{balls:0,golden:0};metaReward=null;
  victoryClears.clear();const count=Math.max(1,pegs.length-1);
  pegs.forEach((peg,index)=>{const f=count?index/count:1;victoryClears.set(peg.id,{at:.4+2*(1-Math.pow(1-f,2)),burst:false});});
  const sequence=$('victory-sequence');sequence.hidden=false;sequence.dataset.phase='triggered';
  sequence.querySelector('.victory-coins').hidden=victoryReward.balls<=0;sequence.querySelector('.victory-diamonds').hidden=victoryReward.golden<=0;
  game.classList.add('victory-active','victory-trigger');
  const focus=lastPlayedMove?.to?center(lastPlayedMove.to):{x:W*.5,y:board.y+board.size*.5};
  juice.flashScreen('#fff8e8',.16,.18);juice.ring(focus.x,focus.y,'gold',{from:pitch*.25,to:pitch*1.3,life:.42,width:7});juice.burst(focus.x,focus.y,'gold',{count:14,speed:260,size:[4,8],life:[.45,.75]});juice.kick(3,.24);tone('colorDone',8);buzz([8,18,8]);
  speak('Order complete.');
}
function tickVictorySequence(){
  if(victoryPhase===VICTORY.PLAYING||victoryPhase===VICTORY.TRANSITIONING)return;
  const elapsed=time-victoryStartedAt,reduced=preferences.motion;
  const clearingAt=reduced ? .06 : .4,celebrationAt=reduced ? .35 : 2.5,rewardsAt=reduced ? .55 : 3.5,continueAt=reduced ? .8 : 4.5;
  if(elapsed>=clearingAt&&victoryPhase===VICTORY.TRIGGERED){victoryPhase=VICTORY.CLEARING;$('victory-sequence').dataset.phase='clearing';}
  for(const [id,clear] of victoryClears){
    const at=reduced?clearingAt:clear.at;if(clear.burst||elapsed<at)continue;clear.burst=true;
    if(!reduced){const p=center(id),peg=pegs.find(item=>item.id===id);juice.ring(p.x,p.y,peg?.color||'gold',{from:pitch*.18,to:pitch*.65,life:.25,width:4});juice.burst(p.x,p.y,peg?.color||'gold',{count:7,speed:170,size:[3,6],life:[.3,.5]});tone('pop',Math.min(12,Math.round(at*4)));}
  }
  if(elapsed>=celebrationAt&&!victoryCelebrated){victoryCelebrated=true;victoryPhase=VICTORY.CELEBRATION;$('victory-sequence').dataset.phase='celebration';winEffects();speak(`You win! Level ${levelIndex+1} complete.`);}
  if(elapsed>=rewardsAt){
    if(victoryPhase===VICTORY.CELEBRATION){victoryPhase=VICTORY.REWARDS;$('victory-sequence').dataset.phase='rewards';}
    const p=clamp01((elapsed-rewardsAt)/(reduced ? .05 : .8)),ease=1-Math.pow(1-p,3);
    $('victory-coins-count').textContent=String(Math.round(victoryReward.balls*ease));
    $('victory-diamonds-count').textContent=String(Math.round(victoryReward.golden*clamp01((p-.2)/.8)));
    if(!victoryRewardSound){victoryRewardSound=true;tone('collect',10);buzz(8);}
  }
  if(elapsed>=continueAt&&victoryPhase!==VICTORY.WAITING){
    victoryPhase=VICTORY.WAITING;$('victory-sequence').dataset.phase='waiting';$('victory-coins-count').textContent=String(victoryReward.balls);$('victory-diamonds-count').textContent=String(victoryReward.golden);
    speak(`${victoryReward.balls} coins${victoryReward.golden?` and ${victoryReward.golden} diamond`:''}. Continue.`);
  }
}
function celebrate(){startVictorySequence();
}
$('win-burst').onclick=()=>{};
function showResult(reason='stuck',{card=false}={}){
  if(!won){setLoss();showPositionRecovery();return;}
  const perfect=won&&pegs[0]?.id==='3,3',final=isCampaign()&&!isChallenge()&&levelIndex===LAST_PLAYABLE_LEVEL-1&&progress.completed>=LAST_PLAYABLE_LEVEL;
  const nextUnlocked=levelIndex<LAST_PLAYABLE_LEVEL-1&&levelIndex+1<=progress.completed;
  $('result-symbol').textContent='✓';
  $('result-eyebrow').textContent=won?(isCampaign()?'CAFÉ ORDER SERVED':'PUZZLE COMPLETE'):'TRY ANOTHER PATH';
  const illustratedWin=won&&isCampaign()&&!isChallenge()&&!final;
  let expression;
  if(illustratedWin){let variant=Math.floor(Math.random()*(winExpressions.length-(lastWinVariant<0?0:1)));if(lastWinVariant>=0&&variant>=lastWinVariant)variant++;lastWinVariant=variant;expression=winExpressions[variant];}
  if(isCampaign()&&!isChallenge()&&!card){startVictorySequence();return;}
  const title=illustratedWin?expression.text:won?(isChallenge()?'Grand Tasting!':isCampaign()?'Order Served!':perfect?'Perfect Puzzle!':'One Treat Left!'):'A Small Snag';
  $('result-title-text').textContent=title;
  $('result-title-text').classList.toggle('sr-only',illustratedWin);
  $('result-art').hidden=!illustratedWin;
  if(illustratedWin)$('result-art').src=expression.image.src;
  $('result-copy').textContent=won?(isChallenge()?`Level 600 complete · ${history.length} jumps`:isCampaign()?(final?`You completed all ${LAST_PLAYABLE_LEVEL} orders.`:`Level ${levelIndex+1} complete · ${history.length} ${history.length===1?'jump':'jumps'}`):`${history.length} jumps.${perfect?' The last treat is in the center.':''}`):(reason==='dead'?'The order cannot be completed from here.':'No jumps remain and the objective is incomplete.');
  $('result-detail').textContent=isChallenge()?'A taste of the adventure finale.':isCampaign()?(final?'Replay your favorites or try Classic mode.':nextUnlocked?`Next: Level ${levelIndex+2}`:'Continue from your unlocked level.'):'Every game is a new path.';
  $('result-primary').textContent=won?(isChallenge()?'Back to My Levels':isCampaign()?'Continue on Map':'Play Again'):'Replay Level';
  $('result-secondary').textContent='Replay Level';$('result-secondary').disabled=false;$('result').hidden=false;placeResult();
  $('result').classList.toggle('level-won',won);
  if(won)winEffects();
  $('result-primary').focus();speak(title);
}
function frame(stamp){if(mapOpen){raf=0;return;}maybeShowLives();maybeShowMechanicIntro();renderMechanicDemo(stamp);const dt=lastFrame?Math.min((stamp-lastFrame)/1000,.05):0;lastFrame=stamp;if(!paused())time+=dt;accumulator+=dt;let count=0;while(accumulator>=1/120&&count<7){step(1/120);accumulator-=1/120;count++;}juice.step(paused()?0:dt);showEarlyLevelHelp();updateIdleMove();render();juice.render();syncMusic();raf=requestAnimationFrame(frame);}
async function boot(){
  try{
    game.classList.toggle('reduced-motion',preferences.motion);
    await Promise.all([foregroundLayer.decode(),prepareMarbles(),dragonLayer.decode(),splashLogo.decode(),artLoader.load(catDiamondArt)]);
    ready=true;loadLevel(startIndex);await chapterSceneryReady;resize();raf=requestAnimationFrame(frame);$('splash-play').onclick=startGame;
    if(query.get('map')==='1'){showMap(Number(query.get('completed'))||null,{replace:true});return;}
    if(mapEntry||localDirectPreview){$('loading').hidden=true;await revealPlayfield();return;}
    const loading=$('loading');loading.classList.add('splash-ready');
    $('splash-status').textContent='Tap anywhere to continue';$('splash-play').disabled=false;$('splash-play').onclick=startGame;loading.onclick=event=>{if(event.target.closest('button')?.id!=='splash-play'&&loading.classList.contains('splash-playable'))startGame();};loading.classList.add('splash-playable');
    ensureMap();artLoader.load(bittenLogo).catch(()=>{});
  }catch(error){$('loading').innerHTML='<strong>Could Not Load</strong><span>Check your connection and reopen the game.</span><button class="primary" id="retry-load">Try Again</button>'; $('retry-load').onclick=()=>location.reload();console.error(error);}
}
window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.addEventListener('orientationchange',()=>setTimeout(resize,100));
document.addEventListener('visibilitychange',()=>{cancelDrag();if(document.hidden){cancelAnimationFrame(raf);stopAudio();audio?.suspend().catch(()=>{});}else if(ready){readLatestLives();renderLives();update();if(preferences.music||preferences.sfx)audio?.resume().catch(()=>{});lastFrame=0;accumulator=0;raf=requestAnimationFrame(frame);}});
window.addEventListener('pagehide',()=>{stopAudio();cancelAnimationFrame(raf);});
window.addEventListener('pageshow',e=>{if(e.persisted&&ready){cancelAnimationFrame(raf);lastFrame=0;accumulator=0;resize();raf=requestAnimationFrame(frame);}});
if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
boot();
