'use strict';
// Fit only the My School search workspace to the portion above a native keyboard.
let schoolViewportBaseline=window.innerHeight;
function updateSchoolKeyboardLayout(){
  const viewport=window.visualViewport,height=viewport?.height||window.innerHeight;
  const input=$('#school-picker-search'),focused=document.activeElement===input;
  if(!focused)schoolViewportBaseline=window.innerHeight;
  const open=window.innerWidth<=720&&state.view==='myschool'&&$('#school-chooser').open&&focused&&Math.max(schoolViewportBaseline,window.innerHeight)-height>120;
  const workspace=$('#school-heading-layout');
  workspace.style.setProperty('--visible-height',`${height}px`);
  workspace.style.setProperty('--visible-top',`${viewport?.offsetTop||0}px`);
  document.body.classList.toggle('school-keyboard-open',open);
  document.body.classList.toggle('school-short-keyboard',open&&height<300);
  $('#school-search-done').hidden=!open;
  schoolLocationMap?.adapter?.resize();
}
$('#school-search-done').onclick=()=>{$('#school-picker-search').blur();updateSchoolKeyboardLayout()};
$('#school-picker-search').addEventListener('focus',updateSchoolKeyboardLayout);
$('#school-picker-search').addEventListener('blur',()=>{setTimeout(updateSchoolKeyboardLayout,0)});
window.visualViewport?.addEventListener('resize',updateSchoolKeyboardLayout);
window.visualViewport?.addEventListener('scroll',updateSchoolKeyboardLayout);
window.addEventListener('resize',updateSchoolKeyboardLayout);
updateSchoolKeyboardLayout();
