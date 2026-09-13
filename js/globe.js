(()=>{
  const stage=document.querySelector('#globeStage');
  const canvas=document.querySelector('#globeCanvas');
  const flat=document.querySelector('#worldMap');
  const view3d=document.querySelector('#view3d');
  const view2d=document.querySelector('#view2d');
  if(!stage||!canvas||!flat||!view3d||!view2d)return;

  const setFallback=()=>{
    stage.classList.add('hidden');
    flat.classList.remove('atlas-flat-hidden');
    document.body.classList.remove('globe-mode');
    view3d.disabled=true;
    view3d.title='WebGL недоступен — используется плоская карта';
    view2d.classList.add('active');
  };
  if(!window.THREE){setFallback();return;}

  let renderer;
  try{
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  }catch(err){console.warn('WebGL unavailable',err);setFallback();return;}

  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(34,1,.1,100);
  camera.position.set(0,0,3.25);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;

  const globe=new THREE.Group();
  scene.add(globe);
  const texCanvas=document.createElement('canvas');
  texCanvas.width=2048; texCanvas.height=1024;
  const ctx=texCanvas.getContext('2d',{alpha:false});
  const texture=new THREE.CanvasTexture(texCanvas);
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  texture.wrapS=THREE.RepeatWrapping;
  texture.colorSpace=THREE.SRGBColorSpace;

  const sphere=new THREE.Mesh(
    new THREE.SphereGeometry(1,128,80),
    new THREE.MeshStandardMaterial({map:texture,roughness:.72,metalness:.08})
  );
  globe.add(sphere);

  const atmosphere=new THREE.Mesh(
    new THREE.SphereGeometry(1.035,96,64),
    new THREE.MeshBasicMaterial({color:0x68b9ff,transparent:true,opacity:.085,side:THREE.BackSide,depthWrite:false})
  );
  globe.add(atmosphere);

  scene.add(new THREE.HemisphereLight(0xbfe5ff,0x071018,1.6));
  const key=new THREE.DirectionalLight(0xffe5ae,2.35); key.position.set(-3,2.4,4.5); scene.add(key);
  const rim=new THREE.DirectionalLight(0x5ab4ff,1.35); rim.position.set(4,-1,-3); scene.add(rim);

  const gridGroup=new THREE.Group();
  const gridMat=new THREE.LineBasicMaterial({color:0xaed7ee,transparent:true,opacity:.12,depthWrite:false});
  const addArc=pts=>{const geo=new THREE.BufferGeometry().setFromPoints(pts);gridGroup.add(new THREE.Line(geo,gridMat));};
  const R=1.006;
  for(let lat=-60;lat<=60;lat+=30){
    const a=THREE.MathUtils.degToRad(lat),pts=[];
    for(let lon=-180;lon<=180;lon+=3){const l=THREE.MathUtils.degToRad(lon);pts.push(new THREE.Vector3(-R*Math.cos(l)*Math.cos(a),R*Math.sin(a),R*Math.sin(l)*Math.cos(a)));}
    addArc(pts);
  }
  for(let lon=-150;lon<=180;lon+=30){
    const l=THREE.MathUtils.degToRad(lon),pts=[];
    for(let lat=-89;lat<=89;lat+=3){const a=THREE.MathUtils.degToRad(lat);pts.push(new THREE.Vector3(-R*Math.cos(l)*Math.cos(a),R*Math.sin(a),R*Math.sin(l)*Math.cos(a)));}
    addArc(pts);
  }
  globe.add(gridGroup);

  const starGeo=new THREE.BufferGeometry();
  const starPos=[];
  for(let i=0;i<700;i++){
    const r=5+Math.random()*8,phi=Math.random()*Math.PI*2,c=Math.random()*2-1,s=Math.sqrt(1-c*c);
    starPos.push(r*s*Math.cos(phi),r*c,r*s*Math.sin(phi));
  }
  starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3));
  scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xd8e9f4,size:.012,transparent:true,opacity:.52,sizeAttenuation:true})));

  const palette={Europe:'#9c8558',Asia:'#447b91',Africa:'#956a50','North America':'#537d62','South America':'#39775d',Oceania:'#817565',Antarctica:'#9aa8ae','Seven seas (open ocean)':'#687780'};
  let selectedIso='RUS',region='World';
  const gdpValues=Object.values(window.ATLAS_META||{}).map(m=>Number(m?.gdpMdEst||0)).filter(v=>v>0);
  const gdpLo=Math.log10(Math.max(1,Math.min(...gdpValues))),gdpHi=Math.log10(Math.max(...gdpValues));

  function eachPolygon(geometry,fn){
    if(!geometry)return;
    if(geometry.type==='Polygon')fn(geometry.coordinates);
    else if(geometry.type==='MultiPolygon')geometry.coordinates.forEach(fn);
  }
  function traceRing(ring,offset){
    const w=texCanvas.width,h=texCanvas.height;
    let prev=null,shift=0;
    ring.forEach((p,i)=>{
      let x=(p[0]+180)/360*w;
      const y=(90-p[1])/180*h;
      if(prev!==null){while(x+shift-prev>w/2)shift-=w;while(x+shift-prev< -w/2)shift+=w;}
      const xx=x+shift+offset;
      if(i===0)ctx.moveTo(xx,y);else ctx.lineTo(xx,y);
      prev=x+shift;
    });
    ctx.closePath();
  }
  function drawGeometry(geometry,fill,stroke='#d9e7ed55',line=1){
    const w=texCanvas.width;
    eachPolygon(geometry,poly=>{
      for(const off of [-w,0,w]){
        ctx.beginPath();
        poly.forEach(r=>traceRing(r,off));
        ctx.fillStyle=fill;ctx.fill('evenodd');
        ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();
      }
    });
  }
  function economyColor(f){
    const m=(window.ATLAS_META||{})[f.properties.iso_a3];
    const v=Number(m?.gdpMdEst||f.properties.gdp_md_est||0);
    const t=v>0?(Math.log10(v)-gdpLo)/Math.max(.001,gdpHi-gdpLo):0;
    return `hsl(42 ${45+t*38}% ${24+t*39}%)`;
  }
  function renderTexture(){
    const w=texCanvas.width,h=texCanvas.height;
    const ocean=ctx.createRadialGradient(w*.42,h*.38,20,w*.5,h*.5,w*.72);
    ocean.addColorStop(0,'#12394f');ocean.addColorStop(.55,'#092334');ocean.addColorStop(1,'#040c13');
    ctx.fillStyle=ocean;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#6f9ab315';ctx.lineWidth=1;
    for(let lon=0;lon<=360;lon+=30){ctx.beginPath();ctx.moveTo(lon/360*w,0);ctx.lineTo(lon/360*w,h);ctx.stroke();}
    for(let lat=0;lat<=180;lat+=30){ctx.beginPath();ctx.moveTo(0,lat/180*h);ctx.lineTo(w,lat/180*h);ctx.stroke();}
    const economy=document.body.classList.contains('economy-mode');
    for(const f of (window.ATLAS_WORLD?.features||[])){
      const p=f.properties||{};
      let fill=economy?economyColor(f):(palette[p.continent]||'#677b85');
      if(region!=='World'&&p.continent!==region)fill='#182934';
      if(p.iso_a3===selectedIso)fill=economy?'#f4c660':'#2d91e6';
      drawGeometry(f.geometry,fill,p.iso_a3===selectedIso?'#ffd47a':'#d7e5e944',p.iso_a3===selectedIso?3:1);
    }
    for(const item of (window.ATLAS_SPECIAL?.features||[])){
      drawGeometry(item.geojson?.geometry,'#2f8dde','#f3ca68',2.5);
    }
    texture.needsUpdate=true;
  }
  renderTexture();

  const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
  function pointInRing(lon,lat,ring){
    let inside=false;
    const unwrap=x=>{while(x-lon>180)x-=360;while(x-lon< -180)x+=360;return x;};
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const xi=unwrap(ring[i][0]),yi=ring[i][1],xj=unwrap(ring[j][0]),yj=ring[j][1];
      if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/((yj-yi)||1e-12)+xi))inside=!inside;
    }
    return inside;
  }
  function pointInGeometry(lon,lat,g){
    let yes=false;
    eachPolygon(g,poly=>{if(yes||!poly[0]||!pointInRing(lon,lat,poly[0]))return;for(let i=1;i<poly.length;i++)if(pointInRing(lon,lat,poly[i]))return;yes=true;});
    return yes;
  }
  function featureAt(lon,lat){
    for(const item of (window.ATLAS_SPECIAL?.features||[]))if(pointInGeometry(lon,lat,item.geojson?.geometry))return (window.ATLAS_WORLD?.features||[]).find(f=>f.properties.iso_a3==='RUS'||f.properties.name==='Russia');
    return (window.ATLAS_WORLD?.features||[]).find(f=>pointInGeometry(lon,lat,f.geometry));
  }
  function cast(ev){
    const r=canvas.getBoundingClientRect();
    mouse.x=((ev.clientX-r.left)/r.width)*2-1;mouse.y=-((ev.clientY-r.top)/r.height)*2+1;
    raycaster.setFromCamera(mouse,camera);
    const hit=raycaster.intersectObject(sphere,false)[0];
    if(!hit?.uv)return null;
    let lon=hit.uv.x*360-180,lat=hit.uv.y*180-90;
    return featureAt(lon,lat)||null;
  }
  function metaFor(f){
    if(!f)return null;
    const p=f.properties||{},alias=(window.ATLAS_ALIASES||{})[p.name];
    return (window.ATLAS_META||{})[p.iso_a3]||(alias&&(window.ATLAS_META||{})[alias])||null;
  }
  function selectFeature(f){
    if(!f)return;
    const p=f.properties||{};
    const el=[...document.querySelectorAll('.country')].find(x=>x.dataset.iso===p.iso_a3)||[...document.querySelectorAll('.country')].find(x=>x.dataset.name===p.name);
    if(el)el.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    selectedIso=p.iso_a3||selectedIso;renderTexture();
  }

  let currentView='3d';
  function setView(mode){
    currentView=mode;
    const is3=mode==='3d';
    stage.classList.toggle('hidden',!is3);flat.classList.toggle('atlas-flat-hidden',is3);
    document.body.classList.toggle('globe-mode',is3);
    view3d.classList.toggle('active',is3);view2d.classList.toggle('active',!is3);
    if(is3){resize();renderer.render(scene,camera);}
  }
  view3d.addEventListener('click',()=>setView('3d'));
  view2d.addEventListener('click',()=>setView('2d'));

  const pointers=new Map();
  let dragStart=null,last={x:0,y:0},moved=0,pinch=0,velocity={x:0,y:0},idleUntil=0;
  const clampZoom=()=>camera.position.z=Math.max(1.65,Math.min(5.1,camera.position.z));
  canvas.addEventListener('pointerdown',ev=>{
    pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});canvas.setPointerCapture(ev.pointerId);
    dragStart={x:ev.clientX,y:ev.clientY};last={x:ev.clientX,y:ev.clientY};moved=0;velocity={x:0,y:0};idleUntil=performance.now()+5000;
    if(pointers.size===2){const a=[...pointers.values()];pinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}
  });
  canvas.addEventListener('pointermove',ev=>{
    if(!pointers.has(ev.pointerId))return;
    pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
    if(pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinch){camera.position.z*=pinch/d;clampZoom();}pinch=d;return;}
    const dx=ev.clientX-last.x,dy=ev.clientY-last.y;moved+=Math.abs(dx)+Math.abs(dy);
    globe.rotation.y+=dx*.006;globe.rotation.x+=dy*.0045;globe.rotation.x=Math.max(-1.12,Math.min(1.12,globe.rotation.x));
    velocity={x:dx*.0007,y:dy*.0005};last={x:ev.clientX,y:ev.clientY};
  });
  const pointerEnd=ev=>{
    if(!pointers.has(ev.pointerId))return;
    pointers.delete(ev.pointerId);pinch=0;
    if(moved<8&&dragStart){const f=cast(ev);selectFeature(f);}
    dragStart=null;
  };
  canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',pointerEnd);
  canvas.addEventListener('wheel',ev=>{ev.preventDefault();camera.position.z*=ev.deltaY<0?.9:1.1;clampZoom();idleUntil=performance.now()+5000;},{passive:false});

  let hoverTimer=0;
  canvas.addEventListener('pointermove',ev=>{
    if(pointers.size||performance.now()-hoverTimer<90)return;hoverTimer=performance.now();
    const f=cast(ev),tip=document.querySelector('#floatTip');if(!tip)return;
    if(!f){tip.style.display='none';canvas.style.cursor='grab';return;}
    const m=metaFor(f),p=f.properties||{};canvas.style.cursor='pointer';
    tip.innerHTML=`<b>${m?.nameRu||m?.name||p.name}</b><small>${p.continent||''} · нажми для карточки</small>`;
    const r=stage.getBoundingClientRect();tip.style.display='block';tip.style.left=Math.min(r.width-190,Math.max(8,ev.clientX-r.left+12))+'px';tip.style.top=Math.max(8,ev.clientY-r.top-48)+'px';
  });
  canvas.addEventListener('pointerleave',()=>{const t=document.querySelector('#floatTip');if(t)t.style.display='none';});

  document.addEventListener('click',ev=>{
    const c=ev.target?.closest?.('.country');
    if(c){selectedIso=c.dataset.iso||selectedIso;renderTexture();}
  },true);
  document.querySelectorAll('#regionList button').forEach(btn=>btn.addEventListener('click',()=>{region=btn.dataset.region||'World';renderTexture();}));
  document.querySelector('[data-action="open-economy"]')?.addEventListener('click',()=>setTimeout(renderTexture,0));
  document.querySelector('.tabs button')?.addEventListener('click',()=>setTimeout(renderTexture,0));
  document.querySelector('[data-action="open-countries"]')?.addEventListener('click',()=>setTimeout(renderTexture,0));
  document.querySelector('#gridToggle')?.addEventListener('change',ev=>gridGroup.visible=ev.target.checked);
  document.querySelector('#zoomIn')?.addEventListener('click',()=>{if(currentView==='3d'){camera.position.z*=.86;clampZoom();}});
  document.querySelector('#zoomOut')?.addEventListener('click',()=>{if(currentView==='3d'){camera.position.z*=1.16;clampZoom();}});
  document.querySelector('#resetView')?.addEventListener('click',()=>{if(currentView==='3d'){globe.rotation.set(0,-.55,0);camera.position.z=3.25;region='World';renderTexture();}});

  function resize(){
    if(stage.classList.contains('hidden'))return;
    const r=stage.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize',resize,{passive:true});
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  globe.rotation.set(.08,-.55,0);
  function animate(t){
    requestAnimationFrame(animate);
    if(currentView!=='3d')return;
    if(!pointers.size){globe.rotation.y+=velocity.x;globe.rotation.x+=velocity.y;velocity.x*=.94;velocity.y*=.94;if(!reduce&&t>idleUntil)globe.rotation.y+=.00035;}
    renderer.render(scene,camera);
  }
  setView('3d');resize();requestAnimationFrame(animate);
})();