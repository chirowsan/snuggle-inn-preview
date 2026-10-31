// Small, painted storybook props and service scenes. All artwork is self-contained.
const paint = (name, body, viewBox = '0 0 120 100', fur = ['#dfba88', '#bf925f', '#8e6847']) => {
  const g = id => `url(#${name}-${id})`;
  const content = typeof body === 'function' ? body(g) : body;
  return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>
    <linearGradient id="${name}-bread" x1="0" y1="0" x2="0.2" y2="1"><stop stop-color="#ffe3a0"/><stop offset=".45" stop-color="#dfa258"/><stop offset="1" stop-color="#9c5d35"/></linearGradient>
    <radialGradient id="${name}-cream" cx=".4" cy=".3" r=".85"><stop stop-color="#fffbea"/><stop offset=".65" stop-color="#eadbb7"/><stop offset="1" stop-color="#baa57a"/></radialGradient>
    <linearGradient id="${name}-brass" x1="0" y1="0" x2=".2" y2="1"><stop stop-color="#fae3a3"/><stop offset=".3" stop-color="#c39755"/><stop offset=".5" stop-color="#f0d18b"/><stop offset=".76" stop-color="#a7773f"/><stop offset="1" stop-color="#d3b16b"/></linearGradient>
    <linearGradient id="${name}-copper" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ecc9a2"/><stop offset=".35" stop-color="#bd8860"/><stop offset=".6" stop-color="#9a6848"/><stop offset="1" stop-color="#d5a47c"/></linearGradient>
    <radialGradient id="${name}-red" cx=".32" cy=".26" r=".8"><stop stop-color="#e9a07b"/><stop offset=".5" stop-color="#c8634b"/><stop offset="1" stop-color="#934938"/></radialGradient>
    <radialGradient id="${name}-yolk" cx=".35" cy=".25" r=".8"><stop stop-color="#ffe98b"/><stop offset=".5" stop-color="#edbb4e"/><stop offset="1" stop-color="#ca8a30"/></radialGradient>
    <linearGradient id="${name}-green" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b5c395"/><stop offset=".5" stop-color="#7e9c76"/><stop offset="1" stop-color="#4e725b"/></linearGradient>
    <linearGradient id="${name}-tea" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e8c27b"/><stop offset="1" stop-color="#99623a"/></linearGradient>
    <linearGradient id="${name}-wall" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#eee4cc"/><stop offset="1" stop-color="#d4c6a8"/></linearGradient>
    <linearGradient id="${name}-wood" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#bd946d"/><stop offset="1" stop-color="#866447"/></linearGradient>
    <linearGradient id="${name}-fur" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${fur[0]}"/><stop offset=".5" stop-color="${fur[1]}"/><stop offset="1" stop-color="${fur[2]}"/></linearGradient>
    <linearGradient id="${name}-cloth" x1="0" y1="0" x2=".3" y2="1"><stop stop-color="#b7c6ae"/><stop offset=".5" stop-color="#8da78d"/><stop offset="1" stop-color="#64816e"/></linearGradient>
    <linearGradient id="${name}-mirror" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e8eeDF"/><stop offset=".5" stop-color="#b9cbc0"/><stop offset="1" stop-color="#d8dfcc"/></linearGradient>
  </defs>${content}</svg>`;
};
const shadow = '<ellipse cx="60" cy="84" rx="43" ry="8" fill="#654d3224"/>';
const plate = '<ellipse cx="60" cy="77" rx="49" ry="15" fill="#f0e7ce" stroke="#b7a77c" stroke-width="1.8"/><ellipse cx="60" cy="75" rx="39" ry="10" fill="none" stroke="#d6c8a7" stroke-width="1.5"/>';
const piping = (path, g, width = 16) => `<path d="${path}" fill="none" stroke="#755c43" stroke-width="${width + 3}" stroke-linejoin="round"/><path d="${path}" fill="none" stroke="${g('copper')}" stroke-width="${width}" stroke-linejoin="round"/><path d="${path}" fill="none" stroke="#f6ddba" stroke-width="3" stroke-linejoin="round" opacity=".65"/>`;

export const NEW_FOOD_ART = {
  toast: paint('toast', g => `${shadow}${plate}<path d="M27 70L24 33Q13 25 23 16Q38 3 59 13Q80 3 96 16Q107 27 96 34L94 70Q93 77 85 78H36Q28 77 27 70Z" fill="${g('bread')}" stroke="#925c33" stroke-width="2.5"/><path d="M34 65L31 30Q22 24 30 20Q43 13 59 21Q77 12 90 22Q96 26 88 31L87 66Q86 70 80 70H40Q35 70 34 65Z" fill="#edca83" stroke="#c58f4a" stroke-width="1.5"/><path d="M43 30L76 38 71 58 40 51Z" fill="#f9dfa0" stroke="#d9b971" stroke-width="1.5"/><path d="M44 31L70 37M42 35L68 41" stroke="#fff1bd" stroke-width="2"/><g fill="#c8944b" opacity=".65"><circle cx="38" cy="59" r="1.6"/><circle cx="80" cy="29" r="1.7"/><circle cx="77" cy="63" r="1.2"/><circle cx="48" cy="62" r="1.4"/><circle cx="35" cy="40" r="1"/></g>`),
  egg: paint('egg', g => `${shadow}${plate}<path d="M22 49Q13 36 30 27Q31 11 50 21Q66 10 79 23Q102 21 99 39Q111 53 95 66Q87 83 68 73Q46 84 35 70Q12 69 22 49Z" fill="${g('cream')}" stroke="#cdbd98" stroke-width="2"/><path d="M28 37Q32 27 44 29M25 56Q31 67 43 66M79 65Q91 64 95 54" fill="none" stroke="#fffdf1" stroke-width="4" stroke-linecap="round"/><ellipse cx="61" cy="45" rx="23" ry="20" fill="${g('yolk')}" stroke="#d8a340" stroke-width="1.4"/><path d="M48 39Q52 30 63 33" fill="none" stroke="#fff0a9" stroke-width="4" stroke-linecap="round"/><g fill="#9c855f"><circle cx="34" cy="52" r="1"/><circle cx="80" cy="33" r="1.2"/><circle cx="80" cy="60" r="1"/><circle cx="45" cy="67" r=".8"/></g>`),
  apple: paint('apple', g => `${shadow}<path d="M59 27Q31 9 18 35Q6 61 34 83Q48 94 61 84Q76 94 92 76Q113 52 98 32Q85 13 65 26Z" fill="${g('red')}" stroke="#914c37" stroke-width="2.5"/><path d="M62 28Q58 16 66 8" fill="none" stroke="#72543a" stroke-width="5" stroke-linecap="round"/><path d="M64 20Q77 1 93 13Q80 28 64 20Z" fill="${g('green')}" stroke="#648452" stroke-width="1.5"/><path d="M66 20L84 13" stroke="#c2d1a6" stroke-width="1.5"/><path d="M28 39Q24 51 29 61" fill="none" stroke="#f0b69a" stroke-width="6" stroke-linecap="round"/><path d="M54 28Q61 32 68 27M51 82Q60 78 68 83" fill="none" stroke="#a1553d" stroke-width="2"/>`),
  croissant: paint('croissant', g => `${shadow}<path d="M12 60Q11 37 35 30L45 17Q62 10 77 22L85 33Q113 42 106 66L92 75Q80 57 74 54Q60 48 46 56L28 76Z" fill="${g('bread')}" stroke="#9b642f" stroke-width="2.5"/><path d="M34 31Q27 47 31 64M46 20Q39 35 46 55M62 17Q55 30 62 51M77 25Q71 39 77 56M88 37Q85 48 93 64" fill="none" stroke="#a86732" stroke-width="4"/><path d="M20 49L28 40M49 25L55 22M68 26L73 31M94 44L100 52" stroke="#ffe0a2" stroke-width="4" stroke-linecap="round"/><path d="M40 32L42 37M57 23L58 28M82 38L83 42" stroke="#ffe6ac" stroke-width="1.5"/>`),
  tea: paint('tea', g => `<ellipse cx="56" cy="84" rx="48" ry="11" fill="#ddd0ad" stroke="#a78b59" stroke-width="2"/><ellipse cx="56" cy="83" rx="35" ry="6" fill="none" stroke="#f7eccd" stroke-width="2"/><path d="M87 32Q117 28 107 57Q99 72 86 62" fill="none" stroke="#b9a377" stroke-width="12"/><path d="M87 32Q117 28 107 57Q99 72 86 62" fill="none" stroke="#eadbb7" stroke-width="8"/><path d="M21 30H91L84 73Q56 88 28 73Z" fill="${g('cream')}" stroke="#b9a377" stroke-width="2"/><ellipse cx="56" cy="31" rx="35" ry="12" fill="#efe1be" stroke="#b9a377" stroke-width="2"/><ellipse cx="56" cy="32" rx="29" ry="8" fill="${g('tea')}"/><path d="M39 52Q56 61 76 50" fill="none" stroke="#8ca28a" stroke-width="3"/><path d="M45 20Q34 13 43 4M67 20Q56 12 65 3" fill="none" stroke="#fff9e8" stroke-width="3" opacity=".85"/>`),
  jam: paint('jam', g => `${shadow}<path d="M30 29H90L94 75Q94 85 60 87Q26 85 26 75Z" fill="#d6b887" stroke="#a48a60" stroke-width="2"/><path d="M32 38Q60 44 88 38L90 74Q87 81 60 81Q33 81 30 74Z" fill="${g('red')}" stroke="#a55845" stroke-width="1.5"/><path d="M34 30V75" fill="none" stroke="#ffead0" stroke-width="4" opacity=".55"/><path d="M26 18Q60 9 94 18L94 30Q60 39 26 30Z" fill="#a9b992" stroke="#718765" stroke-width="2"/><ellipse cx="60" cy="18" rx="34" ry="8" fill="#ccd6b4" stroke="#7c926b" stroke-width="2"/><path d="M32 23V29M42 25V31M53 26V33M65 26V33M77 25V31M88 23V29" stroke="#718765" stroke-width="2"/><path d="M39 49Q60 45 81 49V70Q61 75 39 70Z" fill="#f4e5bf" stroke="#d0b58a"/><path d="M50 57Q55 50 61 57Q70 52 73 60Q72 68 61 71Q49 66 50 57Z" fill="#bb614a"/><path d="M60 57L58 51 65 53" fill="none" stroke="#6c8b62" stroke-width="2"/>`),
  pancakes: paint('pancakes', g => `${shadow}${plate}<path d="M19 61Q17 73 60 77Q104 75 101 62L98 52H22Z" fill="#bf8547" stroke="#916036" stroke-width="2"/><ellipse cx="60" cy="60" rx="42" ry="13" fill="${g('bread')}" stroke="#a96f39" stroke-width="2"/><path d="M21 48V58Q63 76 100 58V48" fill="#d19a56" stroke="#a96f39" stroke-width="2"/><ellipse cx="60" cy="47" rx="40" ry="13" fill="#f1cf88" stroke="#af793f" stroke-width="2"/><path d="M24 35V46Q60 63 96 46V35" fill="#cf9652" stroke="#a96f39" stroke-width="2"/><ellipse cx="60" cy="35" rx="37" ry="13" fill="${g('bread')}" stroke="#a96f39" stroke-width="2"/><path d="M44 28Q55 23 71 28L82 35Q90 39 80 44L74 45V59Q70 65 67 58V46Q53 48 45 41L39 37Q33 33 44 28Z" fill="#a26933" opacity=".8"/><path d="M46 25L65 21 79 28 60 33Z" fill="#ffe7a1" stroke="#d2b469" stroke-width="1.5"/><path d="M46 25V31L60 39V33M60 39L79 33V28" fill="#eaca7d" stroke="#d2b469" stroke-width="1.5"/><path d="M30 55Q41 60 51 60M28 68Q39 73 51 73" fill="none" stroke="#f4d79d" stroke-width="2"/>`),
  banana: paint('banana', g => `${shadow}<path d="M25 27Q31 63 63 61Q87 59 96 26L102 29Q103 69 74 83Q41 97 21 69Q9 49 17 26Z" fill="${g('yolk')}" stroke="#ad8741" stroke-width="2.5"/><path d="M22 34Q16 67 46 79Q73 91 94 54" fill="none" stroke="#f9dd83" stroke-width="5"/><path d="M27 40Q38 69 68 67Q86 65 95 46" fill="none" stroke="#c49b47" stroke-width="2"/><path d="M17 26L15 17 23 15 27 29Z" fill="#8b7850" stroke="#6c6245" stroke-width="1.5"/><path d="M96 26L96 19 103 20 103 29Z" fill="#7d704b"/><path d="M42 83L47 85M64 80L67 80M26 58L27 61" stroke="#a9823f" stroke-width="1.5" stroke-linecap="round"/>`),
  milk: paint('milk', g => `${shadow}<path d="M45 17H75V31Q76 37 86 45L88 78Q88 86 60 87Q32 86 32 78L34 45Q44 37 45 31Z" fill="#e0ddc4" stroke="#a0ae9a" stroke-width="2"/><path d="M39 47Q60 51 81 47L83 76Q79 82 60 82Q41 82 37 76Z" fill="${g('cream')}"/><path d="M44 38Q39 43 39 57V73" fill="none" stroke="#fffdf2" stroke-width="4" stroke-linecap="round"/><path d="M45 12Q60 8 75 12L76 22Q60 26 44 22Z" fill="#a4b797" stroke="#738b6e" stroke-width="2"/><ellipse cx="60" cy="12" rx="15" ry="4" fill="#d0d9bb" stroke="#738b6e" stroke-width="1.5"/><path d="M46 54Q60 51 75 54V73Q61 78 46 73Z" fill="#9eb493" stroke="#7c9576"/><path d="M60 56Q46 68 60 72Q74 68 60 56Z" fill="#f8f1dc"/><path d="M48 15V21M54 16V23M61 16V23M68 16V22M73 15V21" stroke="#78906d" stroke-width="1.2"/>`),
  noodles: paint('noodles', g => `${shadow}${plate}<path d="M18 58Q29 22 58 28Q86 18 103 57L94 70Q61 83 26 68Z" fill="#d2ae6b" stroke="#ad8b4e" stroke-width="1.5"/><g fill="none" stroke="#f7dda0" stroke-width="4" stroke-linecap="round"><path d="M24 61Q30 35 48 37Q66 40 61 58Q57 72 75 67Q91 63 89 45"/><path d="M28 68Q20 42 41 33Q65 20 82 37Q91 47 81 58Q69 70 66 54Q61 36 49 47Q43 53 50 67"/><path d="M39 70Q29 54 42 45Q52 36 66 39Q83 43 76 53Q70 60 79 65Q97 73 99 55"/><path d="M34 57Q37 34 61 32Q85 29 96 48M55 74Q48 64 56 52M34 73Q21 66 27 50"/></g><g fill="none" stroke="#be9757" stroke-width="1.1" opacity=".8"><path d="M27 59Q34 38 46 40M44 70Q37 55 46 49M72 35Q91 37 86 52M59 71Q54 63 61 56"/></g><path d="M84 24L105 8M90 28L112 14" stroke="#8d6745" stroke-width="3.5" stroke-linecap="round"/>`),
  broth: paint('broth', g => `${shadow}<path d="M24 27Q49 16 79 26L87 37 81 76Q64 89 36 78Z" fill="${g('cream')}" stroke="#b49d72" stroke-width="2"/><path d="M78 37Q108 34 103 59Q96 76 81 66" fill="none" stroke="#baa279" stroke-width="10"/><path d="M78 37Q108 34 103 59Q96 76 81 66" fill="none" stroke="#ecddba" stroke-width="6"/><path d="M24 27L11 32 30 47Z" fill="#eadab4" stroke="#b49d72" stroke-width="2"/><ellipse cx="52" cy="28" rx="28" ry="9" fill="#d2bd8e" stroke="#b49d72" stroke-width="1.7"/><ellipse cx="52" cy="28" rx="23" ry="6" fill="${g('tea')}"/><path d="M38 47Q54 55 72 47M39 66Q55 73 72 65" fill="none" stroke="#9aaf8c" stroke-width="2.5"/><path d="M37 20Q29 12 36 5M57 17Q50 9 57 2" fill="none" stroke="#fff8e5" stroke-width="3" stroke-linecap="round"/><circle cx="48" cy="28" r="1.8" fill="#f0ce7e"/><circle cx="61" cy="26" r="1.2" fill="#f0ce7e"/>`),
  toppings: paint('toppings', g => `${shadow}${plate}<path d="M22 54L29 24 48 29 43 64Z" fill="#557567" stroke="#3f5e50" stroke-width="2"/><path d="M28 53L33 31M36 57L40 34" stroke="#829880" stroke-width="1.5"/><ellipse cx="69" cy="47" rx="21" ry="28" transform="rotate(29 69 47)" fill="${g('cream')}" stroke="#c2ac82" stroke-width="2"/><ellipse cx="68" cy="49" rx="13" ry="17" transform="rotate(29 68 49)" fill="${g('yolk')}" stroke="#d29a3a" stroke-width="1.5"/><path d="M67 39Q73 35 78 42" fill="none" stroke="#ffebac" stroke-width="3" stroke-linecap="round"/><g fill="#8ca883" stroke="#58795c" stroke-width="1.7"><ellipse cx="34" cy="68" rx="9" ry="5" transform="rotate(-23 34 68)"/><ellipse cx="49" cy="73" rx="9" ry="5" transform="rotate(24 49 73)"/><ellipse cx="83" cy="73" rx="9" ry="5" transform="rotate(-14 83 73)"/></g><g fill="#e5dbab"><ellipse cx="34" cy="68" rx="4" ry="2" transform="rotate(-23 34 68)"/><ellipse cx="49" cy="73" rx="4" ry="2" transform="rotate(24 49 73)"/><ellipse cx="83" cy="73" rx="4" ry="2" transform="rotate(-14 83 73)"/></g><path d="M91 39L98 61M97 36L104 58" stroke="#cf8867" stroke-width="5" stroke-linecap="round"/>`),
  'pipe-elbow': paint('pipe-elbow', g => `${shadow}${piping('M38 20V54Q38 68 54 68H94', g, 22)}<path d="M26 18H50V29H26ZM82 55H95V81H82Z" fill="${g('brass')}" stroke="#8a6b43" stroke-width="2"/><path d="M29 20V27M47 20V27M86 58V78M91 58V78" stroke="#e6c994" stroke-width="2"/><ellipse cx="38" cy="18" rx="12" ry="4" fill="#70583d" stroke="#b18b5f" stroke-width="2"/>`),
  'pipe-straight': paint('pipe-straight', g => `${shadow}${piping('M17 50H103', g, 22)}<path d="M17 36H30V64H17ZM90 36H103V64H90Z" fill="${g('brass')}" stroke="#8a6b43" stroke-width="2"/><path d="M21 39V61M27 39V61M94 39V61M100 39V61" stroke="#ead29c" stroke-width="2"/><path d="M38 44H82" stroke="#f6ddba" stroke-width="3" opacity=".7"/>`),
  'pipe-valve': paint('pipe-valve', g => `${shadow}${piping('M15 63H104', g, 19)}<path d="M17 51H29V75H17ZM91 51H103V75H91Z" fill="${g('brass')}" stroke="#8a6b43" stroke-width="2"/><path d="M47 54L53 45H69L76 54V73H47Z" fill="${g('brass')}" stroke="#89663f" stroke-width="2"/><path d="M61 47V31" stroke="#866240" stroke-width="8"/><ellipse cx="61" cy="26" rx="24" ry="14" fill="none" stroke="#8e4e3b" stroke-width="7"/><ellipse cx="61" cy="24" rx="24" ry="14" fill="none" stroke="#c47959" stroke-width="5"/><path d="M61 12V35M38 24H84M43 16L79 32M44 32L78 16" stroke="#a76045" stroke-width="3"/><circle cx="61" cy="24" r="5" fill="#e2be7c" stroke="#8e6b40" stroke-width="1.5"/>`)
};

export function ramenArt(steps = []) {
  const soup = steps.includes('broth'), noodles = steps.includes('noodles'), toppings = steps.includes('toppings');
  return paint('ramen', g => `<ellipse cx="200" cy="193" rx="142" ry="16" fill="#68523e20"/>
    <path d="M66 87Q73 162 143 186Q200 204 257 186Q328 160 334 87Z" fill="${g('cream')}" stroke="#a78c65" stroke-width="3"/>
    <path d="M88 134Q198 183 311 133L305 146Q199 190 96 147Z" fill="#8caa98"/>
    <path d="M98 153Q201 192 303 150" fill="none" stroke="#638472" stroke-width="3"/>
    <path d="M159 185L161 195Q200 206 240 194L242 185" fill="#d5c39a" stroke="#a78c65" stroke-width="2"/>
    <path d="M80 106Q87 130 106 145" fill="none" stroke="#fff6db" stroke-width="6" stroke-linecap="round" opacity=".8"/>
    <ellipse cx="200" cy="87" rx="134" ry="52" fill="#f5e8c9" stroke="#a78c65" stroke-width="3"/>
    <ellipse cx="200" cy="88" rx="120" ry="41" fill="${soup ? g('tea') : '#d8c8a4'}" stroke="#c0aa7f" stroke-width="2"/>
    ${soup ? `<path d="M92 83Q109 57 162 56M248 58Q296 62 309 83" fill="none" stroke="#f5d78d" stroke-width="3" opacity=".7"/><g fill="#f2d28e" opacity=".8"><ellipse cx="130" cy="94" rx="4" ry="2"/><ellipse cx="270" cy="102" rx="5" ry="2.5"/><ellipse cx="288" cy="82" rx="3" ry="1.6"/><ellipse cx="171" cy="118" rx="3" ry="1.5"/><ellipse cx="225" cy="61" rx="4" ry="2"/><ellipse cx="119" cy="75" rx="2.5" ry="1.5"/></g>` : '<ellipse cx="200" cy="90" rx="78" ry="22" fill="#ecdfc0"/><path d="M115 88Q137 61 191 62M224 112Q267 110 287 94" fill="none" stroke="#f9f1d8" stroke-width="4" opacity=".7"/>'}
    ${noodles ? `<path d="M119 93Q121 60 171 59Q215 45 264 68Q289 84 270 107Q232 132 159 117Z" fill="#dbb66d"/><g fill="none" stroke="#f7dda0" stroke-width="5" stroke-linecap="round"><path d="M123 92Q119 71 152 68Q195 59 209 77Q222 95 192 98Q169 100 168 84Q167 72 187 76Q206 81 194 88"/><path d="M139 108Q119 91 146 81Q162 76 160 92Q162 114 198 108Q232 103 220 80Q209 61 182 66"/><path d="M151 60Q185 47 215 62Q249 74 241 94Q234 112 207 115"/><path d="M223 61Q262 59 272 83Q281 101 247 112Q220 122 166 115"/><path d="M258 71Q242 70 249 84Q257 97 239 105M140 88Q131 100 155 105M156 70Q178 62 194 68"/></g><g fill="none" stroke="#c0924f" stroke-width="1.2"><path d="M128 91Q123 73 150 71M172 83Q171 77 184 79M215 66Q243 78 235 94M254 69Q273 76 269 90M143 110Q169 120 194 114"/></g>` : ''}
    ${toppings ? `<path d="M102 80L107 28 138 34 141 83Z" fill="#46675a" stroke="#3b594a" stroke-width="2"/><path d="M114 70L116 37M125 74L128 41M107 49L134 54" stroke="#799479" stroke-width="2" opacity=".65"/>
      <g transform="rotate(24 253 80)"><ellipse cx="253" cy="80" rx="31" ry="39" fill="${g('cream')}" stroke="#c3ad83" stroke-width="2"/><ellipse cx="252" cy="84" rx="20" ry="24" fill="${g('yolk')}" stroke="#ca9236" stroke-width="1.6"/><path d="M242 75Q250 65 260 73" fill="none" stroke="#ffedb2" stroke-width="4" stroke-linecap="round"/></g>
      <g fill="#87a77a" stroke="#507354" stroke-width="2"><ellipse cx="155" cy="91" rx="11" ry="6" transform="rotate(-26 155 91)"/><ellipse cx="182" cy="100" rx="10" ry="6" transform="rotate(18 182 100)"/><ellipse cx="205" cy="87" rx="10" ry="6" transform="rotate(-10 205 87)"/><ellipse cx="156" cy="113" rx="9" ry="5" transform="rotate(24 156 113)"/><ellipse cx="211" cy="112" rx="8" ry="5"/></g><g fill="#dfdda8"><ellipse cx="155" cy="91" rx="5" ry="2.7"/><ellipse cx="182" cy="100" rx="4.5" ry="2.5"/><ellipse cx="205" cy="87" rx="4" ry="2.5"/><ellipse cx="156" cy="113" rx="4" ry="2"/><ellipse cx="211" cy="112" rx="3.5" ry="2"/></g>
      <path d="M174 57L193 71M187 51L209 66M199 51L219 63" stroke="#c77f5d" stroke-width="7" stroke-linecap="round"/><path d="M173 55L191 68M186 49L207 63M198 49L217 60" stroke="#efba87" stroke-width="2" stroke-linecap="round"/>` : ''}
    ${soup ? '<g fill="none" stroke="#fff6dd" stroke-width="3" stroke-linecap="round" opacity=".65"><path d="M169 39Q156 25 168 9"/><path d="M207 32Q194 15 207 2"/><path d="M228 40Q237 27 229 15"/></g>' : ''}
    <path d="M303 50L355 12M311 58L366 20" stroke="#856446" stroke-width="6" stroke-linecap="round"/><path d="M305 48L352 14M313 56L363 22" stroke="#c29a6b" stroke-width="2" stroke-linecap="round"/>
  `, '0 0 400 220');
}

const wall = g => `<rect width="500" height="260" rx="18" fill="${g('wall')}"/><path d="M0 60H500M0 120H500M0 180H500M80 0V60M180 0V60M280 0V60M380 0V60M30 60V120M130 60V120M230 60V120M330 60V120M430 60V120M80 120V180M180 120V180M280 120V180M380 120V180" fill="none" stroke="#bdae8d" stroke-width="1" opacity=".25"/><path d="M0 224H500V260H0Z" fill="#b19a77"/><path d="M0 225H500M0 233H500" stroke="#d5c2a0" stroke-width="3"/>`;
const leaf = (x, y, rotation = 0, scale = 1) => `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})"><path d="M0 1Q-26-27-13-53Q15-37 0 1Z" fill="#7e9d79" stroke="#56765b" stroke-width="1.5"/><path d="M0 2L-10-39M-5-21L-16-31M-3-14L4-24" fill="none" stroke="#c0c9a0" stroke-width="1.2"/></g>`;

export const pipeBackdrop = paint('pipes-scene', g => `${wall(g)}
  <path d="M45 65H453V83H45Z" fill="${g('wood')}" stroke="#7c6248" stroke-width="2"/><path d="M51 83V223H70V83M431 83V223H449V83" fill="${g('wood')}" stroke="#7c6248" stroke-width="2"/>
  <path d="M69 57Q250 73 431 57L422 78Q250 103 78 78Z" fill="${g('cream')}" stroke="#ae9a75" stroke-width="2"/><ellipse cx="250" cy="57" rx="181" ry="20" fill="#f5ead0" stroke="#ad9b78" stroke-width="2"/><ellipse cx="250" cy="57" rx="132" ry="12" fill="#c8bea2" stroke="#b5a887" stroke-width="1.5"/><path d="M133 54Q250 39 371 55" fill="none" stroke="#fff7df" stroke-width="3"/><ellipse cx="250" cy="59" rx="10" ry="3" fill="#8a8770"/>
  <path d="M250 43V25Q250 13 264 13H280Q293 13 293 26V30" fill="none" stroke="#8d704a" stroke-width="12"/><path d="M250 43V25Q250 13 264 13H280Q293 13 293 26V30" fill="none" stroke="${g('brass')}" stroke-width="8"/><path d="M223 40H233M228 35V44M311 40H321M316 35V44" stroke="#b3945e" stroke-width="5" stroke-linecap="round"/>
  ${piping('M250 89V102H105V111', g, 13)}${piping('M151 135H222', g, 16)}${piping('M278 135H347', g, 16)}${piping('M403 135H423V181Q423 197 405 197H384', g, 16)}
  <g fill="#6f5a43" stroke="#c4a477" stroke-width="3"><ellipse cx="105" cy="111" rx="9" ry="3"/><ellipse cx="151" cy="135" rx="3" ry="10"/><ellipse cx="222" cy="135" rx="3" ry="10"/><ellipse cx="278" cy="135" rx="3" ry="10"/><ellipse cx="347" cy="135" rx="3" ry="10"/><ellipse cx="403" cy="135" rx="3" ry="10"/></g>
  <path d="M105 116V134H145M230 135H270M356 135H395" fill="none" stroke="#977e56" stroke-width="8" stroke-dasharray="3 5" opacity=".24"/>
  <path d="M95 199Q93 183 107 183H150Q164 184 162 199L154 223H103Z" fill="#9eae9b" stroke="#6e8778" stroke-width="2"/><ellipse cx="129" cy="197" rx="33" ry="10" fill="#c5cbb1" stroke="#779181" stroke-width="2"/><path d="M103 197Q128 188 155 197" fill="none" stroke="#8ba6a0" stroke-width="3"/><path d="M101 187Q99 168 128 168Q159 168 157 187" fill="none" stroke="#7c8170" stroke-width="3"/>
  <path d="M235 204L280 198 286 214 240 220Z" fill="#d6bd8c" stroke="#a68c62" stroke-width="1.5"/><path d="M245 208L275 204M247 214L278 210" stroke="#edddba" stroke-width="2"/>
`, '0 0 500 260');

export const fixtureBackdrop = paint('fixture-scene', g => `<rect width="500" height="260" rx="18" fill="${g('wall')}"/><g fill="none" stroke="#bcad8f" stroke-width="1" opacity=".27"><path d="M45 0V260M125 0V260M205 0V260M285 0V260M365 0V260M445 0V260"/><path d="M42 25Q25 43 42 61Q59 43 42 25M122 185Q105 203 122 221Q139 203 122 185M362 25Q345 43 362 61Q379 43 362 25M442 185Q425 203 442 221Q459 203 442 185"/></g>
  <ellipse cx="250" cy="138" rx="96" ry="100" fill="#e8d1a04d"/>
  <path d="M100 101H400Q413 116 400 133H100Q87 117 100 101Z" fill="${g('brass')}" stroke="#8d7048" stroke-width="2.5"/><path d="M107 106H393M107 128H393" stroke="#f2ddb0" stroke-width="2"/><path d="M113 112H387M113 123H387" stroke="#9d7c4e" stroke-width="1" opacity=".5"/>
  <circle cx="125" cy="117" r="15" fill="#997b51" stroke="#dcc18b" stroke-width="2"/><circle cx="250" cy="117" r="15" fill="#997b51" stroke="#dcc18b" stroke-width="2"/><circle cx="375" cy="117" r="15" fill="#997b51" stroke="#dcc18b" stroke-width="2"/>
  <path d="M227 135Q211 158 229 178Q250 200 277 175Q296 157 277 140" fill="none" stroke="#8d7048" stroke-width="15"/><path d="M227 135Q211 158 229 178Q250 200 277 175Q296 157 277 140" fill="none" stroke="${g('brass')}" stroke-width="10"/>
  <path d="M277 143V95" stroke="#826841" stroke-width="13"/><path d="M277 143V95" stroke="${g('brass')}" stroke-width="8"/>
  <path d="M256 41H298L323 89Q277 107 231 89Z" fill="${g('cream')}" stroke="#ae9366" stroke-width="2.5"/><path d="M256 42L246 89M266 42L263 96M287 42L290 96M298 42L308 90" stroke="#c4b28b" stroke-width="1.5"/><ellipse cx="277" cy="89" rx="46" ry="9" fill="#f6e8b8" stroke="#ad9469" stroke-width="2"/><ellipse cx="277" cy="42" rx="21" ry="5" fill="#bda174" stroke="#8c714c" stroke-width="1.5"/><path d="M273 36V32H281V36" fill="${g('brass')}" stroke="#8d7048" stroke-width="1.5"/>
  <path d="M316 95V159" fill="none" stroke="#9b7b4c" stroke-width="1.5"/><ellipse cx="316" cy="163" rx="4" ry="6" fill="${g('brass')}" stroke="#9b7b4c"/>
  <path d="M0 224H500V260H0Z" fill="${g('wood')}"/><path d="M0 224H500M0 231H500" stroke="#d3b386" stroke-width="3"/><path d="M61 216L79 202 93 210 75 224Z" fill="#899d8a" stroke="#667d6d" stroke-width="1.5"/><path d="M84 208L115 185" stroke="#b6935d" stroke-width="7" stroke-linecap="round"/><path d="M108 186L119 178 125 185 115 193Z" fill="#b3b6a1" stroke="#7d8778" stroke-width="1.5"/>
`, '0 0 500 260');

// Fur colors are applied only to the guest, never to the surrounding room.
const SERVICE_PALETTES = {
  guest: {
    fur: ['#fff1d5', '#e3d4b5', '#b9a582'],
    colors: {
      '#8b6845': '#a18d6d', '#e5c393': '#fff7e4', '#a47c50': '#b9a17b',
      '#99724d': '#a18d6d', '#edcea3': '#fff7e4', '#97714c': '#a18d6d',
      '#a47d53': '#b49f7d', '#e4c497': '#fff7e4', '#997148': '#aa9270',
      '#e5c08c': '#fff7e4', '#b18858': '#bca580', '#8b6540': '#a18b68',
      '#765334': '#9a8567', '#e3b982': '#f7e9ce', '#f0d09b': '#fffaeb'
    }
  },
  cat: {
    fur: ['#cbd0cb', '#9aa49f', '#727f79'],
    colors: {
      '#8b6845': '#606f68', '#e5c393': '#dce1d8', '#a47c50': '#71817a',
      '#99724d': '#606f68', '#edcea3': '#dce1d8', '#97714c': '#606f68',
      '#a47d53': '#697b72', '#e4c497': '#dce1d8', '#997148': '#62736b',
      '#e5c08c': '#dce1d8', '#b18858': '#7b8b82', '#8b6540': '#5f7067',
      '#765334': '#53685d', '#e3b982': '#bac7bd', '#f0d09b': '#e0e6dc'
    }
  },
  family: { fur: ['#dfba88', '#bf925f', '#8e6847'], colors: {} }
};
const servicePalette = spriteKind => {
  const key = Object.hasOwn(SERVICE_PALETTES, spriteKind) ? spriteKind : 'guest';
  const palette = SERVICE_PALETTES[key];
  return { ...palette, key, color: value => palette.colors[value] || value,
    name: base => key === 'family' ? base : `${base}-${key}` };
};
const salonEars = (g, p) => p.key === 'guest'
  ? `<path d="M190 86Q175 63 176 18Q176 3 187 3Q199 3 201 18L210 69M290 69L299 18Q301 3 313 3Q324 3 324 18Q325 63 310 86" fill="${g('fur')}" stroke="#a18d6d" stroke-width="2.5"/><path d="M190 69Q181 47 184 18Q187 10 191 19L200 61M300 61L309 19Q313 10 316 18Q319 47 310 69" fill="#dfbda8" stroke="#c2a18b" stroke-width="1.3"/>`
  : p.key === 'cat'
    ? `<path d="M154 104L147 47Q147 40 154 44L202 67M298 67L346 44Q353 40 353 47L346 104" fill="${g('fur')}" stroke="#606f68" stroke-width="2.5"/><path d="M162 85L158 56 184 72M316 72L342 56 338 85" fill="#bbada5" stroke="#8d8a81" stroke-width="1.3"/>`
    : `<path d="M149 102Q127 74 149 63Q174 53 184 79M314 79Q327 50 352 65Q369 80 347 103" fill="${g('fur')}" stroke="#846344" stroke-width="2.5"/><path d="M151 86Q140 73 152 70Q164 66 170 79M330 79Q337 65 349 73Q356 79 345 89" fill="#b67f62" stroke="#a37555" stroke-width="1.3"/>`;
const spaEars = (g, p) => p.key === 'guest'
  ? `<path d="M216 47Q193 34 184 13Q181 3 190 5Q217 10 234 34M266 34Q283 10 310 5Q319 3 316 13Q307 34 284 47" fill="${g('fur')}" stroke="#a18d6d" stroke-width="2"/><path d="M218 35Q201 24 194 14Q211 19 224 32M276 32Q289 19 306 14Q299 24 282 35" fill="#dfbda8" stroke="#c2a18b" stroke-width="1"/>`
  : p.key === 'cat'
    ? `<path d="M204 52L201 15Q201 9 207 13L234 30M266 30L293 13Q299 9 299 15L296 52" fill="${g('fur')}" stroke="#606f68" stroke-width="2"/><path d="M211 40L209 23 225 32M275 32L291 23 289 40" fill="#bbada5" stroke="#8d8a81" stroke-width="1"/>`
    : `<path d="M200 69Q183 57 190 41Q197 29 211 41M286 41Q303 28 311 44Q315 59 299 70" fill="${g('fur')}" stroke="#99724d" stroke-width="2"/>`;

function makeSalonBackdrop(spriteKind = 'family') {
  const p = servicePalette(spriteKind);
  return paint(p.name('salon-scene'), g => `<rect width="500" height="260" rx="18" fill="${g('wall')}"/><path d="M0 37H500M0 185H500" stroke="#c4b293" stroke-width="2"/><path d="M0 221H500V260H0Z" fill="${g('wood')}"/>
  <path d="M103 204V48Q104 11 144 11H354Q395 11 396 48V204Z" fill="${g('brass')}" stroke="#977b50" stroke-width="3"/><path d="M115 194V50Q115 24 146 24H352Q383 24 383 50V194Z" fill="${g('mirror')}" stroke="#c6b080" stroke-width="3"/>
  <path d="M131 54L165 31M136 80L200 31M349 177L373 155" stroke="#f7f6e3" stroke-width="7" opacity=".5"/><path d="M139 183Q145 160 172 158H328Q356 160 362 183" fill="#92a598" opacity=".55"/>
  <path d="M131 219Q132 185 163 174L207 161H292L337 174Q369 185 370 219Z" fill="${g('cloth')}" stroke="#5e7c69" stroke-width="2"/><path d="M165 186Q167 206 161 218M206 175L196 219M292 175L304 219M334 185L341 216" fill="none" stroke="#cad3ba" stroke-width="2" opacity=".5"/><path d="M215 166Q249 183 286 166L278 155H222Z" fill="#d6dcc8" stroke="#78907a" stroke-width="1.5"/>
  ${salonEars(g, p)}
  <path d="M154 101Q164 61 202 57Q226 42 249 54Q278 43 301 58Q339 62 347 103Q354 143 326 165Q300 183 250 186Q199 184 173 166Q146 146 154 101Z" fill="${g('fur')}" stroke="${p.color('#8b6845')}" stroke-width="2.5"/>
  <path d="M174 145Q191 168 217 172M324 145Q306 167 281 173M233 66Q250 57 266 67" fill="none" stroke="${p.color('#e5c393')}" stroke-width="3" stroke-linecap="round"/><path d="M182 153L177 142M317 152L323 141M237 169L243 174 250 170 257 175 264 169" fill="none" stroke="${p.color('#a47c50')}" stroke-width="2"/>
  <path d="M153 222Q151 200 175 196H326Q350 200 348 222L338 254H163Z" fill="#94775c" stroke="#68543e" stroke-width="3"/><path d="M165 208Q250 218 337 208" stroke="#baa080" stroke-width="3" fill="none"/><path d="M249 255V260" stroke="#857a5b" stroke-width="15"/>
  <path d="M36 215V175H66V215Z" fill="#c6bc98" stroke="#a0926b" stroke-width="2"/><ellipse cx="51" cy="175" rx="15" ry="5" fill="#ece0bd" stroke="#a0926b" stroke-width="1.5"/><path d="M42 181L36 145M51 181V140M60 181L65 146" stroke="#806649" stroke-width="4"/><path d="M34 143L39 143M48 138H54M63 144L68 145" stroke="#baa075" stroke-width="8" stroke-linecap="round"/>
  <path d="M420 214V182Q420 177 426 177H447Q453 177 453 183V214Z" fill="#90a28a" stroke="#647f68" stroke-width="2"/><path d="M431 176V166H443V176M437 166V159H452" fill="none" stroke="#c3ad79" stroke-width="4"/><path d="M428 190H446V204H428Z" fill="#e7d7ae"/><path d="M434 201Q428 190 438 188Q445 195 434 201Z" fill="#95a17c"/>
`, '0 0 500 260', p.fur);
}

function makeSpaBackdrop(spriteKind = 'family') {
  const p = servicePalette(spriteKind);
  return paint(p.name('spa-scene'), g => `<rect width="500" height="260" rx="18" fill="#d8d4b7"/><path d="M0 25H500M0 77H500M0 129H500M0 181H500M0 233H500M75 0V25M325 0V25M150 25V77M400 25V77M75 77V129M325 77V129M150 129V181M400 129V181M75 181V233M325 181V233" stroke="#a5a487" stroke-width="1.2" opacity=".35"/>
  <rect x="92" y="22" width="316" height="226" rx="39" fill="#766d5125"/><rect x="90" y="12" width="320" height="226" rx="39" fill="${g('wood')}" stroke="#927554" stroke-width="2"/><rect x="101" y="17" width="298" height="210" rx="32" fill="${g('cream')}" stroke="#c1b28e" stroke-width="2"/>
  <path d="M127 28Q250 37 373 28L381 70Q250 58 119 70Z" fill="#e9e5cd" stroke="#c2c1a2" stroke-width="1.5"/><path d="M132 33Q249 43 368 33M126 59Q250 49 375 59" stroke="#fff8e4" stroke-width="3" fill="none"/>
  ${spaEars(g, p)}<ellipse cx="250" cy="60" rx="48" ry="36" fill="${g('fur')}" stroke="${p.color('#99724d')}" stroke-width="2"/><path d="M224 39Q249 29 274 39" fill="none" stroke="${p.color('#edcea3')}" stroke-width="3"/>
  <path d="M218 83Q197 79 172 86Q139 96 129 119L118 163Q112 178 128 182Q142 184 147 168L159 139L168 183H332L341 139L353 168Q358 184 372 182Q388 178 382 163L371 119Q361 96 328 86Q302 79 282 83Z" fill="${g('fur')}" stroke="${p.color('#97714c')}" stroke-width="2.2"/>
  <path d="M249 93Q245 129 250 168" fill="none" stroke="${p.color('#a47d53')}" stroke-width="2.2" opacity=".65"/><path d="M213 96Q195 102 190 121M285 96Q304 102 309 121M146 126L134 164M354 126L366 164" fill="none" stroke="${p.color('#e4c497')}" stroke-width="3" stroke-linecap="round"/>
  <path d="M155 169Q250 181 345 169L357 220Q250 236 144 220Z" fill="${g('cloth')}" stroke="#6a876e" stroke-width="2"/><path d="M151 183Q249 196 350 183M148 190Q250 204 353 190" fill="none" stroke="#d1d9b9" stroke-width="3"/><path d="M169 205Q193 213 219 210M278 211Q306 214 331 205" fill="none" stroke="#aac09e" stroke-width="2"/>
  <ellipse cx="49" cy="211" rx="25" ry="13" fill="#a3a78b" stroke="#7d876f" stroke-width="1.5"/><path d="M27 209Q28 185 48 184Q70 186 71 209Z" fill="#c4baa0" stroke="#8e8b70" stroke-width="1.5"/><ellipse cx="48" cy="184" rx="10" ry="5" fill="#eadcb1" stroke="#b6a47e"/><path d="M48 180Q40 174 47 163Q56 174 48 180Z" fill="#eac788"/><path d="M49 178V182" stroke="#786c4f" stroke-width="1.5"/>
  <ellipse cx="444" cy="191" rx="26" ry="13" fill="#9c9d83"/><ellipse cx="432" cy="189" rx="16" ry="9" fill="#5c7469" stroke="#425d52" stroke-width="1.5"/><ellipse cx="453" cy="180" rx="18" ry="10" fill="#7d9081" stroke="#556f60" stroke-width="1.5"/><ellipse cx="444" cy="168" rx="14" ry="8" fill="#a4b09a" stroke="#708571" stroke-width="1.5"/><path d="M438 165Q444 162 450 165" stroke="#c5ceb4" stroke-width="2" fill="none"/>
  <path d="M34 105Q66 67 61 26M438 119Q429 74 463 28" fill="none" stroke="#71906d" stroke-width="3"/>
  ${leaf(42, 96, -37, .7)}${leaf(52, 75, 38, .65)}${leaf(59, 52, -20, .6)}${leaf(438, 110, 43, .7)}${leaf(443, 82, -36, .65)}${leaf(452, 55, 35, .6)}
`, '0 0 500 260', p.fur);
}

function makeTuftArt(done = false, spriteKind = 'family') {
  const p = servicePalette(spriteKind);
  return paint(p.name(`tuft-${done ? 'smooth' : 'tangled'}`), g => done
    ? `<path d="M20 68Q15 47 28 31Q36 13 60 17Q88 13 98 36Q109 54 96 72Q78 88 60 82Q36 89 20 68Z" fill="${g('fur')}" stroke="${p.color('#997148')}" stroke-width="2"/><g fill="none" stroke-linecap="round"><path d="M32 61Q28 37 47 28M43 72Q37 46 55 26M57 76Q50 48 65 26M71 73Q66 44 76 30M84 66Q84 47 86 39" stroke="${p.color('#e5c08c')}" stroke-width="3"/><path d="M35 63Q32 46 40 35M47 72Q42 50 50 37M62 74Q55 48 62 36M76 68Q72 50 77 39" stroke="${p.color('#b18858')}" stroke-width="1.5"/></g><path d="M95 13L98 21 106 24 98 27 95 35 92 27 84 24 92 21Z" fill="#f7e5b2" stroke="#c9ad71" stroke-width="1"/>`
    : `<path d="M20 72L11 61 21 52 11 37 28 34 26 18 43 24 51 9 64 23 80 11 85 28 103 26 98 43 111 55 98 64 103 80 83 78 73 90 59 81 41 90 35 77Z" fill="${g('fur')}" stroke="${p.color('#8b6540')}" stroke-width="2.3"/><g fill="none" stroke-linecap="round"><path d="M27 54Q13 35 36 35Q60 39 43 57Q29 71 48 73Q69 76 70 51Q69 27 52 37Q39 50 60 59Q84 74 88 51Q91 35 73 33" stroke="${p.color('#765334')}" stroke-width="5"/><path d="M32 28Q53 19 61 34Q71 50 51 57Q31 66 38 46Q48 27 67 46Q86 64 96 47M30 70Q20 55 36 49M64 76Q83 85 87 67" stroke="${p.color('#e3b982')}" stroke-width="4"/><path d="M32 27Q52 20 59 34M68 76Q83 82 85 68M72 32Q90 34 87 49" stroke="${p.color('#f0d09b')}" stroke-width="1.5"/></g>`, '0 0 120 100', p.fur);
}

export function fastenerArt(done = false) {
  return paint(`fastener-${done ? 'snug' : 'loose'}`, g => `<ellipse cx="60" cy="74" rx="29" ry="8" fill="#68503322"/>
    <g transform="rotate(${done ? 0 : -27} 60 50)">
    ${done ? '' : '<path d="M47 51L45 70Q60 79 75 70L73 51Z" fill="#9f7b49" stroke="#785c37" stroke-width="2"/><path d="M47 59Q60 67 73 59M46 66Q60 74 74 66" fill="none" stroke="#dec18a" stroke-width="2"/>'}
    <circle cx="60" cy="47" r="27" fill="${g('brass')}" stroke="#87643b" stroke-width="2.5"/><circle cx="60" cy="47" r="21" fill="none" stroke="#e9ce94" stroke-width="2"/><path d="M43 47H77" stroke="#785b34" stroke-width="6" stroke-linecap="round"/><path d="M44 46H76" stroke="#5f4b30" stroke-width="2.5" stroke-linecap="round"/><path d="M42 32Q52 23 64 27" fill="none" stroke="#fff0bf" stroke-width="3" stroke-linecap="round" opacity=".8"/></g>
    ${done ? '<path d="M93 16L95 23 103 25 95 28 93 35 90 28 83 25 90 23Z" fill="#f1deb1" stroke="#b79a62"/>' : ''}`);
}

export function tensionArt(done = false) {
  return paint(`tension-${done ? 'relaxed' : 'tense'}`, g => done
    ? `<ellipse cx="60" cy="54" rx="34" ry="27" fill="#b1c6a96b"/><path d="M39 69Q34 28 83 24Q87 62 39 69Z" fill="${g('green')}" stroke="#6f8c68" stroke-width="2"/><path d="M34 77L74 35M46 65L44 48M55 55L55 39M54 56L71 54M63 46L78 44" fill="none" stroke="#d5dcaf" stroke-width="2" stroke-linecap="round"/><path d="M22 42Q18 56 26 68M94 36Q101 50 95 66" fill="none" stroke="#adc19a" stroke-width="2" stroke-linecap="round"/>`
    : `<ellipse cx="60" cy="52" rx="36" ry="28" fill="#cd987e40"/><ellipse cx="60" cy="52" rx="27" ry="21" fill="#b9786240"/><ellipse cx="60" cy="52" rx="18" ry="14" fill="#ad695e30"/><ellipse cx="60" cy="52" rx="28" ry="22" fill="none" stroke="#b07863" stroke-width="2.2" stroke-dasharray="9 5"/><path d="M50 49Q56 43 62 49Q68 55 74 49M46 57Q52 51 58 57Q64 63 70 57" fill="none" stroke="#a66c59" stroke-width="2.8" stroke-linecap="round"/><path d="M20 43L24 46M96 62L101 66M84 23L87 18" stroke="#c79575" stroke-width="2.5" stroke-linecap="round"/>`);
}

// Legacy callers retain the original brown-bear artwork.
export const salonBackdrop = makeSalonBackdrop('family');
export const spaBackdrop = makeSpaBackdrop('family');
export function tuftArt(done = false) { return makeTuftArt(done, 'family'); }

// spriteKind matches the hotel actor keys: guest = rabbit, cat = cat, family = bear.
// Unknown guests safely use the default cream rabbit; unrelated service art is unchanged.
export function serviceBackdrop(kind, spriteKind = 'guest') {
  if (kind === 'salon') return makeSalonBackdrop(spriteKind);
  if (kind === 'spa') return makeSpaBackdrop(spriteKind);
  if (kind === 'pipe') return pipeBackdrop;
  if (kind === 'fixture') return fixtureBackdrop;
  return '';
}
export function serviceTargetArt(kind, done = false, spriteKind = 'guest') {
  if (kind === 'salon') return makeTuftArt(done, spriteKind);
  if (kind === 'spa') return tensionArt(done);
  if (kind === 'fixture') return fastenerArt(done);
  return '';
}
