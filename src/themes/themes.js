const themeRows=[
 ['midnight','Midnight','#0b1019','#151d2b','#263449','#627797','#f5f7ff','#b8c8e1','#b39aff','#7cb8fa','#ecc070','#83cdb2','#b7acc8'],
 ['blueprint','Blueprint','#071322','#10243b','#1c3b5b','#5e91bd','#f1f8ff','#b5d3ec','#82b5ff','#5bd5ff','#f0d48a','#7be0d1','#b9b5ff'],
 ['vscode','VS Code Dark','#1e1e1e','#252526','#2d2d30','#606066','#f0f0f0','#b5bdc8','#569cd6','#4fc1ff','#dcdcaa','#4ec9b0','#9cdcfe'],
 ['graphite','Graphite','#0b0b0b','#191919','#303030','#737373','#fafafa','#c5c5c5','#b8c7d6','#93c5fd','#e0c77a','#9acbb4','#b9c3cb'],
 ['nord','Nord','#181e28','#252e3b','#3b485e','#7c8fa9','#f4f7fc','#c1cee0','#88b8e8','#81a1c1','#ebcb8b','#8fbcbb','#a3c8df'],
 ['dracula','Dracula','#10111b','#202231','#34374e','#8186ad','#fffffa','#d0d2e9','#bd93f9','#8be9fd','#f1fa8c','#50fa7b','#ff79c6'],
 ['contrast','High contrast','#000000','#0c0c0c','#242424','#a0a0a0','#ffffff','#eeeeee','#d5e5f5','#80d5ff','#ffe080','#83f0ad','#e0e6eb']
];
export const themes=Object.freeze(themeRows.map(([id,name,canvas,container,tile,border,text,muted,app,service,database,infrastructure,external])=>Object.freeze({id,name,canvas,container,tile,border,text,muted,palette:Object.freeze({app,service,database,infrastructure,external,group:muted})})));
export function resolveTheme(id) { return themes.find(theme=>theme.id===id) ?? themes[0]; }
export function applyTheme(element,id) {
 const theme=resolveTheme(id);
 for(const key of ['canvas','container','tile','border','text','muted']) { element.style.setProperty('--theme-'+key,theme[key]); }
 for(const [type,color] of Object.entries(theme.palette)) { element.style.setProperty('--type-'+type,color); }
 element.dataset.theme=theme.id;
 return theme.id;
}
