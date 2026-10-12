'use strict';
// Preview storage is deliberately separate from the production app's list.
const previewSavedSchools = (() => {
  const key='eqao-map-mockup-saved-schools-v1', max=100;
  let ids=[], available=true;
  function load() {
    try {
      const data=JSON.parse(localStorage.getItem(key)||'null');
      ids=data?.version===1&&Array.isArray(data.ids)?[...new Set(data.ids.filter(id=>typeof id==='string'))].slice(0,max):[];
    } catch {available=false;}
    return [...ids];
  }
  function persist() {
    try {localStorage.setItem(key,JSON.stringify({version:1,ids}));available=true;}catch {available=false;}
  }
  return {
    key,max,load,list:()=>[...ids],has:id=>ids.includes(id),storageAvailable:()=>available,
    add(id,position=ids.length) {
      if(ids.includes(id))return 'already';if(ids.length>=max)return 'full';
      ids.splice(position,0,id);persist();return 'saved';
    },
    remove(id) {const index=ids.indexOf(id);if(index<0)return -1;ids.splice(index,1);persist();return index;}
  };
})();
