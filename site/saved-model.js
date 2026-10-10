/* Browser-local saved school list and comparison selections. */
(function(root){
  'use strict';
  const MAX_SAVED=100,MAX_SELECTED=5;
  class SavedSchools {
    constructor(ids=[],selected=[]){this.ids=[...new Set(ids)].slice(0,MAX_SAVED);this.selected=[...new Set(selected)].filter(id=>this.ids.includes(id)).slice(0,MAX_SELECTED);}
    save(id){if(this.ids.includes(id))return 'already';if(this.ids.length>=MAX_SAVED)return 'full';this.ids.push(id);return 'saved';}
    remove(id){const index=this.ids.indexOf(id),selected=this.selected.includes(id);this.ids=this.ids.filter(x=>x!==id);this.selected=this.selected.filter(x=>x!==id);return {id,index,selected};}
    undo(item){if(item.index<0||this.ids.includes(item.id)||this.ids.length>=MAX_SAVED)return false;this.ids.splice(Math.min(item.index,this.ids.length),0,item.id);if(item.selected&&this.selected.length<MAX_SELECTED)this.selected.push(item.id);return true;}
    toggle(id){if(this.selected.includes(id)){this.selected=this.selected.filter(x=>x!==id);return 'deselected';}if(!this.ids.includes(id))return 'missing';if(this.selected.length>=MAX_SELECTED)return 'limit';this.selected.push(id);return 'selected';}
    compare(){const schools=this.ids.filter(id=>this.selected.includes(id));return schools.length>=2?{schools}:null;}
    snapshot(){return {ids:this.ids,selected:this.selected};}
  }
  root.SavedSchools=SavedSchools;
  if(typeof module!=='undefined')module.exports={SavedSchools,MAX_SAVED,MAX_SELECTED};
})(typeof window==='undefined'?globalThis:window);
