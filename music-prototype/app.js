const ROOT='assets/';
function status(){return `<div class="statusbar"><span>9:41</span><span class="island"></span><span class="status-icons"><i class="fa-solid fa-signal"></i><i class="fa-solid fa-wifi"></i><i class="fa-solid fa-battery-full"></i></span></div>`}
function mini(){return `<div class="mini-player glass"><img src="${ROOT}cover-17.jpg" alt="星际来信"><div><b>Starlight Letter</b><small>Nova Lin</small></div><div class="mini-actions"><i class="fa-solid fa-pause js-play"></i><i class="fa-solid fa-forward-step"></i></div></div>`}
function nav(active='home'){const items=[['home','home.html','fa-house','首页'],['discover','discover.html','fa-compass','发现'],['library','library.html','fa-layer-group','音乐库'],['profile','profile.html','fa-user-astronaut','我的']];return `<nav class="tabbar glass">${items.map(([id,url,icon,label])=>`<a class="tab ${active===id?'active':''}" href="${url}"><i class="fa-solid ${icon}"></i>${label}</a>`).join('')}</nav>`}
document.querySelectorAll('[data-status]').forEach(x=>x.outerHTML=status());
document.querySelectorAll('[data-mini]').forEach(x=>x.outerHTML=mini());
document.querySelectorAll('[data-nav]').forEach(x=>x.outerHTML=nav(x.dataset.nav));
document.addEventListener('click',e=>{const p=e.target.closest('.js-play');if(p){p.classList.toggle('fa-play');p.classList.toggle('fa-pause')}const heart=e.target.closest('.js-heart');if(heart){heart.classList.toggle('fa-regular');heart.classList.toggle('fa-solid');heart.style.color=heart.classList.contains('fa-solid')?'#ffb6d9':''}});
