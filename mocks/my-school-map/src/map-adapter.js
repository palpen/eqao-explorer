'use strict';
let schoolMapLibraryRequest;
function loadMapLibrary(config) {
  if (window.maplibregl) return Promise.resolve();
  if (schoolMapLibraryRequest) return schoolMapLibraryRequest;
  schoolMapLibraryRequest = Promise.all([
    new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = config.stylesheet;
      link.onload = resolve; link.onerror = () => reject(new Error('Map styles could not load.'));
      document.head.append(link);
    }),
    new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = config.script;
      script.onload = resolve; script.onerror = () => reject(new Error('The map library could not load.'));
      document.head.append(script);
    })
  ]).catch(error => {schoolMapLibraryRequest = null; throw error;});
  return schoolMapLibraryRequest;
}

async function createMapLibreSchoolAdapter({container, config, background, onSchoolPreview, onSchoolChoose, onStatus}) {
  await loadMapLibrary(config.library);
  const hasLocation = s => Number.isFinite(s?.lat) && Number.isFinite(s?.lon);
  const collection = schools => ({type:'FeatureCollection',features:schools.filter(hasLocation).map(s => ({
    type:'Feature', id:Number(s.id), geometry:{type:'Point',coordinates:[s.lon,s.lat]},
    properties:{id:s.id,name:s.name}
  }))});
  const empty = () => ({type:'FeatureCollection',features:[]});
  let schools=[], highlighted=null, destroyed=false, ready=false, styleKey=background;
  const lookup = new Map();
  const map = new maplibregl.Map({
    container, style:config.backgrounds[background].url, center:[-81,45.3], zoom:5.3,
    minZoom:3,maxZoom:18,attributionControl:{compact:false},dragRotate:false,pitchWithRotate:false
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({showCompass:false}), 'top-right');
  map.addControl(new maplibregl.ScaleControl({maxWidth:85,unit:'metric'}), 'bottom-right');
  const canvas=map.getCanvas();
  canvas.setAttribute('aria-label','Map of matching schools. Use the search results to choose a school.');
  const notifyCamera=()=>{
    const center=map.getCenter();
    container.dataset.center=JSON.stringify([center.lng,center.lat]);
    container.dataset.zoom=String(map.getZoom());
  };
  map.on('moveend',notifyCamera);
  function installSchoolLayers() {
    if (destroyed) return;
    if (!map.getSource('school-points')) map.addSource('school-points',{
      type:'geojson',data:collection(schools),cluster:true,clusterRadius:45,clusterMaxZoom:12
    });
    if (!map.getLayer('school-clusters')) map.addLayer({id:'school-clusters',type:'circle',source:'school-points',filter:['has','point_count'],paint:{
      'circle-color':config.colors.cluster,'circle-radius':['step',['get','point_count'],17,20,21,100,26],
      'circle-stroke-width':2,'circle-stroke-color':config.colors.halo,'circle-opacity':0.93
    }});
    if (!map.getLayer('school-counts')) map.addLayer({id:'school-counts',type:'symbol',source:'school-points',filter:['has','point_count'],layout:{
      'text-field':['get','point_count_abbreviated'],'text-font':['Noto Sans Regular'],'text-size':12
    },paint:{'text-color':config.colors.text}});
    if (!map.getLayer('individual-schools')) map.addLayer({id:'individual-schools',type:'circle',source:'school-points',filter:['!', ['has','point_count']],paint:{
      'circle-color':config.colors.point,'circle-radius':6,'circle-stroke-width':1.8,'circle-stroke-color':config.colors.halo
    }});
    if (!map.getSource('highlighted-school')) map.addSource('highlighted-school',{type:'geojson',data:highlighted?collection([highlighted]):empty()});
    if (!map.getLayer('highlight-halo')) map.addLayer({id:'highlight-halo',type:'circle',source:'highlighted-school',paint:{
      'circle-radius':17,'circle-color':config.colors.highlight,'circle-opacity':0.16
    }});
    if (!map.getLayer('highlight-pin')) map.addLayer({id:'highlight-pin',type:'circle',source:'highlighted-school',paint:{
      'circle-radius':8,'circle-color':config.colors.highlight,'circle-stroke-width':3,'circle-stroke-color':config.colors.halo
    }});
    ready=true;
    container.dataset.mapReady='true'; container.dataset.background=styleKey;
    if (container.querySelector('.map-loading')) container.querySelector('.map-loading').remove();
  }
  map.on('style.load',installSchoolLayers);
  map.on('error',()=>{if(!destroyed)onStatus('Street map unavailable. You can still search and select schools.');});
  map.on('idle',()=>{if(ready&&!destroyed)onStatus('');});
  map.on('click','school-clusters',async event=>{
    const feature=event.features?.[0];
    if(!feature)return;
    try{
      const zoom=await map.getSource('school-points').getClusterExpansionZoom(feature.properties.cluster_id);
      if(destroyed)return;
      map.stop();map.easeTo({center:feature.geometry.coordinates,zoom,duration:650,essential:false});
    }catch{/* An interrupted background switch simply cancels this cluster click. */}
  });
  const schoolAt=event=>lookup.get(event.features?.[0]?.properties?.id);
  map.on('click','individual-schools',event=>{const s=schoolAt(event);if(s)onSchoolChoose(s);});
  map.on('mouseenter','individual-schools',event=>{
    canvas.style.cursor='pointer';const s=schoolAt(event);if(s)onSchoolPreview(s,{move:false});
  });
  map.on('mouseleave','individual-schools',()=>{canvas.style.cursor='';});
  map.on('mouseenter','school-clusters',()=>{canvas.style.cursor='pointer';});
  map.on('mouseleave','school-clusters',()=>{canvas.style.cursor='';});
  map.on('click','highlight-pin',event=>{if(highlighted)onSchoolChoose(highlighted);});
  map.on('mouseenter','highlight-pin',()=>{canvas.style.cursor='pointer';});
  map.on('mouseleave','highlight-pin',()=>{canvas.style.cursor='';});
  const resize=new ResizeObserver(()=>{if(!destroyed)map.resize();});resize.observe(container);
  notifyCamera();
  return {
    setSchools(next) {
      schools=next; lookup.clear();next.forEach(s=>lookup.set(s.id,s));
      map.getSource('school-points')?.setData(collection(schools));
    },
    highlight(school) {
      highlighted=school;
      map.getSource('highlighted-school')?.setData(school?collection([school]):empty());
    },
    focus(school,{animate=true}={}) {
      if(!hasLocation(school))return false;
      map.stop();map.flyTo({center:[school.lon,school.lat],zoom:13.6,padding:{top:0,bottom:0,left:0,right:0},duration:animate?1000:0,curve:1.3,essential:false});
      return true;
    },
    fit(next,{animate=true}={}) {
      if(container.clientWidth<100||container.clientHeight<80)return false;
      const points=next.filter(hasLocation);
      if(!points.length)return false;
      const bounds=new maplibregl.LngLatBounds();points.forEach(s=>bounds.extend([s.lon,s.lat]));
      const small=container.clientWidth<600;
      const height=container.clientHeight;
      const top=Math.min(70,height*.25),bottom=Math.min(highlighted?(small?140:165):45,height*.3);
      map.stop();map.fitBounds(bounds,{padding:{top,bottom,left:30,right:45},maxZoom:12.8,duration:animate?1000:0,essential:false});
      return true;
    },
    setBackground(key) {
      const definition=config.backgrounds[key];
      if(!definition)throw new Error('Unknown map background.');
      // Replacing the style emits style.load reliably. Diffing compatible styles
      // may skip that event, which would otherwise drop our school overlays.
      styleKey=key;ready=false;delete container.dataset.mapReady;map.setStyle(definition.url,{diff:false});
    },
    camera() {const c=map.getCenter();return {lon:c.lng,lat:c.lat,zoom:map.getZoom()};},
    resize() {map.resize();},
    destroy() {destroyed=true;resize.disconnect();map.remove();}
  };
}
