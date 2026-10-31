/** Code-native stage props, paired with the approved painted performer sprites.
 * No font glyphs or generated replacements for the approved cast. */
const svg=(body,box='0 0 120 100')=>`<svg viewBox="${box}" aria-hidden="true">${body}</svg>`;
const treeBody='<path d="M55 78V48H66V78L78 90H42Z" fill="#9a704c" stroke="#644b38" stroke-width="2"/><path d="M22 59Q7 40 26 29Q23 10 45 13Q59 -2 76 13Q99 7 99 28Q118 43 99 58Q99 77 78 71Q62 84 47 71Q24 78 22 59Z" fill="#6e936e" stroke="#476747" stroke-width="3"/><path d="M30 34Q36 18 51 25M55 51Q68 35 86 40M31 57Q40 64 49 57" fill="none" stroke="#a3b386" stroke-width="5" stroke-linecap="round"/><path d="M49 86H72" stroke="#c69b63" stroke-width="3"/>';
const moonBody='<path d="M79 9Q41 2 25 32Q11 62 36 84Q64 107 94 80Q60 89 47 63Q34 36 59 20Q67 14 79 9Z" fill="#eed49b" stroke="#a98a56" stroke-width="3"/><path d="M36 34Q19 61 42 78" fill="none" stroke="#fff0bd" stroke-width="6" stroke-linecap="round"/><path d="M87 19L91 29 102 33 91 37 87 48 83 37 72 33 83 29Z" fill="#dfb86f" stroke="#ad8b52" stroke-width="2"/>';
const instrument=active=>`<g transform="rotate(-18 190 145)"><path d="M193 86L200 36 222 36 217 97" fill="#ac7a46" stroke="#6c4b31" stroke-width="4"/><path d="M207 36L208 18Q223 10 231 23L225 43Z" fill="#ad7e4d" stroke="#705034" stroke-width="3"/><path d="M194 85Q165 67 147 88Q134 105 147 122Q152 132 137 143Q108 163 124 190Q144 219 177 205Q215 215 232 185Q245 158 221 139Q205 125 216 107Q226 83 204 82Z" fill="#c38d50" stroke="#745035" stroke-width="5"/><path d="M156 91Q137 102 157 125Q164 139 144 153Q122 174 144 192" fill="none" stroke="#dfb66c" stroke-width="8" stroke-linecap="round"/><ellipse cx="181" cy="149" rx="21" ry="24" fill="#554433" stroke="#e4bd7d" stroke-width="6"/><path d="M162 186L200 190" stroke="#765036" stroke-width="9"/><g stroke="${active?'#fff2bb':'#ead9ad'}" stroke-width="2"><path d="M211 35L168 186M215 35L178 188M219 36L188 189M223 38L198 190"/></g><g stroke="#786746" stroke-width="3"><path d="M201 60L220 64M197 73L219 77M194 87L216 91"/></g>${active?'<path d="M119 110Q108 119 119 131M239 127Q252 139 241 151" fill="none" stroke="#e9ca77" stroke-width="4" stroke-linecap="round"/>':''}</g>`;
export function leisureToolArt(tool){
 if(tool==='tree')return svg(treeBody);
 if(tool==='moon')return svg(moonBody);
 if(tool==='pick')return svg('<path d="M34 20Q62 4 87 23Q104 44 62 87Q23 54 24 36Q24 26 34 20Z" fill="#e6c27f" stroke="#a37b42" stroke-width="4"/><path d="M36 34Q51 23 74 31" fill="none" stroke="#fff0bb" stroke-width="6" stroke-linecap="round"/>');
 if(tool==='spotlight')return svg('<path d="M37 59L19 89H96L76 59" fill="#a1834e" stroke="#6b5b3c" stroke-width="3"/><path d="M42 35L32 66Q58 81 85 60L76 29Z" fill="#526e61" stroke="#344c43" stroke-width="4"/><path d="M30 36Q48 51 78 30L85 16 25 20Z" fill="#778a65" stroke="#344c43" stroke-width="3"/><ellipse cx="54" cy="23" rx="30" ry="12" fill="#e7c77f" stroke="#a88b50" stroke-width="4"/><ellipse cx="54" cy="23" rx="21" ry="7" fill="#fff3bf"/><path d="M28 67Q59 90 87 60" fill="none" stroke="#cfb16d" stroke-width="6"/>');
 if(tool==='baton')return svg('<path d="M30 81L89 17" stroke="#5c4e38" stroke-width="10" stroke-linecap="round"/><path d="M43 66L90 16" stroke="#f0e4bb" stroke-width="6" stroke-linecap="round"/><path d="M27 84L43 66" stroke="#ad8551" stroke-width="13" stroke-linecap="round"/>');
 if(tool==='curtain-ring')return svg('<path d="M60 0V35" stroke="#d2b575" stroke-width="7"/><ellipse cx="60" cy="55" rx="23" ry="25" fill="none" stroke="#806239" stroke-width="10"/><ellipse cx="60" cy="53" rx="23" ry="25" fill="none" stroke="#e1c185" stroke-width="7"/><path d="M53 80L42 96H78L66 79" fill="#d1a668" stroke="#9d7847" stroke-width="2"/>');
 return '';
}
export function leisurePropArt(tool,silhouette=false){
 if(!['tree','moon'].includes(tool))return '';
 return `<span class="leisure-prop ${silhouette?'silhouette':''}">${leisureToolArt(tool)}</span>`;
}
export function leisureSceneArt(kind,progress=0){
 if(!['lounge','theater'].includes(kind))return '';
 const lounge=kind==='lounge',wall=lounge?'#435e50':'#354d4b';
 return svg(`<defs><linearGradient id="leisure-wall" x2="0" y2="1"><stop stop-color="${wall}"/><stop offset="1" stop-color="#263f38"/></linearGradient><radialGradient id="leisure-glow"><stop stop-color="#ffe8a9" stop-opacity=".55"/><stop offset="1" stop-color="#f5d48b" stop-opacity="0"/></radialGradient><linearGradient id="leisure-floor" x2="0" y2="1"><stop stop-color="#b18e5d"/><stop offset="1" stop-color="#806040"/></linearGradient></defs><path fill="url(#leisure-wall)" d="M0 0H600V280H0Z"/><path d="M0 222Q300 201 600 222V280H0Z" fill="url(#leisure-floor)"/><path d="M0 247H600M101 224L90 280M205 216L201 280M300 214V280M401 217L410 280M501 223L520 280" fill="none" stroke="#72553d" stroke-width="2" opacity=".6"/><path d="M0 8H600M15 20H585" stroke="#b5995f" stroke-width="5"/><path d="M15 30V220M585 30V220" stroke="#7d704b" stroke-width="8"/>${lounge?`<ellipse cx="398" cy="219" rx="103" ry="16" fill="#223a32" opacity=".6"/><ellipse cx="392" cy="140" rx="137" ry="123" fill="url(#leisure-glow)" opacity="${progress>=2?1:.35}"/>${progress>=2?'<path d="M100 14L352 224H482Z" fill="#f9dda6" opacity=".17"/>':''}${instrument(progress>=1)}<path d="M357 213H454" stroke="#b99761" stroke-width="4"/>${progress>=3?'<g fill="#dfc88c"><path d="M307 78V114Q292 107 290 119Q292 131 304 123L310 119V90L327 85V106Q312 100 311 113Q314 123 324 116L330 111V73Z"/><path d="M502 93V124Q489 120 489 131Q493 140 504 132L507 127V101L520 96V87Z"/></g>':''}`:'<path d="M20 36Q300 6 580 36" fill="none" stroke="#c3a96f" stroke-width="7"/><path d="M84 207H516L557 229H43Z" fill="#b89362" stroke="#6d5238" stroke-width="3"/><path d="M40 52V202M560 52V202" stroke="#c3a369" stroke-width="9"/><g fill="#d6c28c" opacity=".5"><path d="M177 55L181 64 191 66 183 73 185 83 176 78 168 83 169 73 162 66 172 64Z"/><path d="M414 93L417 99 425 101 419 106 420 114 414 110 407 114 409 106 403 101 410 99Z"/></g>'}`, '0 0 600 280').replace('<svg','<svg preserveAspectRatio="none"');
}
// Both the visible cue and the normalized gesture tests use these paths.
export const LEISURE_CUE_PATHS=Object.freeze({
 pluck:Object.freeze([[.22,.52],[.5,.52],[.79,.52]].map(Object.freeze)),
 conduct:Object.freeze([[.16,.45],[.49,.75],[.84,.3]].map(Object.freeze)),
 curtain:Object.freeze([[.23,.5],[.5,.5],[.85,.5]].map(Object.freeze)),
});
export function leisureMotionArt(gesture){
 const points=LEISURE_CUE_PATHS[gesture];if(!points)return '';
 const d=points.map(([x,y],i)=>`${i?'L':'M'}${x*100} ${y*100}`).join(' ');
 const [x,y]=points.at(-1),arrow=gesture==='conduct'?`M${x*100-12} ${y*100+1}L${x*100} ${y*100}L${x*100-2} ${y*100+12}`:`M${x*100-10} ${y*100-8}L${x*100} ${y*100}L${x*100-10} ${y*100+8}`;
 return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="#fff0af" stroke-width="2.6" stroke-dasharray="4 4" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="${arrow}" fill="none" stroke="#fff0af" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
export function leisurePerformerArt(performer='hedgehog',playing=false,release=''){
 const kind=performer==='deer'?'deer':'hedgehog',file=`assets/leisure/${kind}-${playing?'perform':'idle'}.webp${release?'?v='+encodeURIComponent(release):''}`;
 return playing?`<svg class="leisure-painted-performer performing" viewBox="0 0 384 384" role="img" aria-label="${kind==='deer'?'Deer singer':'Hedgehog musician'} performing"><image class="leisure-performance-frames" href="${file}" width="768" height="768"/></svg>`:`<img class="leisure-painted-performer" src="${file}" alt="${kind==='deer'?'Deer singer':'Hedgehog musician'}" draggable="false">`;
}
