(()=>{
  const tabs=[...document.querySelectorAll('.tabs button')];
  const mapBtn=tabs[0],countriesBtn=document.querySelector('[data-action="open-countries"]'),economyBtn=document.querySelector('[data-action="open-economy"]');
  const search=document.querySelector('#searchInput'),results=document.querySelector('#searchResults'),status=document.querySelector('#statusText');
  const setActive=btn=>tabs.forEach(x=>x.classList.toggle('active',x===btn));
  const clearEconomy=()=>{
    document.body.classList.remove('economy-mode');
    document.querySelectorAll('.country').forEach(el=>el.style.removeProperty('fill'));
    document.querySelectorAll('.special-territory').forEach(el=>el.style.removeProperty('fill'));
  };
  mapBtn?.addEventListener('click',()=>{setActive(mapBtn);clearEconomy();if(status)status.textContent='Интерактивная карта · перетаскивай и увеличивай';});
  countriesBtn?.addEventListener('click',()=>{
    setActive(countriesBtn);clearEconomy();
    const meta=Object.values(window.ATLAS_META||{}).filter(Boolean).sort((a,b)=>(a.nameRu||a.name||'').localeCompare(b.nameRu||b.name||'','ru'));
    if(!results)return;
    results.innerHTML='';
    meta.slice(0,80).forEach(m=>{
      const b=document.createElement('button');
      b.innerHTML=`<span>${m.nameRu||m.name}</span><small>${m.capital||m.alpha3||''}</small>`;
      b.addEventListener('click',()=>{
        if(search)search.value=m.nameRu||m.name||'';
        results.classList.remove('show');
        const el=[...document.querySelectorAll('.country')].find(x=>x.dataset.iso===m.alpha3);
        el?.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      });
      results.appendChild(b);
    });
    results.classList.add('show');
    search?.focus();
  });
  economyBtn?.addEventListener('click',()=>{
    setActive(economyBtn);document.body.classList.add('economy-mode');
    const vals=[...document.querySelectorAll('.country')].map(el=>{
      const m=(window.ATLAS_META||{})[el.dataset.iso];
      return Number(m?.gdpMdEst||0);
    }).filter(v=>v>0);
    const lo=Math.log10(Math.max(1,Math.min(...vals))),hi=Math.log10(Math.max(...vals));
    document.querySelectorAll('.country').forEach(el=>{
      const m=(window.ATLAS_META||{})[el.dataset.iso],v=Number(m?.gdpMdEst||0);
      const t=v>0?(Math.log10(v)-lo)/Math.max(.001,hi-lo):0;
      const light=24+t*38,sat=42+t*38;
      el.style.fill=`hsl(42 ${sat}% ${light}%)`;
    });
    document.querySelectorAll('.special-territory').forEach(el=>el.style.fill='hsl(42 78% 48%)');
    if(status)status.textContent='Экономика · яркость страны = оценка ВВП';
  });
})();