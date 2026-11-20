const assert=require('node:assert/strict');
const core=require('./blocks.js');
const {SHAPES,BY_ID,available,positions,resolvePlacement,newTray,canContinue}=core;
const empty=()=>Array(81).fill(0);
const dot=BY_ID.one;
let assertions=0;
function check(cond,msg){assert.ok(cond,msg);assertions++;}
check(SHAPES.length>=15,'Diverse pieces');
for(const shape of SHAPES){
 check(shape.p.length>0&&shape.p.length<=5,'Each piece has a sensible size');
 check(available(empty(),shape.p,0,0),'Each shape fits on empty board');
 check(positions(empty(),shape.p).length>0,'Each shape has available positions');
 for(const cell of shape.p)check(cell[0]>=0&&cell[1]>=0&&cell[0]<=4&&cell[1]<=4,'Normalized shape bounds');
}
{
 const b=empty();for(let c=0;c<8;c++)b[c]=1;
 const p=resolvePlacement(b,dot,0,8);
 check(p!==null,'Row last cell placement valid');
 check(p.units.length===1&&p.units.includes('row0'),'Completed row cleared');
 check(p.cleared.length===9,'Nine cleared row cells');
 check(p.board.slice(0,9).every(v=>v===0),'All row cells empty after clear');
 check(p.points===19,'Scoring of a completed line');
 check(b.slice(0,8).every(v=>v===1),'Pure function does not mutate input');
}
{
 const b=empty();for(let r=0;r<8;r++)b[r*9+3]=1;
 const p=resolvePlacement(b,dot,8,3);
 check(p.units.length===1&&p.units.includes('col3'),'Completed column cleared');
 check(p.board.every(v=>v===0),'All column cells removed');
}
{
 const b=empty();
 for(let r=3;r<6;r++)for(let c=3;c<6;c++)b[r*9+c]=1;
 b[5*9+5]=0;
 const p=resolvePlacement(b,dot,5,5);
 check(p.units.length===1&&p.units.includes('box11'),'Completed 3x3 square cleared');
 check(p.cleared.length===9,'Nine square cells disappeared');
 check(p.board.every(v=>v===0),'Square removed completely');
}
{
 const b=empty();
 for(let c=1;c<9;c++)b[c]=1;
 for(let r=1;r<9;r++)b[r*9]=1;
 for(let r=0;r<3;r++)for(let c=0;c<3;c++){if(r||c)b[r*9+c]=1;}
 const p=resolvePlacement(b,dot,0,0);
 check(p.units.length===3,'Simultaneous row, column and box completion');
 check(p.units.includes('row0')&&p.units.includes('col0')&&p.units.includes('box00'),'All three detected');
 check(p.cleared.length===21,'Intersection cells counted once (9+9+9-6)');
 check(p.board.every(v=>v===0),'All cleared without leaving artifacts');
}
{
 const b=empty();b[0]=1;
 check(!available(b,dot,0,0),'Collision rejected');
 check(resolvePlacement(b,dot,0,0)===null,'Invalid move cannot mutate game');
 check(!available(empty(),BY_ID.h5,0,7),'Out-of-bounds rejected');
 check(!available(empty(),BY_ID.v5,8,0),'Vertical out-of-bounds rejected');
 check(positions(Array(81).fill(1),dot).length===0,'No moves on full board');
 check(!canContinue(Array(81).fill(1),['one','h2','v2']),'Game-over detection');
}
{
 const b=empty();const a=newTray(b,()=>.42);
 check(a.length===3,'New pack has exactly three pieces');
 check(a.some(id=>id&&positions(b,BY_ID[id]).length>0),'First new piece is playable');
}
// Deterministic, adversarial multi-turn play. No infinite loops or impossible placements.
for(let k=0;k<18;k++){
 let seed=k+19019;
 const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 let board=empty(),tray=newTray(board,rng),turns=0,score=0;
 while(canContinue(board,tray)&&turns<350){
  const opts=tray.map((id,i)=>id?{id,i,pos:positions(board,BY_ID[id])}:null).filter(x=>x&&x.pos.length);
  check(opts.length>0,'At least one valid piece while in play');
  const selection=opts[Math.floor(rng()*opts.length)];
  const anchor=selection.pos[Math.floor(rng()*selection.pos.length)];
  const result=resolvePlacement(board,BY_ID[selection.id],anchor[0],anchor[1]);
  check(!!result,'Adversarial move valid');
  board=result.board;
  check(board.length===81&&board.every(v=>v===0||v===1),'Board binary invariant');
  score+=result.points;
  check(result.points>=BY_ID[selection.id].length,'Score nonnegative');
  tray[selection.i]=null;
  if(tray.every(id=>id===null))tray=newTray(board,rng);
  turns++;
 }
 check(turns>0,'Game had at least one turn');
 check(turns<350,'Game does not loop endlessly');
 check(score>0,'Game awards points');
}
console.log('PASS Block puzzle engine:',assertions,'assertions');
