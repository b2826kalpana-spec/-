/* FINKE SUDOKU 4.0 • BLOCKS: independent 9x9 block puzzle game */
(function(root){
'use strict';
var N=9;
var SHAPES=[
 {id:'one',p:[[0,0]]},
 {id:'h2',p:[[0,0],[0,1]]},
 {id:'v2',p:[[0,0],[1,0]]},
 {id:'h3',p:[[0,0],[0,1],[0,2]]},
 {id:'v3',p:[[0,0],[1,0],[2,0]]},
 {id:'h4',p:[[0,0],[0,1],[0,2],[0,3]]},
 {id:'v4',p:[[0,0],[1,0],[2,0],[3,0]]},
 {id:'square',p:[[0,0],[0,1],[1,0],[1,1]]},
 {id:'l3',p:[[0,0],[1,0],[1,1]]},
 {id:'j3',p:[[0,1],[1,0],[1,1]]},
 {id:'up3',p:[[0,0],[0,1],[1,0]]},
 {id:'down3',p:[[0,0],[0,1],[1,1]]},
 {id:'l4',p:[[0,0],[1,0],[2,0],[2,1]]},
 {id:'j4',p:[[0,1],[1,1],[2,0],[2,1]]},
 {id:'t4',p:[[0,0],[0,1],[0,2],[1,1]]},
 {id:'s4',p:[[0,1],[0,2],[1,0],[1,1]]},
 {id:'z4',p:[[0,0],[0,1],[1,1],[1,2]]},
 {id:'plus5',p:[[0,1],[1,0],[1,1],[1,2],[2,1]]},
 {id:'h5',p:[[0,0],[0,1],[0,2],[0,3],[0,4]]},
 {id:'v5',p:[[0,0],[1,0],[2,0],[3,0],[4,0]]},
 {id:'corner5',p:[[0,0],[1,0],[2,0],[2,1],[2,2]]}
];
var BY_ID={};
SHAPES.forEach(function(shape){BY_ID[shape.id]=shape.p;});
function cellsFor(id){return BY_ID[id]||null;}
function available(board,shape,row,col){
 if(!Array.isArray(board)||board.length!==81||!shape||row<0||col<0)return false;
 for(var i=0;i<shape.length;i++){
  var r=row+shape[i][0],c=col+shape[i][1];
  if(r>8||c>8||board[r*9+c])return false;
 }
 return true;
}
function positions(board,shape){
 var list=[];
 for(var r=0;r<9;r++)for(var c=0;c<9;c++){
  if(available(board,shape,r,c))list.push([r,c]);
 }
 return list;
}
function resolvePlacement(board,shape,row,col){
 if(!available(board,shape,row,col))return null;
 var next=board.slice(),i,r,c,cleared={},units=[];
 for(i=0;i<shape.length;i++){
  r=row+shape[i][0];c=col+shape[i][1];next[r*9+c]=1;
 }
 for(r=0;r<9;r++){
  var rowFull=true;
  for(c=0;c<9;c++){if(!next[r*9+c])rowFull=false;}
  if(rowFull){units.push('row'+r);for(c=0;c<9;c++)cleared[r*9+c]=true;}
 }
 for(c=0;c<9;c++){
  var colFull=true;
  for(r=0;r<9;r++){if(!next[r*9+c])colFull=false;}
  if(colFull){units.push('col'+c);for(r=0;r<9;r++)cleared[r*9+c]=true;}
 }
 for(var br=0;br<3;br++)for(var bc=0;bc<3;bc++){
  var boxFull=true;
  for(var dr=0;dr<3;dr++)for(var dc=0;dc<3;dc++){
   if(!next[(br*3+dr)*9+bc*3+dc])boxFull=false;
  }
  if(boxFull){
   units.push('box'+br+bc);
   for(dr=0;dr<3;dr++)for(dc=0;dc<3;dc++)cleared[(br*3+dr)*9+bc*3+dc]=true;
  }
 }
 var clearedCells=Object.keys(cleared).map(Number);
 clearedCells.forEach(function(index){next[index]=0;});
 return {board:next,units:units,cleared:clearedCells,points:shape.length+18*units.length,placed:shape.length};
}
function newTray(board,rng){
 var random=typeof rng==='function'?rng:Math.random;
 var candidates=SHAPES.filter(function(s){return positions(board,s.p).length>0;});
 if(!candidates.length)return [null,null,null];
 var pick=function(items){return items[Math.min(items.length-1,Math.floor(random()*items.length))].id;};
 var first=pick(candidates),all=[first];
 for(var i=1;i<3;i++)all.push(pick(SHAPES));
 return all;
}
function canContinue(board,tray){
 return tray.some(function(id){return id && positions(board,BY_ID[id]).length>0;});
}
var KEY='finke.blocks.save.v1',BEST_KEY='finke.blocks.best.v1';
var state=null,visible=false,preview=null,gesture=null,flashTimer=null,ignoreClicksBefore=0;
function getItem(key){try{return localStorage.getItem(key);}catch(e){return null;}}
function setItem(key,val){try{localStorage.setItem(key,val);}catch(e){}}
function blank(){
 var board=Array(81).fill(0);
 return {board:board,tray:newTray(board),selected:0,score:0,moves:0,cleared:0,combo:0,best:Number(getItem(BEST_KEY))||0,over:false};
}
function save(){if(state)setItem(KEY,JSON.stringify(state));}
function restore(){
 try {
  var value=JSON.parse(getItem(KEY));
  if(!value||!Array.isArray(value.board)||value.board.length!==81||!Array.isArray(value.tray)||value.tray.length!==3)return blank();
  if(value.board.some(function(v){return v!==0&&v!==1;}))return blank();
  if(value.tray.some(function(id){return id!==null&&!BY_ID[id];}))return blank();
  value.score=Number(value.score)||0;value.best=Math.max(Number(value.best)||0,Number(getItem(BEST_KEY))||0);
  value.moves=Number(value.moves)||0;value.cleared=Number(value.cleared)||0;
  value.combo=Number(value.combo)||0;value.over=!!value.over;
  if(value.selected!==null && (!Number.isInteger(value.selected)||value.selected<0||value.selected>2))value.selected=null;
  return value;
 }catch(e){return blank();}
}
function selectFirst(){state.selected=state.tray.findIndex(function(id){return id!==null;});if(state.selected<0)state.selected=null;}
function placeAt(index){
 if(!visible||!state||state.over||state.selected===null||state.selected<0)return false;
 var id=state.tray[state.selected];if(!id)return false;
 var result=resolvePlacement(state.board,BY_ID[id],Math.floor(index/9),index%9);
 if(!result){announce('Здесь фигура не поместится. Выбери другое место.');return false;}
 state.board=result.board;
 state.tray[state.selected]=null;
 state.moves++;
 state.combo=result.units.length?state.combo+1:0;
 var comboBonus=result.units.length&&state.combo>1?(state.combo-1)*5:0;
 state.score+=result.points+comboBonus;
 state.cleared+=result.units.length;
 if(state.score>state.best){state.best=state.score;setItem(BEST_KEY,String(state.best));}
 if(state.tray.every(function(id){return id===null;}))state.tray=newTray(state.board);
 selectFirst();preview=null;
 if(result.units.length){
   announce('Отлично! Исчезло: '+result.units.length+' · +'+(result.points+comboBonus)+' очков');
   showClear(result.cleared);
 }else{
   announce('+'+result.placed+' очков');
 }
 if(!canContinue(state.board,state.tray)){state.over=true;}
 save();paint();
 if(state.over)showGameOver();
 return true;
}
function showClear(indices){
 clearTimeout(flashTimer);
 var message=document.getElementById('blocksMessage');
 if(message){message.classList.add('blocks-celebrate');}
 flashTimer=setTimeout(function(){if(message)message.classList.remove('blocks-celebrate');},550);
}
function announce(text){
 var node=document.getElementById('blocksMessage');
 if(node)node.textContent=text;
}
function shapeNode(id){
 var shape=BY_ID[id];
 var maxR=0,maxC=0;
 shape.forEach(function(p){maxR=Math.max(maxR,p[0]);maxC=Math.max(maxC,p[1]);});
 var wrapper=document.createElement('span');wrapper.className='block-shape';
 wrapper.style.gridTemplateColumns='repeat('+(maxC+1)+', 16px)';
 wrapper.style.gridTemplateRows='repeat('+(maxR+1)+', 16px)';
 var map={};shape.forEach(function(p){map[p[0]+','+p[1]]=true;});
 for(var r=0;r<=maxR;r++)for(var c=0;c<=maxC;c++){
  var cell=document.createElement('span');
  cell.className='block-shape-cell'+(map[r+','+c]?' filled':'');
  wrapper.appendChild(cell);
 }
 return wrapper;
}
function renderTray(){
 var el=document.getElementById('blocksTray');if(!el||!state)return;
 el.innerHTML='';
 state.tray.forEach(function(id,i){
  var button=document.createElement('button');
  button.type='button';button.className='blocks-piece';
  button.dataset.slot=String(i);
  button.setAttribute('aria-label',id?'Фигура '+(i+1)+', '+BY_ID[id].length+' клеток':'Фигура '+(i+1)+' уже использована');
  if(id){button.appendChild(shapeNode(id));}else{button.textContent='✓';button.classList.add('used');button.disabled=true;}
  if(i===state.selected&&id)button.classList.add('chosen');
  el.appendChild(button);
 });
}
function previewAt(index){
 if(!state||state.selected===null||!state.tray[state.selected]){preview=null;paintBoard();return;}
 var shape=BY_ID[state.tray[state.selected]],row=Math.floor(index/9),col=index%9;
 var valid=available(state.board,shape,row,col);
 var cells=[];
 shape.forEach(function(p){var r=row+p[0],c=col+p[1];if(r<9&&c<9)cells.push(r*9+c);});
 preview={valid:valid,cells:cells};paintBoard();
}
function paintBoard(){
 var board=document.getElementById('blocksBoard');if(!board||!state)return;
 var fragment=document.createDocumentFragment();
 for(var i=0;i<81;i++){
  var c=document.createElement('button');c.type='button';c.dataset.cell=String(i);c.className='blocks-cell';
  var r=Math.floor(i/9),col=i%9;
  if(col===2||col===5)c.className+=' thick-right';
  if(r===2||r===5)c.className+=' thick-bottom';
  if(state.board[i])c.className+=' occupied';
  if(preview&&preview.cells.indexOf(i)!==-1)c.className+=preview.valid?' preview-ok':' preview-no';
  c.setAttribute('aria-label','Строка '+(r+1)+', столбец '+(col+1)+(state.board[i]?', занята':' свободна'));
  fragment.appendChild(c);
 }
 board.innerHTML='';
 board.appendChild(fragment);
}
function paint(){
 if(!state)return;
 var score=document.getElementById('blocksScore'),best=document.getElementById('blocksBest');
 var moves=document.getElementById('blocksMoves');
 if(score)score.textContent=String(state.score);
 if(best)best.textContent=String(state.best);
 if(moves)moves.textContent=String(state.moves);
 renderTray();paintBoard();
}
function enter(){
 if(!state)state=restore();
 visible=true;preview=null;
 document.getElementById('home').classList.add('hidden');
 document.getElementById('game').classList.add('hidden');
 document.getElementById('blocksGame').classList.remove('hidden');
 // Integrate with existing Android back-button handling and Sudoku screen state.
 if(typeof screen!=='undefined')screen='blocks';
 if(state.over)announce('Игра окончена. Начни новую партию.');
 else announce('Выбери фигуру, затем коснись места на поле.');
 paint();save();
}
function home(){
 visible=false;preview=null;gesture=null;
 document.getElementById('blocksGame').classList.add('hidden');save();
 if(typeof closeModal==='function')closeModal();
 if(typeof renderHome==='function')renderHome();
}
function reset(){
 state=blank();preview=null;save();paint();
 announce('Новая партия. Выбери фигуру, затем место на поле.');
}
function help(){
 if(typeof showModal!=='function')return;
 showModal('help','<div class="modal-icon">▦</div><h2>Как играть в «Блоки»</h2>'+
  '<p>Это игра без цифр и спешки. Здесь нужно собирать заполненные линии и квадраты.</p>'+
  '<div class="help-steps"><div><b>1</b><span>Нажми на одну из трёх цветных фигур внизу.</span></div>'+
  '<div><b>2</b><span>Коснись свободного места на поле 9 × 9. Можно также перетащить фигуру пальцем.</span></div>'+
  '<div><b>3</b><span>Заполни целую горизонтальную линию, вертикальную линию или квадрат 3 × 3: клетки исчезнут и появится свободное место.</span></div>'+
  '<div><b>4</b><span>Когда поставишь все три фигуры, появятся три новые. Набирай очки, пока фигуры помещаются.</span></div></div>'+
  '<div class="modal-actions" style="margin-top:16px"><button class="primary-btn" data-act="close">Понятно, играем!</button></div>');
}
function showGameOver(){
 if(typeof showModal!=='function')return;
 showModal('blocksover','<div class="modal-icon">★</div><h2>Хорошая партия!</h2>'+
  '<p>Фигуры больше не помещаются. Твой результат: <strong>'+state.score+' очков</strong>!</p>'+
  '<div class="modal-actions"><button class="primary-btn" data-block-act="new">Играть ещё</button>'+
  '<button class="secondary-btn" data-block-act="home">На главную</button></div>');
}
function askRestart(){
 if(typeof showModal!=='function')return;
 showModal('blocksconfirm','<div class="modal-icon">↻</div><h2>Начать заново?</h2>'+
  '<p>Текущие очки этой партии сбросятся. Лучший результат останется.</p>'+
  '<div class="modal-actions"><button class="primary-btn" data-block-act="new">Да, новая игра</button>'+
  '<button class="secondary-btn" data-act="close">Продолжить</button></div>');
}
function init(){
 if(!document.getElementById('blocksGame'))return;
 var button=document.getElementById('openBlocks');
 if(button)button.addEventListener('click',enter);
 document.getElementById('blocksExit').addEventListener('click',home);
 document.getElementById('blocksHelp').addEventListener('click',help);
 document.getElementById('blocksRestart').addEventListener('click',askRestart);
 document.getElementById('blocksModal').addEventListener('click',help);
 document.getElementById('modalContent').addEventListener('click',function(ev){
  var action=ev.target.closest('[data-block-act]');
  if(!action)return;
  if(typeof closeModal==='function')closeModal();
  if(action.dataset.blockAct==='new')reset();
  if(action.dataset.blockAct==='home')home();
 });
 document.getElementById('blocksTray').addEventListener('click',function(ev){
  if(Date.now()<ignoreClicksBefore)return;
  var btn=ev.target.closest('[data-slot]');if(!btn||!state||state.over)return;
  var n=Number(btn.dataset.slot);if(!state.tray[n])return;
  state.selected=n;preview=null;save();paint();
  announce('Фигура выбрана. Теперь нажми на свободное место.');
 });
 document.getElementById('blocksBoard').addEventListener('click',function(ev){
  if(Date.now()<ignoreClicksBefore)return;
  var target=ev.target.closest('[data-cell]');
  if(target)placeAt(Number(target.dataset.cell));
 });
 // Drag with a finger or mouse; tap-to-place always remains available.
 var tray=document.getElementById('blocksTray');
 tray.addEventListener('pointerdown',function(ev){
  var btn=ev.target.closest('[data-slot]');if(!btn||!state||state.over)return;
  var slot=Number(btn.dataset.slot);if(!state.tray[slot])return;
  gesture={slot:slot,x:ev.clientX,y:ev.clientY,moving:false};
  state.selected=slot;paint();
 });
 document.addEventListener('pointermove',function(ev){
  if(!gesture||!visible||!state||state.over)return;
  var dx=ev.clientX-gesture.x,dy=ev.clientY-gesture.y;
  if(!gesture.moving&&dx*dx+dy*dy<160)return;
  gesture.moving=true;
  var item=document.elementFromPoint(ev.clientX,ev.clientY);
  var cell=item&&item.closest('[data-cell]');
  if(cell&&cell.closest('#blocksBoard'))previewAt(Number(cell.dataset.cell));
  else if(preview){preview=null;paintBoard();}
 });
 document.addEventListener('pointerup',function(ev){
  if(!gesture)return;
  var moving=gesture.moving;gesture=null;
  if(moving){
   ignoreClicksBefore=Date.now()+350;
   var elem=document.elementFromPoint(ev.clientX,ev.clientY);
   var cell=elem&&elem.closest('[data-cell]');
   preview=null;
   if(cell&&cell.closest('#blocksBoard'))placeAt(Number(cell.dataset.cell));
   else paint();
  }
 });
 document.addEventListener('pointercancel',function(){gesture=null;preview=null;if(visible)paintBoard();});
 var previousBack=window.finkeBack;
 window.finkeBack=function(){if(visible){home();}else if(previousBack)previousBack();};
 var prevPause=window.finkePause;
 window.finkePause=function(){if(visible)save();if(prevPause)prevPause();};
}
if(typeof module!=='undefined'&&module.exports)module.exports={
 SHAPES:SHAPES,BY_ID:BY_ID,available:available,positions:positions,resolvePlacement:resolvePlacement,newTray:newTray,canContinue:canContinue
};
if(typeof document!=='undefined')init();
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:this);
