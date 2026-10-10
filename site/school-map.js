'use strict';
let schoolMapAssets=null,schoolLocationMap=null;

function loadSchoolMapAssets(){
  if(schoolMapAssets)return schoolMapAssets;
  const stylesheet=url=>new Promise((resolve,reject)=>{
    const link=document.createElement('link');link.rel='stylesheet';link.href=url;
    link.onload=resolve;link.onerror=()=>reject(new Error('Map stylesheet unavailable'));document.head.append(link);
  });
  const script=url=>new Promise((resolve,reject)=>{
    const element=document.createElement('script');element.src=url;
    element.onload=resolve;element.onerror=()=>reject(new Error('Map library unavailable'));document.head.append(element);
  });
  schoolMapAssets=Promise.all([
    stylesheet('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css'),
    stylesheet('https://cdn.jsdelivr.net/npm/maplibre-gl@5.12.0/dist/maplibre-gl.css'),
    (async()=>{
      await script('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js');
      await script('https://cdn.jsdelivr.net/npm/maplibre-gl@5.12.0/dist/maplibre-gl.js');
      await script('https://cdn.jsdelivr.net/npm/@maplibre/maplibre-gl-leaflet@0.1.4/leaflet-maplibre-gl.js');
    })()
  ]);
  // Loading can outlast a school selection; every caller handles failure and checks its render token.
  return schoolMapAssets;
}

function clearSchoolLocation(){
  if(schoolLocationMap){
    clearTimeout(schoolLocationMap.timeout);schoolLocationMap.resize?.disconnect();schoolLocationMap.map?.remove();schoolLocationMap=null;
  }
  $('#school-location').hidden=true;$('#school-map').hidden=true;$('#school-map').replaceChildren();
  $('#school-map-status').textContent='';$('#school-map-recenter').disabled=true;
  $('#school-map-recenter').onclick=null;$('#school-heading-layout').classList.remove('has-school-map');
  delete $('#school-map').dataset.ready;
}

async function renderSchoolLocation(meta,token){
  const valid=Number.isFinite(meta.lat)&&Number.isFinite(meta.lon)&&Math.abs(meta.lat)<=90&&Math.abs(meta.lon)<=180;
  $('#school-location').hidden=false;$('#school-heading-layout').classList.add('has-school-map');
  $('#school-map-link').href=`https://www.google.com/maps/search/?api=1&query=${valid?`${meta.lat},${meta.lon}`:encodeURIComponent([meta.name,meta.city,'Ontario'].filter(Boolean).join(' '))}`;
  const status=$('#school-map-status');
  if(!valid){status.textContent='School location unavailable.';return}
  status.textContent='Loading map…';
  const instance={map:null,resize:null,timeout:null,failed:false};schoolLocationMap=instance;
  const current=()=>token===renderToken&&schoolLocationMap===instance&&!instance.failed;
  const unavailable=()=>{
    if(!current())return;
    instance.failed=true;
    clearTimeout(instance.timeout);instance.resize?.disconnect();instance.map?.remove();instance.map=null;
    $('#school-map').hidden=true;$('#school-map-recenter').disabled=true;
    status.textContent='The map could not be loaded. Open in Google Maps to view this school.';
    delete $('#school-map').dataset.ready;
  };
  instance.timeout=setTimeout(unavailable,15000);
  try{
    await loadSchoolMapAssets();if(!current())return;
    $('#school-map').hidden=false;
    const map=L.map('school-map',{scrollWheelZoom:false,minZoom:2,maxZoom:19}).setView([meta.lat,meta.lon],14);instance.map=map;
    const basemap=L.maplibreGL({style:'https://tiles.openfreemap.org/styles/positron',maxZoom:19}).addTo(map);
    const vectorMap=basemap.getMaplibreMap();
    vectorMap.on('error',()=>{if(!$('#school-map').dataset.ready)unavailable()});
    vectorMap.once('idle',()=>{
      if(!current()||instance.map!==map)return;
      clearTimeout(instance.timeout);status.textContent='';$('#school-map').dataset.ready='true';
    });
    const icon=L.divIcon({className:'school-location-pin',html:'<span aria-hidden="true"></span>',iconSize:[24,30],iconAnchor:[12,28],popupAnchor:[0,-26]});
    const popup=document.createElement('div');const name=document.createElement('strong');name.textContent=meta.name;
    popup.append(name,document.createElement('br'),document.createTextNode('Selected school'));
    L.marker([meta.lat,meta.lon],{icon,alt:meta.name,title:meta.name}).bindPopup(popup).addTo(map);
    $('#school-map-recenter').disabled=false;
    $('#school-map-recenter').onclick=()=>map.setView([meta.lat,meta.lon],14);
    instance.resize=new ResizeObserver(()=>{if(current()&&instance.map===map)map.invalidateSize()});
    instance.resize.observe($('#school-map'));
  }catch{unavailable()}
}
