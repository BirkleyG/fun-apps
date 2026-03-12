import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, provider, storage } from "./firebase";
import { APP_VERSION } from "./version";
import { SEED } from "./seed";

const APP_DOC_ID = "museum-masterpieces";
const getAppDocRef = (uid) => doc(db, "users", uid, "apps", APP_DOC_ID);
const CATALOG_DOC_REF = doc(db, "museum-masterpieces-catalog", "main");
const SUGGESTIONS_COL_REF = collection(db, "museum-masterpieces-suggestions");

// Extensive ISO numeric → country name for EVERY world country
const ISO2C={"4":"Afghanistan","8":"Albania","12":"Algeria","24":"Angola","32":"Argentina","36":"Australia","40":"Austria","50":"Bangladesh","56":"Belgium","64":"Bhutan","68":"Bolivia","76":"Brazil","100":"Bulgaria","104":"Myanmar","116":"Cambodia","120":"Cameroon","124":"Canada","152":"Chile","156":"China","170":"Colombia","188":"Costa Rica","191":"Croatia","192":"Cuba","196":"Cyprus","203":"Czech Republic","208":"Denmark","214":"Dominican Republic","218":"Ecuador","818":"Egypt","222":"El Salvador","231":"Ethiopia","246":"Finland","250":"France","266":"Gabon","276":"Germany","288":"Ghana","300":"Greece","320":"Guatemala","332":"Haiti","340":"Honduras","348":"Hungary","356":"India","360":"Indonesia","364":"Iran","368":"Iraq","372":"Ireland","376":"Israel","380":"Italy","388":"Jamaica","392":"Japan","400":"Jordan","398":"Kazakhstan","404":"Kenya","408":"North Korea","410":"South Korea","414":"Kuwait","418":"Laos","422":"Lebanon","430":"Liberia","434":"Libya","440":"Lithuania","442":"Luxembourg","450":"Madagascar","454":"Malawi","458":"Malaysia","484":"Mexico","504":"Morocco","508":"Mozambique","516":"Namibia","524":"Nepal","528":"Netherlands","554":"New Zealand","558":"Nicaragua","566":"Nigeria","578":"Norway","586":"Pakistan","591":"Panama","600":"Paraguay","604":"Peru","608":"Philippines","616":"Poland","620":"Portugal","634":"Qatar","642":"Romania","643":"Russia","646":"Rwanda","682":"Saudi Arabia","686":"Senegal","694":"Sierra Leone","706":"Somalia","710":"South Africa","724":"Spain","144":"Sri Lanka","729":"Sudan","752":"Sweden","756":"Switzerland","760":"Syria","764":"Thailand","768":"Togo","792":"Turkey","800":"Uganda","804":"Ukraine","784":"United Arab Emirates","826":"United Kingdom","840":"United States","858":"Uruguay","860":"Uzbekistan","862":"Venezuela","704":"Vietnam","887":"Yemen","894":"Zambia","716":"Zimbabwe","688":"Serbia","702":"Singapore","705":"Slovenia","336":"Vatican City"};

const cloneSeed=()=>JSON.parse(JSON.stringify(SEED));
const defaultUserProfile=()=>({name:'Art Collector',avatar:null,favPainting:null,theme:'light'});

let DB=[];
let CATALOG=[];
let LOGS={};
let USER=defaultUserProfile();
let AUTH_USER=null;
let booted=false;
let dataReady=false;
let saveTimer=null;
let ADMIN=false;
let SUGGESTIONS=[];
let MISSING_COUNTRIES=[];
let MAP_MODE='top100';
let MAP_DB=[];
let MAP_COUNTRIES=new Set();
let MAP_PIN_COUNTRIES=new Set();

document.documentElement.setAttribute('data-map-mode', MAP_MODE);

const persist=()=>{scheduleSave();};

function applyTheme(){
  document.documentElement.setAttribute('data-theme', USER.theme||'light');
  updateLegend();
  if(window._map){
    syncTiles();
    refreshMapColors();
  }
}

function setAdminEnabled(next){
  ADMIN=!!next;
  try{localStorage.setItem('museumAdmin',ADMIN?'1':'0');}catch(e){}
}

function getAdminEnabled(){
  if(ADMIN) return true;
  try{
    ADMIN=localStorage.getItem('museumAdmin')==='1';
  }catch(e){}
  return ADMIN;
}

function promptAdmin(){
  if(!AUTH_USER){alert('Sign in to access admin tools.');return;}
  const pw=prompt('Enter admin password');
  if(pw==='P4t4t0z'){
    setAdminEnabled(true);
    renderProfile();
  } else if(pw){
    alert('Incorrect password.');
  }
}

async function loadRemote(uid){
  const snap=await getDoc(getAppDocRef(uid));
  if(!snap.exists()) return null;
  return snap.data()||null;
}

async function loadCatalog(){
  const snap=await getDoc(CATALOG_DOC_REF);
  if(!snap.exists()) return null;
  return snap.data()||null;
}

async function saveCatalog(paintings, meta){
  const payload={
    paintings,
    updatedAt:serverTimestamp()
  };
  if(meta&&meta.missingCountries) payload.missingCountries=meta.missingCountries;
  await setDoc(CATALOG_DOC_REF, payload, {merge:true});
}

async function loadSuggestions(){
  const snap=await getDocs(query(SUGGESTIONS_COL_REF, orderBy("createdAt","desc")));
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}

async function saveRemote(){
  if(!AUTH_USER) return;
  await setDoc(getAppDocRef(AUTH_USER.uid),{
    logs:LOGS,
    userProfile:USER,
    updatedAt:serverTimestamp()
  },{merge:true});
}

function scheduleSave(){
  if(!AUTH_USER||!dataReady) return;
  if(saveTimer) clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>{saveRemote().catch(()=>undefined);},500);
}

function stripUserFields(p){
  const { seen, date, rating, note, ...rest } = p;
  return { ...rest };
}

function buildLogsFromLegacy(paintings){
  const logs={};
  (paintings||[]).forEach(p=>{
    if(p.seen||p.date||p.rating||p.note){
      logs[p.id]={seen:!!p.seen,date:p.date||null,rating:p.rating||null,note:p.note||null};
    }
  });
  return logs;
}

function mergeCatalogAndLogs(){
  DB=(CATALOG||[]).map(p=>{
    const log=LOGS[p.id]||{};
    return { ...p, seen:!!log.seen, date:log.date||null, rating:log.rating||null, note:log.note||null };
  });
  deriveMapData();
}

function setLog(id, patch){
  const cur=LOGS[id]||{};
  LOGS[id]={...cur,...patch};
  mergeCatalogAndLogs();
}

function setAuthOverlay(show){
  const ov=document.getElementById('auth-ov');
  if(!ov) return;
  ov.classList.toggle('auth-hidden',!show);
}

function updateUserProfileFromAuth(){
  if(!AUTH_USER) return;
  if(!USER.name||USER.name==='Art Collector'){
    const dn=AUTH_USER.displayName||AUTH_USER.email;
    if(dn) USER.name=dn;
  }
}

// ═══════════════════ THEME ═══════════════════
function toggleTheme(){
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  const next=isDark?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  USER.theme=next; persist();
  updateLegend();
  if(window._map){
    syncTiles();
    refreshMapColors();
  }
  if(document.getElementById('profile-tab').classList.contains('active'))renderProfile();
}
function tileUrls(){
  const d=document.documentElement.getAttribute('data-theme')==='dark';
  return{
    base:`https://{s}.basemaps.cartocdn.com/${d?'dark':'light'}_nolabels/{z}/{x}/{y}{r}.png`,
    labels:`https://{s}.basemaps.cartocdn.com/${d?'dark':'light'}_only_labels/{z}/{x}/{y}{r}.png`
  };
}
const STATIC_MAP_ZOOM=2.6;
function syncTiles(){
  if(!window._map) return;
  const u=tileUrls();
  if(window._baseTile){window._map.removeLayer(window._baseTile);}
  if(window._labelTile){window._map.removeLayer(window._labelTile);}
  window._baseTile=L.tileLayer(u.base,{subdomains:'abcd',maxZoom:19,keepBuffer:3});
  window._labelTile=L.tileLayer(u.labels,{subdomains:'abcd',maxZoom:19,opacity:.65,keepBuffer:3});
  if(!window._staticMap){
    window._baseTile.addTo(window._map);
    window._labelTile.addTo(window._map);
  }
}

function setStaticMap(active){
  const map=window._map; if(!map) return;
  window._staticMap=!!active;
  const el=document.getElementById('map');
  if(el) el.classList.toggle('map-static',!!active);
  if(active){
    if(window._baseTile&&map.hasLayer(window._baseTile)) map.removeLayer(window._baseTile);
    if(window._labelTile&&map.hasLayer(window._labelTile)) map.removeLayer(window._labelTile);
    map.dragging.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    map.scrollWheelZoom.enable();
    map.doubleClickZoom.enable();
    map.touchZoom.enable();
    if(map.tap) map.tap.disable();
  } else {
    if(window._baseTile&&!map.hasLayer(window._baseTile)) window._baseTile.addTo(map);
    if(window._labelTile&&!map.hasLayer(window._labelTile)) window._labelTile.addTo(map);
    map.dragging.enable();
    map.scrollWheelZoom.enable();
    map.doubleClickZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
    map.touchZoom.enable();
    if(map.tap) map.tap.enable();
  }
}

function refreshMapInteractivity(){
  const map=window._map; if(!map) return;
  setStaticMap(map.getZoom()<STATIC_MAP_ZOOM);
}
function updateLegend(){
  const d=document.documentElement.getAttribute('data-theme')==='dark';
  const isCountry=MAP_MODE==='country';
  const all=document.getElementById('leg-all');
  const some=document.getElementById('leg-some');
  const none=document.getElementById('leg-none');
  if(all)all.style.cssText=`background:${d?'#f0d060':'#6A5000'};box-shadow:0 0 5px ${d?'rgba(240,208,96,.6)':'rgba(106,80,0,.4)'}`;
  if(some)some.style.cssText=`background:${d?'#C9A84C':'#C9A84C'}`;
  if(none){
    if(isCountry){
      none.style.cssText=`background:${d?'#1d1414':'#9E8C85'};border:1px solid ${d?'#3b2a2a':'#7E6E68'}`;
    } else {
      none.style.cssText=`background:${d?'#2a2620':'#C8C3BA'};border:1px solid ${d?'#3a3526':'#A8A29A'}`;
    }
  }
}

function deriveMapData(){
  const base=DB||[];
  if(MAP_MODE==='country'){
    MAP_DB=base.filter(p=>p.topCountry);
  } else {
    MAP_DB=base.filter(p=>p.top100);
  }
  MAP_COUNTRIES=new Set(MAP_DB.map(p=>p.country));
  MAP_PIN_COUNTRIES=new Set(MAP_DB.filter(p=>p.lat&&p.lng).map(p=>p.country));
}

function updateMapToggleUI(){
  const topBtn=document.getElementById('mt-top100');
  const countryBtn=document.getElementById('mt-country');
  if(topBtn)topBtn.classList.toggle('on', MAP_MODE==='top100');
  if(countryBtn)countryBtn.classList.toggle('on', MAP_MODE==='country');
}

function setMapMode(mode){
  const next=(mode==='country')?'country':'top100';
  if(MAP_MODE===next) return;
  MAP_MODE=next;
  document.documentElement.setAttribute('data-map-mode', MAP_MODE);
  deriveMapData();
  updateMapToggleUI();
  updateLegend();
  refreshMapColors();
  refreshPanel();
  refreshActiveTabs();
}

// ═══════════════════ TABS ═══════════════════
function switchTab(n,btn){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b=>b.classList.remove('active'));
  document.getElementById(n+'-tab').classList.add('active');
  btn.classList.add('active');
  ({list:renderList,tracker:renderTracker,journal:renderJournal,profile:renderProfile}[n]||Function())();
  if(n==='map'&&window._map)setTimeout(()=>window._map.invalidateSize(),60);
}

// ═══════════════════ MAP ═══════════════════
function countryStyle(cn){
  const d=document.documentElement.getAttribute('data-theme')==='dark';
  const hasCountry=cn&&MAP_PIN_COUNTRIES.has(cn);
  if(!cn||!hasCountry){
    // Gray out countries with no paintings in this map mode
    if(MAP_MODE==='country'){
      return d
        ?{fillColor:'#1D1414',fillOpacity:.85,color:'#3B2A2A',weight:.5,opacity:.9}
        :{fillColor:'#9E8C85',fillOpacity:.65,color:'#7E6E68',weight:.5,opacity:.8};
    }
    return d
      ?{fillColor:'#2D2B3D',fillOpacity:.75,color:'#3E3B55',weight:.5,opacity:.85}
      :{fillColor:'#C8C4BB',fillOpacity:.55,color:'#B0AB9F',weight:.5,opacity:.75};
  }
  const s=MAP_DB.filter(p=>p.country===cn&&p.seen).length;
  const t=MAP_DB.filter(p=>p.country===cn).length;
  if(s===0) return d
    ?{fillColor:'#5C4820',fillOpacity:.28,color:'#C9A84C',weight:.9,opacity:.5}
    :{fillColor:'#C9A84C',fillOpacity:.22,color:'#8B6914',weight:.9,opacity:.55};
  if(s===t) return d
    ?{fillColor:'#f0d060',fillOpacity:.55,color:'#f0d060',weight:1.3,opacity:.85}
    :{fillColor:'#6A5000',fillOpacity:.62,color:'#4A3800',weight:1.3,opacity:.9};
  return d
    ?{fillColor:'#C9A84C',fillOpacity:.35,color:'#C9A84C',weight:1,opacity:.65}
    :{fillColor:'#B08A1A',fillOpacity:.38,color:'#8B6914',weight:1,opacity:.7};
}

// Fix antimeridian: polygons crossing ±180° get drawn as a line across the globe.
// This repairs each ring so consecutive longitude jumps > 180° are wrapped correctly.
function fixAntimeridian(features){
  function fixRing(ring){
    const out=[ring[0]];
    for(let i=1;i<ring.length;i++){
      let lng=ring[i][0];
      const diff=lng-out[i-1][0];
      if(diff>180) lng-=360;
      else if(diff<-180) lng+=360;
      out.push([lng,ring[i][1]]);
    }
    return out;
  }
  function fixGeom(g){
    if(!g) return g;
    if(g.type==='Polygon') return {...g,coordinates:g.coordinates.map(fixRing)};
    if(g.type==='MultiPolygon') return {...g,coordinates:g.coordinates.map(poly=>poly.map(fixRing))};
    return g;
  }
  return features.map(f=>({...f,geometry:fixGeom(f.geometry)}));
}

const MISSING_TIP_TEXT="No painting for this country. Please, suggest a piece!";
function updateMissingTooltip(layer, cn){
  if(!layer||!cn) return;
  const shouldShow=MAP_MODE==='country' && !MAP_PIN_COUNTRIES.has(cn);
  if(shouldShow){
    if(!layer._missingTip){
      layer.bindTooltip(MISSING_TIP_TEXT,{sticky:true,className:'miss-tt',direction:'center',opacity:0.95});
      layer._missingTip=true;
    }
  } else if(layer._missingTip){
    layer.unbindTooltip();
    layer._missingTip=false;
  }
}

function initMap(){
  const WORLD=L.latLngBounds(L.latLng(-85,-220),L.latLng(85,220));
  const map=L.map('map',{
    center:[20,10],zoom:2,
    minZoom:1.5,maxZoom:13,
    zoomControl:true,attributionControl:false,
    zoomSnap:0.5,
    maxBounds:WORLD,
    maxBoundsViscosity:0.8,
  });
  window._map=map;

  // Invalidate size after render so Leaflet measures the container correctly
  requestAnimationFrame(()=>{
    map.invalidateSize({animate:false,pan:false});
  });
  setTimeout(()=>map.invalidateSize({animate:false,pan:false}),200);

  window._staticMap=map.getZoom()<STATIC_MAP_ZOOM;
  syncTiles();
  map.zoomControl.setPosition('topright');
  updateLegend();
  refreshMapInteractivity();
  map.on('zoomend',refreshMapInteractivity);

  fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
    .then(r=>r.json())
    .then(world=>{
      window._clayersAll={};
      const rawFeatures=topojson.feature(world,world.objects.countries).features;
      const features=fixAntimeridian(rawFeatures); // ← kills the stripe artifacts
      features.forEach(f=>{
        const cn=ISO2C[String(f.id)]||null;
        const style=countryStyle(cn);
        const layer=L.geoJSON(f,{
          style,
          smoothFactor:1.5,
          onEachFeature:(_,l)=>{
            l.on('mouseover',()=>{
              const s2=countryStyle(cn);
              l.setStyle({...s2,fillOpacity:Math.min((s2.fillOpacity||0)+.15,.9),weight:2});
              updateMissingTooltip(l, cn);
            });
            l.on('mouseout',()=>l.setStyle(countryStyle(cn)));
            l.on('click',e=>{
              if(cn&&MAP_PIN_COUNTRIES.has(cn)){
                L.DomEvent.stop(e);openCountryPanel(cn);
              }
            });
          }
        }).addTo(map);
        if(cn) window._clayersAll[cn]=layer;
        updateMissingTooltip(layer, cn);
      });
      addMarkers();
    }).catch(err=>{console.warn('Map data failed:',err);addMarkers();});
  map.on('click',()=>closePanel());
}

function refreshMapColors(){
  if(!window._clayersAll)return;
  Object.entries(window._clayersAll).forEach(([cn,layer])=>{
    layer.setStyle(countryStyle(cn));
    updateMissingTooltip(layer, cn);
  });
  addMarkers();
}

function addMarkers(){
  const map=window._map; if(!map)return;
  if(window._mms)window._mms.forEach(m=>m.remove());
  window._mms=[];
  const ms={};
  MAP_DB.forEach(p=>{
    if(!p.lat||!p.lng)return;
    const k=p.museum+'||'+p.lat+'||'+p.lng;
    if(!ms[k])ms[k]={name:p.museum,city:p.city,country:p.country,lat:p.lat,lng:p.lng,ps:[]};
    ms[k].ps.push(p);
  });
  Object.values(ms).forEach(m=>{
    const s=m.ps.filter(p=>p.seen).length,t=m.ps.length;
    const cls=s===0?'none':s===t?'all':'partial';
    const icon=L.divIcon({className:'',html:'<div class="mus-pin '+cls+'"></div>',iconSize:[11,11],iconAnchor:[5,5]});
    window._mms.push(L.marker([m.lat,m.lng],{icon,zIndexOffset:300}).addTo(map)
      .on('click',e=>{L.DomEvent.stop(e);openMuseumPanel(m.name,m.country);}));
  });
}

// ═══════════════════ PANELS ═══════════════════
let _pd=null;
function piH(p){return'<div class="pi" onclick="openDetail('+p.id+')"><div class="pi-d '+(p.seen?'y':'n')+'"></div><div class="pi-i"><div class="pi-nm">'+p.name+'</div><div class="pi-ar">'+p.artist+'</div></div><div class="pi-yr">'+p.year+'</div></div>';}

function openCountryPanel(cn){
  _pd={type:'c',cn};
  const ps=MAP_DB.filter(p=>p.country===cn);if(!ps.length){closePanel();return;}
  const s=ps.filter(p=>p.seen).length;
  document.getElementById('p-head').innerHTML='<div class="p-eye">Country</div><div class="p-tit">'+cn+'</div><div class="p-prog"><div class="p-pt"><div class="p-pf" style="width:'+Math.round(s/ps.length*100)+'%"></div></div><div class="p-ptxt">'+s+'/'+ps.length+'</div></div>';
  const byM={};ps.forEach(p=>{if(!byM[p.museum])byM[p.museum]=[];byM[p.museum].push(p);});
  document.getElementById('p-body').innerHTML=Object.entries(byM).map(([m,mps])=>{const ms=mps.filter(p=>p.seen).length;return'<div class="mg-h"><div><div class="mg-nm">'+m+'</div><div class="mg-sub">'+mps[0].city+'</div></div><div class="mg-badge">'+ms+'/'+mps.length+'</div></div>'+mps.map(piH).join('');}).join('');
  document.getElementById('panel-ov').classList.add('open');
}

function openMuseumPanel(name,cn){
  _pd={type:'m',name,cn};
  const ps=MAP_DB.filter(p=>p.museum===name);if(!ps.length){closePanel();return;}
  const s=ps.filter(p=>p.seen).length;
  document.getElementById('p-head').innerHTML='<div class="p-eye">'+ps[0].city+', '+cn+'</div><div class="p-tit">'+name+'</div><div class="p-prog"><div class="p-pt"><div class="p-pf" style="width:'+Math.round(s/ps.length*100)+'%"></div></div><div class="p-ptxt">'+s+'/'+ps.length+'</div></div>';
  document.getElementById('p-body').innerHTML='<div style="padding:6px 0">'+ps.map(piH).join('')+'</div>';
  document.getElementById('panel-ov').classList.add('open');
}

function closePanel(){document.getElementById('panel-ov').classList.remove('open');_pd=null;}
function refreshPanel(){if(!_pd)return;_pd.type==='c'?openCountryPanel(_pd.cn):openMuseumPanel(_pd.name,_pd.cn);}

// ═══════════════════ DETAIL ═══════════════════
let _did=null;
function sanitizeFileName(name){
  return (name||'photo').replace(/[^\w.-]+/g,'_');
}

function updateCatalogPainting(id, patch){
  const idx=CATALOG.findIndex(p=>p.id===id);
  if(idx<0) return false;
  CATALOG[idx]={...CATALOG[idx],...patch};
  mergeCatalogAndLogs();
  return true;
}

function isImageFile(file){
  if(!file) return false;
  if(file.type) return file.type.startsWith('image/');
  return /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(file.name||'');
}

async function uploadCatalogPhotos(paintingId, files){
  if(!AUTH_USER||!getAdminEnabled()) throw new Error('Admin login required.');
  const list=[];
  const items=Array.from(files||[]).filter(isImageFile);
  if(!items.length) throw new Error('Please choose a valid image file.');
  for(const file of items){
    const safeName=sanitizeFileName(file.name);
    const path='museum-masterpieces/catalog/'+paintingId+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'-'+safeName;
    const fileRef=ref(storage,path);
    await uploadBytes(fileRef,file,{contentType:file.type||undefined});
    const url=await getDownloadURL(fileRef);
    list.push({url,name:file.name||'photo',size:file.size||null,type:file.type||null});
  }
  return list;
}

async function addCatalogPhotos(id, files, opts){
  const p=CATALOG.find(x=>x.id===id);if(!p)return;
  const fromAdmin=!!(opts&&opts.fromAdmin);
  try{
    const next=await uploadCatalogPhotos(id, files);
    if(!next.length) return;
    const photos=[...(p.photos||[]),...next];
    updateCatalogPainting(id,{photos});
    await saveCatalog(CATALOG);
    if(fromAdmin){
      renderAdminPhotos();
    } else {
      openDetail(id);
    }
  }catch(err){
    console.warn('Photo upload failed:', err);
    alert('Upload failed. '+(err?.message||'Please check your sign-in and storage settings.'));
  }
}

function removePaintingPhoto(id, idx){
  if(!getAdminEnabled()) return;
  const p=CATALOG.find(x=>x.id===id);if(!p||!p.photos||!p.photos.length)return;
  if(!confirm('Remove this photo?'))return;
  const photos=p.photos.filter((_,i)=>i!==idx);
  updateCatalogPainting(id,{photos});
  saveCatalog(CATALOG).catch(()=>undefined);
  openDetail(id);
}

function handlePhotoInput(inp,id){
  const files=inp?.files; if(!files||!files.length)return;
  addCatalogPhotos(id, files);
  inp.value='';
}
function starsH(n,sz){return Array.from({length:5}).map((_,i)=>'<span style="font-size:'+(sz||13)+'px;color:'+(i<n?'var(--gold)':'var(--border)')+'">&#9733;</span>').join('');}

function openDetail(id){
  _did=id;
  const p=DB.find(x=>x.id===id);if(!p)return;
  document.getElementById('det-crumb').textContent=p.museum+' · '+p.country;
  const saveArea=p.seen
    ?'<div class="save-area"><div class="save-seen"><div class="seen-top-row"><span class="seen-chk">&#10003;</span><div class="seen-inf"><div class="seen-dt">Seen on '+(p.date||'—')+'</div></div><button class="seen-edit" onclick="openReview('+p.id+',true)">Edit Review</button></div><div class="seen-rev">'+(p.rating?'<div style="display:flex;gap:3px;margin-bottom:10px">'+starsH(p.rating,16)+'</div>':'')+(p.note?'<div class="seen-note-txt">&ldquo;'+p.note+'&rdquo;</div>':'<div class="seen-no-note">No notes yet — tap Edit Review to add some.</div>')+'</div></div><div class="unsee-lnk" onclick="unseeP('+p.id+')">Remove from seen list</div></div>'
    :'<div class="save-area"><div class="save-unseen"><div class="save-unseen-lbl">Have you seen this painting in person?</div><button class="big-save-btn" onclick="openReview('+p.id+',false)">&#10003; &nbsp;Mark as Seen &amp; Write Review</button></div></div>';
  const photos=(p.photos||[]);
  const canManagePhotos=!!AUTH_USER&&getAdminEnabled();
  const photoGrid=photos.length
    ?'<div class="det-photo-grid">'+photos.map((ph,i)=>'<div class="det-photo"><a href="'+ph.url+'" target="_blank" rel="noreferrer"><img src="'+ph.url+'" alt="painting photo"></a>'+(canManagePhotos?'<button class="det-photo-del" onclick="removePaintingPhoto('+p.id+','+i+')">×</button>':'')+'</div>').join('')+'</div>'
    :'<div class="det-photo-empty">No photos yet.</div>';
  const photoActions=canManagePhotos
    ?'<div class="det-photo-actions"><button class="det-photo-btn" onclick="document.getElementById(\'det-photo-inp\').click()">Add Photo</button><input type="file" id="det-photo-inp" accept="image/*" capture="environment" multiple onchange="handlePhotoInput(this,'+p.id+')" style="display:none"></div>'
    :'';
  const photoArea=
    '<div class="det-photos">'+
      '<div class="det-photo-hdr">Painting Photos</div>'+
      photoGrid+
      photoActions+
    '</div>';
  document.getElementById('det-content').innerHTML='<div class="det-canvas"><div class="det-canvas-ico">&#128444;</div></div><div class="det-body"><div class="det-yr">'+p.year+' &middot; '+p.type+'</div><div class="det-nm">'+p.name+'</div><div class="det-ar">'+p.artist+'</div><div class="chips"><span class="chip">'+p.movement+'</span><span class="chip">'+p.era+'</span><span class="chip">'+p.country+'</span></div><div class="det-quote">'+p.importance+'</div><div class="det-loc"><span style="font-size:13px">&#128205;</span><div class="det-loc-t">'+p.museum+' &middot; '+p.city+', '+p.country+'</div></div>'+photoArea+saveArea+'</div>';
  document.getElementById('det-ov').classList.add('open');
}

function closeDetail(){document.getElementById('det-ov').classList.remove('open');}
function unseeP(id){
  if(!confirm('Remove from seen list?'))return;
  setLog(id,{seen:false,date:null,rating:null,note:null});
  persist();openDetail(id);refreshMapColors();refreshPanel();
  ['tracker','profile','journal'].forEach(t=>{if(document.getElementById(t+'-tab').classList.contains('active'))({tracker:renderTracker,profile:renderProfile,journal:renderJournal}[t])();});
}

// ═══════════════════ REVIEW MODAL ═══════════════════
let _rvId=null,_rvS=0;
function openReview(id,isEdit){
  _rvId=id;_rvS=0;
  const p=DB.find(x=>x.id===id);
  document.getElementById('rv-nm').textContent=p.name;
  document.getElementById('rv-ar').textContent=p.artist;
  document.getElementById('rv-note').value=(isEdit&&p.note)?p.note:'';
  document.getElementById('rv-date').value=(isEdit&&p.date)?p.date:new Date().toISOString().split('T')[0];
  setS((isEdit&&p.rating)?p.rating:0);
  document.getElementById('rv-modal').classList.add('open');
}
function setS(n){_rvS=n;document.querySelectorAll('.rv-star').forEach((s,i)=>s.classList.toggle('lit',i<n));}
function saveReview(){
  const rating=_rvS||null;
  const note=document.getElementById('rv-note').value.trim()||null;
  const date=document.getElementById('rv-date').value||new Date().toISOString().split('T')[0];
  setLog(_rvId,{seen:true,rating,note,date});
  persist();cancelReview();openDetail(_rvId);refreshMapColors();refreshPanel();
  ['tracker','profile','journal'].forEach(t=>{if(document.getElementById(t+'-tab').classList.contains('active'))({tracker:renderTracker,profile:renderProfile,journal:renderJournal}[t])();});
}
function cancelReview(){document.getElementById('rv-modal').classList.remove('open');}

// ═══════════════════ SUGGEST MODAL ═══════════════════
let _sugPath=null,_sugEditId=null;

function openSugModal(){
  _sugPath=null;_sugEditId=null;
  document.getElementById('sp-edit').classList.remove('active');
  document.getElementById('sp-new').classList.remove('active');
  document.getElementById('sug-form-area').classList.remove('visible');
  document.getElementById('sug-q').value='';
  document.getElementById('sug-results-list').style.display='none';
  document.getElementById('sug-results-list').innerHTML='';
  document.getElementById('sug-selected').style.display='none';
  clearSugFields();
  document.getElementById('sug-modal').classList.add('open');
}
function closeSugModal(){document.getElementById('sug-modal').classList.remove('open');}

function setSugPath(path){
  _sugPath=path;_sugEditId=null;
  document.getElementById('sp-edit').classList.toggle('active',path==='edit');
  document.getElementById('sp-new').classList.toggle('active',path==='new');
  document.getElementById('sug-form-area').classList.add('visible');
  const sa=document.getElementById('sug-search-area');
  if(path==='edit'){
    document.getElementById('sug-form-title').textContent='Which painting needs editing?';
    sa.style.display='block';
    document.getElementById('sug-save-btn').textContent='Save Edit';
    clearSugFields();
    document.getElementById('sug-fields').style.opacity='.35';
    document.getElementById('sug-fields').style.pointerEvents='none';
    document.getElementById('sug-q').value='';
    document.getElementById('sug-results-list').style.display='none';
    document.getElementById('sug-selected').style.display='none';
  } else {
    document.getElementById('sug-form-title').textContent='Add a New Painting';
    sa.style.display='none';
    document.getElementById('sug-save-btn').textContent='Add to Collection';
    clearSugFields();
    document.getElementById('sug-fields').style.opacity='1';
    document.getElementById('sug-fields').style.pointerEvents='auto';
  }
}

function doSugSearch(q){
  const rl=document.getElementById('sug-results-list');
  if(!q.trim()){rl.style.display='none';rl.innerHTML='';return;}
  const results=MAP_DB.filter(p=>p.name.toLowerCase().includes(q.toLowerCase())||p.artist.toLowerCase().includes(q.toLowerCase())).slice(0,8);
  if(!results.length){rl.style.display='none';return;}
  rl.innerHTML=results.map(p=>'<div class="sug-result-item" onclick="selectSugPainting('+p.id+')"><div class="sug-result-nm">'+p.name+'</div><div class="sug-result-sub">'+p.artist+' &middot; '+p.museum+'</div></div>').join('');
  rl.style.display='block';
}

function selectSugPainting(id){
  _sugEditId=id;
  const p=DB.find(x=>x.id===id);
  document.getElementById('sug-results-list').style.display='none';
  document.getElementById('sug-selected').style.display='flex';
  document.getElementById('sug-sel-nm').textContent=p.name+' — '+p.artist;
  // Fill fields with existing data
  document.getElementById('sf-name').value=p.name;
  document.getElementById('sf-artist').value=p.artist;
  document.getElementById('sf-year').value=p.year||'';
  setSelectVal('sf-type',p.type);
  document.getElementById('sf-museum').value=p.museum;
  document.getElementById('sf-city').value=p.city;
  document.getElementById('sf-country').value=p.country;
  document.getElementById('sf-lat').value=p.lat||'';
  document.getElementById('sf-lng').value=p.lng||'';
  document.getElementById('sf-movement').value=p.movement||'';
  setSelectVal('sf-era',p.era);
  setSelectVal('sf-region',p.region);
  document.getElementById('sf-importance').value=p.importance||'';
  document.getElementById('sug-fields').style.opacity='1';
  document.getElementById('sug-fields').style.pointerEvents='auto';
}

function clearSugSel(){
  _sugEditId=null;
  document.getElementById('sug-selected').style.display='none';
  document.getElementById('sug-q').value='';
  clearSugFields();
  document.getElementById('sug-fields').style.opacity='.35';
  document.getElementById('sug-fields').style.pointerEvents='none';
}

function clearSugFields(){
  ['sf-name','sf-artist','sf-year','sf-museum','sf-city','sf-country','sf-lat','sf-lng','sf-movement','sf-importance'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
}

function setSelectVal(id,val){const el=document.getElementById(id);if(!el)return;for(let i=0;i<el.options.length;i++){if(el.options[i].value===val||el.options[i].text===val){el.selectedIndex=i;break;}}}

function saveSuggestion(){
  const name=document.getElementById('sf-name').value.trim();
  const artist=document.getElementById('sf-artist').value.trim();
  const museum=document.getElementById('sf-museum').value.trim();
  const city=document.getElementById('sf-city').value.trim();
  const country=document.getElementById('sf-country').value.trim();
  if(!name||!artist||!museum||!city||!country){alert('Please fill in the required fields (*).');return;}
  const lat=parseFloat(document.getElementById('sf-lat').value)||null;
  const lng=parseFloat(document.getElementById('sf-lng').value)||null;
  const payload={
    type:(_sugPath==='edit'&&_sugEditId)?'edit':'new',
    paintingId:(_sugPath==='edit'&&_sugEditId)?_sugEditId:null,
    data:{
      name,artist,year:parseInt(document.getElementById('sf-year').value)||null,
      type:document.getElementById('sf-type').value,
      museum,city,country,
      region:document.getElementById('sf-region').value,
      movement:document.getElementById('sf-movement').value||'Unknown',
      era:document.getElementById('sf-era').value,
      lat,lng,
      importance:document.getElementById('sf-importance').value.trim()||name+' by '+artist+'.'
    },
    status:'new',
    createdAt:serverTimestamp(),
    createdBy:{
      uid:AUTH_USER?AUTH_USER.uid:null,
      name:AUTH_USER?(AUTH_USER.displayName||AUTH_USER.email||'User'):null,
      email:AUTH_USER?AUTH_USER.email:null
    }
  };
  const refDoc=doc(SUGGESTIONS_COL_REF);
  setDoc(refDoc,payload).then(()=>{
    closeSugModal();
    alert('Suggestion sent to admin.');
  }).catch(()=>alert('Unable to send suggestion right now.'));
}

// ═══════════════════ ADMIN CONSOLE ═══════════════════
let adminPhotoQuery='';
const SUG_FIELDS=[
  {key:'name',label:'Name'},
  {key:'artist',label:'Artist'},
  {key:'year',label:'Year'},
  {key:'type',label:'Medium'},
  {key:'museum',label:'Museum'},
  {key:'city',label:'City'},
  {key:'country',label:'Country'},
  {key:'region',label:'Region'},
  {key:'movement',label:'Movement'},
  {key:'era',label:'Era'},
  {key:'lat',label:'Latitude'},
  {key:'lng',label:'Longitude'},
  {key:'importance',label:'Importance'}
];

function formatVal(v){
  if(v===undefined||v===null||v==='') return '—';
  return v;
}

function formatTime(ts){
  if(!ts) return '—';
  const d=ts.toDate?ts.toDate():ts.seconds?new Date(ts.seconds*1000):new Date(ts);
  return Number.isNaN(d?.getTime())?'—':d.toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});
}

function toNum(v){
  if(v===undefined||v===null||v==='') return null;
  const n=Number(v);
  return Number.isFinite(n)?n:null;
}

function normalizeSuggestionData(data){
  const d=data||{};
  return {
    name:(d.name||'').trim(),
    artist:(d.artist||'').trim(),
    year:toNum(d.year),
    type:(d.type||'').trim(),
    museum:(d.museum||'').trim(),
    city:(d.city||'').trim(),
    country:(d.country||'').trim(),
    region:(d.region||'').trim(),
    movement:(d.movement||'').trim(),
    era:(d.era||'').trim(),
    lat:toNum(d.lat),
    lng:toNum(d.lng),
    importance:(d.importance||'').trim()
  };
}

function parseCSV(text){
  const rows=[];
  let row=[],field='',inQuotes=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(inQuotes){
      if(ch==='"'){
        if(text[i+1]==='"'){field+='"';i++;}
        else inQuotes=false;
      } else {
        field+=ch;
      }
    } else {
      if(ch==='"') inQuotes=true;
      else if(ch===','){row.push(field);field='';}
      else if(ch==='\r'){}
      else if(ch==='\n'){row.push(field);rows.push(row);row=[];field='';}
      else field+=ch;
    }
  }
  if(field.length||row.length){row.push(field);rows.push(row);}
  return rows;
}

function normalizeCsvCatalog(rows){
  if(!rows.length) return {paintings:[],missingCountries:[]};
  const header=rows[0].map(h=>(h||'').replace(/^\uFEFF/,'').trim());
  const idx={};
  header.forEach((h,i)=>{idx[h]=i;});
  const get=(r,name)=>idx[name]!==undefined?(r[idx[name]]||''):'';
  const paintings=[];
  const missing=new Set();
  let id=1;
  for(let i=1;i<rows.length;i++){
    const r=rows[i]; if(!r||!r.length) continue;
    const name=(get(r,'Painting Name')||'').trim();
    const country=(get(r,'Country')||'').trim();
    if(!name){
      if(country) missing.add(country);
      continue;
    }
    const latVal=parseFloat(get(r,'Latitude'));
    const lngVal=parseFloat(get(r,'Longitude'));
    const artist=(get(r,'Artist')||'').trim();
    const yearStr=(get(r,'Year')||'').trim();
    const importance=(get(r,'Short Description')||'').trim()||(`${name} by ${artist||'Unknown'}.`);
    paintings.push({
      id:id++,
      name,
      artist,
      year:yearStr||null,
      type:(get(r,'Medium')||'').trim()||'Other',
      museum:(get(r,'Museum')||'').trim(),
      city:(get(r,'City')||'').trim(),
      country,
      region:(get(r,'Region')||'').trim(),
      movement:(get(r,'Art Movement')||'').trim()||'Unknown',
      era:(get(r,'Era')||'').trim()||'Unknown',
      lat:Number.isFinite(latVal)?latVal:null,
      lng:Number.isFinite(lngVal)?lngVal:null,
      importance,
      top100:(get(r,'Is100')||'').trim().toUpperCase()==='T',
      topCountry:(get(r,'IsBest')||'').trim().toUpperCase()==='T'
    });
  }
  return {paintings,missingCountries:[...missing]};
}

async function importCatalogCsv(){
  if(!AUTH_USER||!getAdminEnabled()){alert('Admin login required.');return;}
  const inp=document.getElementById('admin-csv');
  const file=inp&&inp.files&&inp.files[0]; if(!file){alert('Choose a CSV file first.');return;}
  const text=await file.text();
  const rows=parseCSV(text);
  if(!rows.length){alert('CSV appears empty.');return;}
  const {paintings,missingCountries}=normalizeCsvCatalog(rows);
  const top100Count=paintings.filter(p=>p.top100).length;
  const topCountryCount=paintings.filter(p=>p.topCountry).length;
  if(!confirm(`Import ${paintings.length} paintings? Top 100: ${top100Count}, Top Country: ${topCountryCount}, Missing Countries: ${missingCountries.length}. This will overwrite the catalog.`)) return;
  await saveCatalog(paintings,{missingCountries});
  CATALOG=paintings;
  MISSING_COUNTRIES=missingCountries;
  const valid=new Set(paintings.map(p=>String(p.id)));
  Object.keys(LOGS||{}).forEach(id=>{if(!valid.has(String(id))) delete LOGS[id];});
  mergeCatalogAndLogs();
  persist();
  refreshMapColors();
  refreshPanel();
  refreshActiveTabs();
  if(getAdminEnabled()) renderAdminPhotos();
  if(inp) inp.value='';
  alert('Catalog imported.');
}

function getNextCatalogId(){
  const maxId=CATALOG.reduce((m,p)=>Math.max(m,Number(p.id)||0),0);
  return maxId+1;
}

function setAdminPhotoQuery(q){
  adminPhotoQuery=(q||'').trim().toLowerCase();
  renderAdminPhotos();
}

function openAdmin(){
  if(!AUTH_USER){alert('Sign in to access admin tools.');return;}
  if(!getAdminEnabled()){alert('Admin mode is not enabled.');return;}
  const ov=document.getElementById('admin-ov');
  if(ov) ov.classList.add('open');
  refreshAdmin();
}

function closeAdmin(){
  const ov=document.getElementById('admin-ov');
  if(ov) ov.classList.remove('open');
}

function exitAdmin(){
  setAdminEnabled(false);
  closeAdmin();
  renderProfile();
}

function refreshAdmin(){
  if(!getAdminEnabled()) return;
  loadSuggestions().then(list=>{
    SUGGESTIONS=list;
    renderAdminSuggestions();
  }).catch(()=>renderAdminSuggestions());
  renderAdminPhotos();
}

function renderAdminSuggestions(){
  const wrap=document.getElementById('admin-suggestions');
  if(!wrap) return;
  if(!SUGGESTIONS.length){



  wrap.innerHTML='<div class="admin-empty">No suggestions yet.</div>';
    return;
  }



  wrap.innerHTML=SUGGESTIONS.map(s=>{
    const data=normalizeSuggestionData(s.data);
    const created=formatTime(s.createdAt);
    const status=(s.status||'new').toUpperCase();
    const isNew=status==='NEW';
    const by=s.createdBy?.name||s.createdBy?.email||'Unknown';
    let body='';
    if(s.type==='edit' && s.paintingId){
      const existing=CATALOG.find(p=>p.id===s.paintingId);
      if(existing){
        const diffs=SUG_FIELDS.map(f=>{
          const oldVal=formatVal(existing[f.key]);
          const newVal=formatVal(data[f.key]);
          if(String(oldVal)===String(newVal)) return null;
          return '<div class="admin-diff-row"><div class="admin-diff-key">'+f.label+'</div><div class="admin-diff-old">Old: '+oldVal+'</div><div class="admin-diff-new">New: '+newVal+'</div></div>';
        }).filter(Boolean);
        body=diffs.length?diffs.join(''):'<div class="admin-empty">No visible changes.</div>';
      } else {
        body='<div class="admin-empty">Painting #'+s.paintingId+' not found in catalog.</div>';
      }
    } else {
      body=SUG_FIELDS.map(f=>'<div class="admin-diff-row"><div class="admin-diff-key">'+f.label+'</div><div class="admin-diff-new">'+formatVal(data[f.key])+'</div></div>').join('');
    }
    const actions=isNew
      ?'<div class="admin-actions"><button class="btn-gold" onclick="applySuggestion(\''+s.id+'\')">Apply</button><button class="btn-ghost" onclick="rejectSuggestion(\''+s.id+'\')">Reject</button></div>'
      :'<div class="admin-status-line">Status: <span class="admin-status '+status.toLowerCase()+'">'+status+'</span></div>';
    return '<div class="admin-sug-card '+(isNew?'new':'')+'">'
      +'<div class="admin-sug-head"><div><div class="admin-sug-title">'+(s.type==='edit'?'Edit Suggestion':'New Painting')+'</div><div class="admin-sug-meta">From '+by+' • '+created+'</div></div><span class="admin-status '+status.toLowerCase()+'">'+status+'</span></div>'
      +'<div class="admin-sug-body">'+body+'</div>'
      +actions
      +'</div>';
  }).join('');
}

function renderAdminPhotos(){
  const wrap=document.getElementById('admin-photo-list');
  if(!wrap) return;
  if(!CATALOG.length){
    wrap.innerHTML='<div class="admin-empty">Catalog is empty.</div>';
    return;
  }
  const list=CATALOG.filter(p=>{
    if(!adminPhotoQuery) return true;
    const q=adminPhotoQuery;
    return (p.name||'').toLowerCase().includes(q)
      || (p.artist||'').toLowerCase().includes(q)
      || (p.museum||'').toLowerCase().includes(q)
      || (p.country||'').toLowerCase().includes(q);
  });
  if(!list.length){
    wrap.innerHTML='<div class="admin-empty">No paintings match that search.</div>';
    return;
  }
  wrap.innerHTML=list.map(p=>{
    const count=(p.photos||[]).length;
    const photoStrip=count
      ?'<div class="admin-photo-strip">'+(p.photos||[]).map((ph,i)=>'<div class="admin-photo-thumb"><img src="'+ph.url+'" alt="photo"><button class="admin-photo-del" onclick="adminRemovePhoto('+p.id+','+i+')">&times;</button></div>').join('')+'</div>'
      :'<div class="admin-empty">No photos yet.</div>';
    return '<div class="admin-photo-row">'
      +'<div class="admin-photo-info"><div class="admin-photo-name">'+p.name+'</div><div class="admin-photo-sub">'+p.artist+' &middot; '+p.museum+'</div><div class="admin-photo-count">'+count+' photo'+(count===1?'':'s')+'</div>'+photoStrip+'</div>'
      +'<div class="admin-photo-actions"><button class="btn-ghost" onclick="document.getElementById(\'admin-photo-inp-'+p.id+'\').click()">Upload</button><input type="file" id="admin-photo-inp-'+p.id+'" accept="image/*" multiple onchange="handleAdminPhotoInput(this,'+p.id+')" style="display:none"></div>'
      +'</div>';
  }).join('');
}

function adminRemovePhoto(id, idx){
  if(!AUTH_USER||!getAdminEnabled()) return;
  const p=CATALOG.find(x=>x.id===id);if(!p||!p.photos||!p.photos.length)return;
  if(!confirm('Remove this photo?'))return;
  const photos=p.photos.filter((_,i)=>i!==idx);
  updateCatalogPainting(id,{photos});
  saveCatalog(CATALOG).catch(()=>undefined);
  renderAdminPhotos();
  if(_did===id) openDetail(id);
}
async function applySuggestion(id){
  if(!AUTH_USER||!getAdminEnabled()) return;
  const s=SUGGESTIONS.find(x=>x.id===id);
  if(!s) return;
  if(!confirm('Apply this suggestion to the catalog?'))return;
  let next=[...CATALOG];
  if(s.type==='new'){
    const nextId=getNextCatalogId();
    const data=normalizeSuggestionData(s.data);
    next=[...next,{...data,id:nextId,photos:[]}].sort((a,b)=>a.id-b.id);
  } else if(s.type==='edit' && s.paintingId){
    const idx=next.findIndex(p=>p.id===s.paintingId);
    if(idx<0){alert('Painting not found in catalog.');return;}
    const data=normalizeSuggestionData(s.data);
    next[idx]={...next[idx],...data,id:next[idx].id};
  }
  await saveCatalog(next);
  CATALOG=next;
  mergeCatalogAndLogs();
  refreshMapColors();refreshPanel();refreshActiveTabs();
  await updateDoc(doc(SUGGESTIONS_COL_REF,id),{
    status:'applied',
    resolvedAt:serverTimestamp(),
    resolvedBy:{
      uid:AUTH_USER?AUTH_USER.uid:null,
      name:AUTH_USER?(AUTH_USER.displayName||AUTH_USER.email||'Admin'):null,
      email:AUTH_USER?AUTH_USER.email:null
    }
  });
  refreshAdmin();
}

async function rejectSuggestion(id){
  if(!AUTH_USER||!getAdminEnabled()) return;
  if(!confirm('Reject this suggestion?'))return;
  await updateDoc(doc(SUGGESTIONS_COL_REF,id),{
    status:'rejected',
    resolvedAt:serverTimestamp(),
    resolvedBy:{
      uid:AUTH_USER?AUTH_USER.uid:null,
      name:AUTH_USER?(AUTH_USER.displayName||AUTH_USER.email||'Admin'):null,
      email:AUTH_USER?AUTH_USER.email:null
    }
  });
  refreshAdmin();
}

function handleAdminPhotoInput(inp,id){
  const files=inp?.files; if(!files||!files.length)return;
  addCatalogPhotos(id, files, {fromAdmin:true});
  inp.value='';
}

// ═══════════════════ LIST ═══════════════════
let lF='All',lC='All',lQ='';
function renderList(){
  const src=MAP_DB;
  const cs=['All',...new Set(src.map(p=>p.country))];
  document.getElementById('fchips').innerHTML=
    [{k:'All',l:'All'},{k:'Seen',l:'Seen'},{k:'Unseen',l:'Not Seen'}].map(f=>'<button class="fc '+(lF===f.k?'on':'')+'" onclick="setLF(\''+f.k+'\')">'+f.l+'</button>').join('')
    +'<div style="width:1px;background:var(--border);margin:0 3px;flex-shrink:0"></div>'
    +cs.slice(0,9).map(c=>'<button class="fc '+(lC===c?'on':'')+'" onclick="setLC(\''+c+'\')">'+c+'</button>').join('');
  renderLI();
}
function setLF(f){lF=f;renderList();}
function setLC(c){lC=c;renderList();}
function renderLI(){
  const q=lQ.toLowerCase();
  const src=MAP_DB;
  const fil=src.filter(p=>{
    const ms=lF==='Seen'?p.seen:lF==='Unseen'?!p.seen:true;
    const mc=lC==='All'||p.country===lC;
    const mq=!q||p.name.toLowerCase().includes(q)||p.artist.toLowerCase().includes(q)||p.museum.toLowerCase().includes(q)||p.country.toLowerCase().includes(q);
    return ms&&mc&&mq;
  });
  document.getElementById('lcnt').textContent=fil.length+' works';
  document.getElementById('lscr').innerHTML=
    '<div class="sug-list-btn" onclick="openSugModal()"><div class="sug-list-icon">&#9998;</div><div class="sug-list-lbl">Suggest an Edit or Add a Painting</div></div>'
    +fil.map((p,i)=>'<div class="lpr" onclick="openDetail('+p.id+')"><div class="lpr-n">'+String(i+1).padStart(2,'0')+'</div><div class="lpr-d '+(p.seen?'y':'n')+'"></div><div class="lpr-i"><div class="lpr-nm">'+p.name+'</div><div class="lpr-sb">'+p.artist+' &middot; '+p.museum+' &middot; '+p.country+'</div></div><div class="lpr-ch">&#8250;</div></div>').join('');
}

// ═══════════════════ TRACKER ═══════════════════
let _trSec={region:true,country:false,style:false,era:false,medium:false,visits:false,rankings:false};
function toggleTrSec(id){
  _trSec[id]=!_trSec[id];
  const body=document.getElementById('trs-'+id);
  const chev=document.getElementById('trc-'+id);
  if(body){body.style.maxHeight=_trSec[id]?body.scrollHeight+'px':'0';}
  if(chev){chev.style.transform=_trSec[id]?'rotate(0deg)':'rotate(180deg)';}
}
function gS(k){
  const src=MAP_DB;
  return[...new Set(src.map(p=>p[k]))].map(v=>({name:v,total:src.filter(p=>p[k]===v).length,seen:src.filter(p=>p[k]===v&&p.seen).length})).sort((a,b)=>b.seen-a.seen||b.total-a.total);
}

let _achOpen=true;
function toggleAch(){
  _achOpen=!_achOpen;
  const body=document.getElementById('ach-body');
  const chev=document.getElementById('ach-chev');
  if(body){body.style.maxHeight=_achOpen?body.scrollHeight+'px':'0';body.style.overflow=_achOpen?'visible':'hidden';}
  if(chev){chev.style.transform=_achOpen?'rotate(0deg)':'rotate(180deg)';}
}

function renderTracker(){
  const src=MAP_DB;
  const seen=src.filter(p=>p.seen).length,total=src.length;
  const seenPs=src.filter(p=>p.seen);
  const mus=[...new Set(seenPs.map(p=>p.museum))].length;
  const cou=[...new Set(seenPs.map(p=>p.country))].length;
  const rated=src.filter(p=>p.seen&&p.rating);
  const avgR=rated.length?(rated.reduce((a,p)=>a+p.rating,0)/rated.length).toFixed(1):null;
  const dates=src.filter(p=>p.seen&&p.date).map(p=>p.date).sort();
  let vrH='<div style="padding:12px 20px;font-family:\'DM Mono\',monospace;font-size:10px;color:var(--faint)">See more paintings to unlock visit stats.</div>';
  if(dates.length>=2){
    const span=Math.max(1,Math.round((new Date(dates[dates.length-1])-new Date(dates[0]))/86400000));
    vrH='<div class="kv"><div><div class="kv-k">First Visit</div></div><div class="kv-v">'+dates[0]+'</div></div>'
      +'<div class="kv"><div><div class="kv-k">Most Recent</div></div><div class="kv-v">'+dates[dates.length-1]+'</div></div>'
      +'<div class="kv"><div><div class="kv-k">Pace</div><div class="kv-sub">Per month avg</div></div><div class="kv-v">'+(seen/span*30).toFixed(1)+'/mo</div></div>'
      +'<div class="kv"><div><div class="kv-k">Span</div></div><div class="kv-v">'+span+' days</div></div>'
      +(avgR?'<div class="kv"><div><div class="kv-k">Avg Rating</div></div><div class="kv-v">'+avgR+'&#9733;</div></div>':'');
  }
  const topR=src.filter(p=>p.seen&&p.rating).sort((a,b)=>b.rating-a.rating||a.name.localeCompare(b.name));
  const rkH=topR.length?topR.slice(0,10).map((p,i)=>'<div class="rk" onclick="openDetail('+p.id+')"><div class="rk-p">'+(i===0?'&#127942;':i+1)+'</div><div class="rk-i"><div class="rk-nm">'+p.name+'</div><div class="rk-ar">'+p.artist+'</div></div><div style="display:flex;gap:2px">'+starsH(p.rating,11)+'</div></div>').join('')
    :'<div style="padding:12px 20px;font-family:\'DM Mono\',monospace;font-size:10px;color:var(--faint)">Rate paintings to build your ranking.</div>';
  const dd={};src.filter(p=>p.seen&&p.date).forEach(p=>{dd[p.date]=(dd[p.date]||0)+1;});
  function dWR(n){const ds=src.filter(p=>p.seen&&p.date).map(p=>p.date).sort();return ds[n-1]||null;}
  const ach=[
    // Milestones
    {ico:'&#128064;',nm:'First Glance',      ds:'Stood before your very first masterpiece in person.',              un:seen>=1,        dt:dWR(1)},
    {ico:'&#127942;',nm:'The Collector',     ds:'Seen 10 masterpieces. You\'re officially devoted.',               un:seen>=10,       dt:dWR(10)},
    {ico:'&#129351;',nm:'Connoisseur',       ds:'Seen 20 masterpieces. A true student of art.',                    un:seen>=20,       dt:dWR(20)},
    {ico:'&#128081;',nm:'Grand Master',      ds:'Seen all 40 masterpieces. An extraordinary achievement.',         un:seen>=40,       dt:dWR(40)},
    {ico:'&#127919;',nm:'Completionist',     ds:'Ticked off every painting in a single museum.',                   un:[...new Set(src.map(p=>p.museum))].some(m=>{const ps=src.filter(p=>p.museum===m);return ps.length>0&&ps.every(p=>p.seen);}),dt:dates[dates.length-1]||null},
    // Specific paintings (fun)
    {ico:'&#128563;',nm:'Size Matters',      ds:'Saw the Mona Lisa. Smaller than expected, right?',                un:!!src.find(p=>p.id===1&&p.seen),  dt:src.find(p=>p.id===1)?.date||null},
    {ico:'&#127769;',nm:'Night Watch',       ds:'Stood before Rembrandt\'s colossal masterpiece.',                 un:!!src.find(p=>p.id===9&&p.seen),  dt:src.find(p=>p.id===9)?.date||null},
    {ico:'&#128584;',nm:'Scream Queen',      ds:'Found Munch\'s The Scream. Did you relate?',                      un:!!src.find(p=>p.id===32&&p.seen), dt:src.find(p=>p.id===32)?.date||null},
    {ico:'&#127800;',nm:'Born to See It',    ds:'Stood before The Birth of Venus in Florence.',                    un:!!src.find(p=>p.id===15&&p.seen), dt:src.find(p=>p.id===15)?.date||null},
    {ico:'&#127775;',nm:'Stargazer',         ds:'Saw The Starry Night. Van Gogh would be thrilled.',               un:!!src.find(p=>p.id===23&&p.seen), dt:src.find(p=>p.id===23)?.date||null},
    {ico:'&#128092;',nm:'Kiss Chaser',       ds:'Saw Klimt\'s The Kiss. Romantic of you.',                         un:!!src.find(p=>p.id===31&&p.seen), dt:src.find(p=>p.id===31)?.date||null},
    {ico:'&#127807;',nm:'Guerrilla Art',     ds:'Stood before Picasso\'s anti-war Guernica.',                      un:!!src.find(p=>p.id===12&&p.seen), dt:src.find(p=>p.id===12)?.date||null},
    // Ratings & reviews
    {ico:'&#11088;',nm:'Five Star Critic',   ds:'Awarded the full 5 stars to a painting.',                         un:src.some(p=>p.seen&&p.rating===5),                                    dt:src.filter(p=>p.seen&&p.rating===5).map(p=>p.date).sort()[0]||null},
    {ico:'&#128221;',nm:'The Reviewer',      ds:'Left a personal note for every painting seen.',                   un:seen>0&&seenPs.every(p=>p.note),                                      dt:dates[dates.length-1]||null},
    {ico:'&#129397;',nm:'Deeply Moved',      ds:'Wrote a note of 100+ characters. Pure passion.',                  un:src.some(p=>p.note&&p.note.length>=100),                               dt:src.filter(p=>p.note&&p.note.length>=100).map(p=>p.date).sort()[0]||null},
    {ico:'&#128580;',nm:'Wall Hugger',       ds:'Saw a painting but left no note. Too stunned to write?',          un:src.some(p=>p.seen&&!p.note),                                         dt:src.filter(p=>p.seen&&!p.note).map(p=>p.date).sort()[0]||null},
    {ico:'&#128172;',nm:'Harshest Critic',   ds:'Gave a painting only 1 star. Someone\'s opinionated.',            un:src.some(p=>p.seen&&p.rating===1),                                    dt:src.filter(p=>p.seen&&p.rating===1).map(p=>p.date).sort()[0]||null},
    // Geography
    {ico:'&#127758;',nm:'Continental',       ds:'Seen works on 2 different continents.',                           un:[...new Set(seenPs.map(p=>p.region))].length>=2,                     dt:dates[dates.length-1]||null},
    {ico:'&#128506;',nm:'Globetrotter',      ds:'Collected paintings across 4 or more countries.',                 un:cou>=4,                                                              dt:dates[dates.length-1]||null},
    {ico:'&#127891;',nm:'Museum Devotee',    ds:'Set foot in 3 different museums.',                                un:mus>=3,                                                              dt:dates[dates.length-1]||null},
    {ico:'&#9992;', nm:'Jet-Setter',         ds:'Seen paintings in 3 or more different cities.',                   un:[...new Set(seenPs.map(p=>p.city))].length>=3,                       dt:dates[dates.length-1]||null},
    {ico:'&#127979;',nm:'Grand Tour',        ds:'Seen works in both Europe and the Americas.',                     un:['Europe','Americas'].every(r=>seenPs.some(p=>p.region===r)),        dt:dates[dates.length-1]||null},
    // Style & era
    {ico:'&#127917;',nm:'Renaissance Soul',  ds:'Seen 3 or more Renaissance masterpieces in person.',              un:src.filter(p=>p.seen&&p.era==='Renaissance').length>=3,               dt:dates[dates.length-1]||null},
    {ico:'&#127752;',nm:'Style Hunter',      ds:'Encountered 4 or more distinct art movements.',                   un:[...new Set(seenPs.map(p=>p.movement))].length>=4,                   dt:dates[dates.length-1]||null},
    {ico:'&#128161;',nm:'Era Explorer',      ds:'Seen paintings from 3 or more different eras.',                   un:[...new Set(seenPs.map(p=>p.era))].length>=3,                        dt:dates[dates.length-1]||null},
    {ico:'&#128396;',nm:'Baroque Binge',     ds:'Seen 3 Baroque works. Dramatic tastes confirmed.',                un:src.filter(p=>p.seen&&p.era==='Baroque').length>=3,                   dt:dates[dates.length-1]||null},
    // Quirky / pace
    {ico:'&#9889;', nm:'Speed Run',          ds:'Saw 3 or more paintings in a single day.',                        un:Object.values(dd).some(v=>v>=3),                                    dt:Object.entries(dd).find(([,v])=>v>=3)?.[0]||null},
    {ico:'&#128012;',nm:'Taking It Slow',    ds:'Left 6+ months between your first two visits.',                   un:dates.length>=2&&Math.abs(new Date(dates[0])-new Date(dates[1]))/86400000>180,dt:dates[1]||null},
    {ico:'&#128736;',nm:'Art Tourist',       ds:'Added or edited a painting in the database yourself.',             un:src.some(p=>p.id>40),                                                 dt:null},
  ];
  const unlocked=ach.filter(a=>a.un).length;
  const pct=Math.round(unlocked/ach.length*100);
  const achCards=ach.map(a=>'<div class="ac '+(a.un?'u':'')+'"><div class="ac-ico">'+a.ico+'</div><div class="ac-nm">'+a.nm+'</div><div class="ac-ds">'+a.ds+'</div>'+(a.un?'<div class="ac-ck">&#10003; Unlocked'+(a.dt?' &middot; <span style="opacity:.7">'+a.dt+'</span>':'')+'</div>':'')+'</div>').join('');
  // ── collapsible section builder ──
  function cSec(id,label,rows,defaultOpen){
    const open=(_trSec[id]!==undefined)?_trSec[id]:defaultOpen;
    const inner='<div id="trs-'+id+'" style="overflow:hidden;transition:max-height .35s cubic-bezier(.22,1,.36,1);max-height:'+(open?'9999px':'0')+'">'
      +rows+'</div>';
    const chevStyle='transition:transform .25s;display:inline-block;transform:'+(open?'rotate(0deg)':'rotate(180deg)')+';font-size:10px;color:var(--faint)';
    return '<div class="tr-sec-hdr" onclick="toggleTrSec(\''+id+'\')">'
      +'<span class="tr-sec-lbl">'+label+'</span>'
      +'<span class="tr-sec-chev" id="trc-'+id+'" style="'+chevStyle+'">&#9650;</span>'
      +'</div>'+inner;
  }

  document.getElementById('tr-body').innerHTML=
    '<div class="hero-card"><div class="hero-n">'+seen+'</div><div class="hero-l">Masterpieces Seen</div><div class="hero-grid"><div><div class="hn">'+mus+'</div><div class="hl">Museums</div></div><div><div class="hn">'+cou+'</div><div class="hl">Countries</div></div><div><div class="hn">'+Math.round(seen/total*100)+'%</div><div class="hl">Complete</div></div></div></div>'
    +cSec('region','By Region',gS('region').map(r=>'<div class="st-row"><div class="st-top"><div class="st-nm">'+r.name+'</div><div class="st-ct">'+r.seen+'/'+r.total+'</div></div><div class="pt"><div class="pf" style="width:'+Math.round(r.seen/r.total*100)+'%"></div></div></div>').join(''),true)
    +cSec('country','By Country',gS('country').map(c=>'<div class="st-row"><div class="st-top"><div class="st-nm">'+c.name+'</div><div class="st-ct">'+c.seen+'/'+c.total+'</div></div><div class="pt"><div class="pf" style="width:'+Math.round(c.seen/c.total*100)+'%"></div></div></div>').join(''),false)
    +cSec('style','By Style',gS('movement').map(m=>'<div class="st-row"><div class="st-top"><div class="st-nm">'+m.name+'</div><div class="st-ct">'+m.seen+'/'+m.total+'</div></div><div class="pt"><div class="pf" style="width:'+Math.round(m.seen/m.total*100)+'%"></div></div></div>').join(''),false)
    +cSec('era','By Era',gS('era').map(e=>'<div class="st-row"><div class="st-top"><div class="st-nm">'+e.name+'</div><div class="st-ct">'+e.seen+'/'+e.total+'</div></div><div class="pt"><div class="pf" style="width:'+Math.round(e.seen/e.total*100)+'%"></div></div></div>').join(''),false)
    +cSec('medium','By Medium',gS('type').map(t=>'<div class="st-row"><div class="st-top"><div class="st-nm">'+t.name+'</div><div class="st-ct">'+t.seen+'/'+t.total+'</div></div><div class="pt"><div class="pf" style="width:'+Math.round(t.seen/t.total*100)+'%"></div></div></div>').join(''),false)
    +cSec('visits','Visit Rate',vrH,false)
    +cSec('rankings','Your Rankings',rkH,false)
    +'<div class="ach-toggle-hdr" onclick="toggleAch()">'
      +'<div class="ach-hdr-left"><span class="ach-hdr-label">Achievements</span><span class="ach-badge">'+unlocked+' / '+ach.length+'</span></div>'
      +'<div class="ach-hdr-right"><div class="ach-prog-wrap"><div class="ach-prog-fill" style="width:'+pct+'%"></div></div><span class="ach-chevron open" id="ach-chev" style="transition:transform .25s">&#9650;</span></div>'
    +'</div>'
    +'<div id="ach-body" style="overflow:hidden;transition:max-height .4s cubic-bezier(.22,1,.36,1);max-height:9999px"><div class="ach-grid">'+achCards+'</div><div style="height:80px"></div></div>';
  _achOpen=true;
}
// ═══════════════════ JOURNAL ═══════════════════
function renderJournal(){
  const entries=MAP_DB.filter(p=>p.seen).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const el=document.getElementById('jscr');
  if(!entries.length){el.innerHTML='<div class="empty"><div class="empty-ico">&#9998;</div><div class="empty-tx">Your diary is empty.<br>Mark paintings as seen to begin.</div></div>';return;}
  let html='',lastM='';
  entries.forEach(p=>{
    const mo=p.date?new Date(p.date).toLocaleDateString('en-US',{month:'long',year:'numeric'}):'Undated';
    if(mo!==lastM){html+='<div class="mo-div"><div class="mo-ln"></div><div class="mo-tx">'+mo+'</div><div class="mo-ln"></div></div>';lastM=mo;}
    html+='<div class="jcard" onclick="openDetail('+p.id+')"><div class="jc-h"><div><div class="jc-t">'+p.name+'</div><div class="jc-l">'+p.museum+' &middot; '+p.city+'</div></div><div class="jc-d">'+(p.date||'—')+'</div></div><div class="jc-b">'+(p.rating?'<div style="display:flex;gap:3px;margin-bottom:8px">'+starsH(p.rating,13)+'</div>':'')+(p.note?'<div class="jc-n">&ldquo;'+p.note+'&rdquo;</div>':'<div style="font-family:\'DM Mono\',monospace;font-size:9px;color:var(--faint)">No notes — tap to add a review.</div>')+'<div class="jc-m">'+p.movement+' &middot; '+p.year+'</div></div></div>';
  });
  el.innerHTML=html;
}

// ═══════════════════ PROFILE ═══════════════════
function renderProfile(){
  const seen=MAP_DB.filter(p=>p.seen).length,total=MAP_DB.length;
  const mus=[...new Set(MAP_DB.filter(p=>p.seen).map(p=>p.museum))].length;
  const cou=[...new Set(MAP_DB.filter(p=>p.seen).map(p=>p.country))].length;
  const aA={},mA={};
  MAP_DB.filter(p=>p.seen&&p.rating).forEach(p=>{
    [aA,mA].forEach((obj,i)=>{const k=i?p.museum:p.artist;if(!obj[k])obj[k]={s:0,c:0};obj[k].s+=p.rating;obj[k].c++;});
  });
  const topArt=Object.entries(aA).map(([a,d])=>({name:a,avg:Math.round(d.s/d.c*10)/10})).sort((a,b)=>b.avg-a.avg);
  const topMus=Object.entries(mA).map(([m,d])=>({name:m,avg:Math.round(d.s/d.c*10)/10})).sort((a,b)=>b.avg-a.avg);
  const maxR=MAP_DB.filter(p=>p.seen&&p.rating).reduce((b,p)=>Math.max(b,p.rating),0);
  const topPs=MAP_DB.filter(p=>p.seen&&p.rating===maxR);
  let favBlock='<div style="margin:4px 20px 16px;padding:20px;border:1px solid var(--border);border-radius:8px;text-align:center;font-family:\'Cormorant Garamond\',serif;font-style:italic;font-size:16px;color:var(--faint)">Rate paintings to reveal your favourite.</div>';
  if(topPs.length){
    const fav=USER.favPainting&&topPs.find(p=>p.id===USER.favPainting)?topPs.find(p=>p.id===USER.favPainting):topPs[0];
    if(topPs.length===1||USER.favPainting){
      favBlock='<div class="fav-card" onclick="openDetail('+fav.id+')"><div class="fav-lbl">&#9733; Favourite Painting</div><div class="fav-frame">&#128444;</div><div class="fav-b"><div class="fav-t">'+fav.name+'</div><div class="fav-a">'+fav.artist+' &middot; '+fav.year+'</div><div style="display:flex;gap:3px;margin-top:7px">'+starsH(fav.rating,14)+'</div></div></div>';
    } else {
      favBlock='<div class="tb-card"><div class="tb-h"><div class="tb-e">Tie &mdash; both rated '+maxR+'&#9733;</div><div class="tb-t">Which is your true favourite?</div></div><div class="tb-opts">'+topPs.slice(0,4).map(p=>'<button class="tb-opt" onclick="setFav('+p.id+')"><span class="tb-on">'+p.name+'</span><span class="tb-oa">'+p.artist+'</span></button>').join('')+'</div></div>';
    }
  }
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  const avH=USER.avatar?'<img src="'+USER.avatar+'" style="width:76px;height:76px;border-radius:50%;object-fit:cover;border:2px solid var(--border)">'
    :'<div class="av">&#127912;</div>';
  const authLabel=AUTH_USER?(AUTH_USER.email||AUTH_USER.displayName||'Signed in'):'';
  const adminControls=AUTH_USER
    ?(getAdminEnabled()
      ?'<button class="btn-ghost" onclick="openAdmin()">Open Admin Console</button><button class="btn-ghost" onclick="exitAdmin()">Exit Admin Mode</button>'
      :'<button class="btn-ghost" onclick="promptAdmin()">Admin Login</button>')
    :'';
  document.getElementById('pscr').innerHTML=
    '<div class="prof-hero"><div class="av-wrap" onclick="document.getElementById(\'av-inp\').click()">'+avH+'<div class="av-e">&#9998;</div></div><div class="pn-row"><div id="pnd" class="pn">'+USER.name+'</div><span class="pn-eb" onclick="editName()">&#9998;</span></div><div class="pbio">Chasing masterpieces across the world</div></div>'
    +'<div class="theme-row"><span class="theme-label">Appearance</span><div class="theme-icons"><span style="font-size:15px">&#9728;</span><div class="toggle-track" onclick="toggleTheme()"><div class="toggle-thumb"></div></div><span style="font-size:15px">&#9790;</span></div></div>'
    +'<div class="p-quad"><div class="pq"><div class="pq-n">'+seen+'</div><div class="pq-l">Seen</div></div><div class="pq"><div class="pq-n">'+mus+'</div><div class="pq-l">Museums</div></div><div class="pq"><div class="pq-n">'+cou+'</div><div class="pq-l">Countries</div></div><div class="pq"><div class="pq-n">'+total+'</div><div class="pq-l">In Database</div></div></div>'
    +'<div class="fsec"><div class="fs-t">Favourite Painting</div></div>'
    +favBlock
    +'<div class="fsec"><div class="fs-t">Top Artists <span style="color:var(--faint);font-size:8px;letter-spacing:0">by avg. rating</span></div>'
    +(topArt.length?topArt.slice(0,5).map(a=>'<span class="ftag">'+a.name+'<span>'+a.avg+'&#9733;</span></span>').join(''):'<div style="font-family:\'Cormorant Garamond\',serif;font-style:italic;font-size:14px;color:var(--faint)">Rate paintings to auto-populate.</div>')
    +'<div class="fs-t" style="margin-top:18px">Top Museums <span style="color:var(--faint);font-size:8px;letter-spacing:0">by avg. rating</span></div>'
    +(topMus.length?topMus.slice(0,4).map((m,i)=>'<div class="mr-row"><div class="mr-nm"'+(i===0?' style="color:var(--gold)"':'')+'>'+( i===0?'&#9733; ':'')+m.name+'</div><div class="mr-v">'+m.avg+'&#9733;</div></div>').join(''):'<div style="font-family:\'Cormorant Garamond\',serif;font-style:italic;font-size:14px;color:var(--faint)">Visit museums and rate to populate.</div>')
    +'<div class="fs-t" style="margin-top:18px">Overall Progress</div>'
    +'<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-family:\'DM Mono\',monospace;font-size:9px;color:var(--faint)">Collection</span><span style="font-family:\'DM Mono\',monospace;font-size:9px;color:var(--gold-dim)">'+seen+'/'+total+'</span></div>'
    +'<div class="pt" style="height:4px"><div class="pf" style="width:'+Math.round(seen/total*100)+'%"></div></div></div>'
    +'<div style="padding:16px 20px 24px;display:flex;flex-direction:column;gap:10px">'
      +(authLabel?'<div class="auth-meta">'+authLabel+'</div>':'')
      +adminControls
      +'<div class="auth-meta">Version '+APP_VERSION+'</div>'
      +'<button class="btn-ghost" onclick="doSignOut()">Sign out</button>'
    +'</div>';
}

function setFav(id){USER.favPainting=id;persist();renderProfile();}
function editName(){
  const el=document.getElementById('pnd');if(!el)return;
  el.outerHTML='<input class="pn-in" id="pni" value="'+USER.name+'" onblur="saveName()" onkeydown="if(event.key===\'Enter\')saveName()">';
  document.getElementById('pni').focus();
}
function saveName(){const el=document.getElementById('pni');if(!el)return;USER.name=el.value.trim()||USER.name;persist();renderProfile();}
function handleAvatar(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=e=>{USER.avatar=e.target.result;persist();renderProfile();};r.readAsDataURL(f);}

function doSignOut(){signOut(auth).catch(()=>undefined);}

let handlersBound=false;
function bindStaticHandlers(){
  if(handlersBound) return;
  handlersBound=true;
  const search=document.getElementById('list-search');
  if(search){
    search.addEventListener('input',e=>{lQ=e.target.value;renderLI();});
  }
  const signInBtn=document.getElementById('auth-sign-in');
  if(signInBtn){
    signInBtn.addEventListener('click',()=>{signInWithPopup(auth,provider).catch(()=>undefined);});
  }
  updateMapToggleUI();
}

function boot(){
  if(booted) return;
  booted=true;
  initMap();
}

function refreshActiveTabs(){
  if(document.getElementById('list-tab').classList.contains('active')) renderList();
  if(document.getElementById('tracker-tab').classList.contains('active')) renderTracker();
  if(document.getElementById('journal-tab').classList.contains('active')) renderJournal();
  if(document.getElementById('profile-tab').classList.contains('active')) renderProfile();
}

function applyLoadedState(remote, catalog){
  const safeUser=remote&&remote.userProfile?remote.userProfile:null;
  const legacyPaintings=remote&&Array.isArray(remote.paintings)?remote.paintings:null;
  const catalogPaintings=catalog&&Array.isArray(catalog.paintings)?catalog.paintings:null;
  const useAdmin=getAdminEnabled();

  if(catalogPaintings){
    CATALOG=catalogPaintings;
    MISSING_COUNTRIES=Array.isArray(catalog.missingCountries)?catalog.missingCountries:[];
  } else if(legacyPaintings){
    CATALOG=legacyPaintings.map(stripUserFields);
    MISSING_COUNTRIES=[];
    if(useAdmin){
      saveCatalog(CATALOG).catch(()=>undefined);
    }
  } else {
    CATALOG=cloneSeed();
    MISSING_COUNTRIES=[];
    if(useAdmin){
      saveCatalog(CATALOG).catch(()=>undefined);
    }
  }

  if(remote&&remote.logs){
    LOGS=remote.logs||{};
  } else if(legacyPaintings){
    LOGS=buildLogsFromLegacy(legacyPaintings);
    if(AUTH_USER){
      setDoc(getAppDocRef(AUTH_USER.uid),{logs:LOGS},{merge:true}).catch(()=>undefined);
    }
  } else {
    LOGS={};
  }

  mergeCatalogAndLogs();
  USER={...defaultUserProfile(),...(safeUser||{})};
  updateUserProfileFromAuth();
  applyTheme();
  dataReady=true;
  boot();
  refreshMapColors();
  refreshPanel();
  refreshActiveTabs();
  if(getAdminEnabled()) renderAdminPhotos();
}

bindStaticHandlers();

onAuthStateChanged(auth,(user)=>{
  AUTH_USER=user||null;
  if(!AUTH_USER){
    setAuthOverlay(true);
    dataReady=false;
    DB=[];
    USER=defaultUserProfile();
    applyTheme();
    closeAdmin();
    return;
  }
  setAuthOverlay(false);
  Promise.all([loadRemote(AUTH_USER.uid), loadCatalog()])
    .then(([remote,catalog])=>applyLoadedState(remote,catalog))
    .catch(()=>applyLoadedState(null,null));
});

Object.assign(window,{
  switchTab,
  closePanel,
  openReview,
  setS,
  saveReview,
  cancelReview,
  closeSugModal,
  setSugPath,
  doSugSearch,
  selectSugPainting,
  clearSugSel,
  saveSuggestion,
  setLF,
  setLC,
  toggleTrSec,
  toggleAch,
  openDetail,
  closeDetail,
  unseeP,
  setFav,
  editName,
  saveName,
  handleAvatar,
  setMapMode,
  toggleTheme,
  openSugModal,
  openCountryPanel,
  openMuseumPanel,
  doSignOut,
  importCatalogCsv,
  handlePhotoInput,
  handleAdminPhotoInput,
  adminRemovePhoto,
  removePaintingPhoto,
  promptAdmin,
  openAdmin,
  closeAdmin,
  exitAdmin,
  applySuggestion,
  rejectSuggestion,
  setAdminPhotoQuery
});


