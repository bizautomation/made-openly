// Port of reference/badges.html (SPEC.md 4.6). The functions below are copied
// unchanged so the output is byte-for-byte identical; test/node/badge.test.js
// checks this against the reference file itself. Do not edit by hand: change
// the reference first, then re-copy.
const INK="#1F2937",M="#0F766E",MD="#0A4F4A",H="#E39565",LIGHT="#F3F4F6",TD="#5EC4B6",OUT="#E5E7EB";
const LABELS=[["mostly-ai","Mostly AI",.85],["human-ai","Human + AI",.5],["human-only","Human only",0]];
const STYLES=["light","dark","clear-light","clear-dark"];
function robot(onDark){
  const hx0=35,hx1=65,hy0=60,hy1=88,R=4.5,deg=125,D=220,T=2.4,CX=50,CY=55,W=hx1-hx0,Hh=hy1-hy0,th=deg*Math.PI/180;
  const pts=[];for(const[cx,cy,a0,a1]of[[-W+R,R,180,270],[-R,R,270,360],[-R,Hh-R,0,90],[-W+R,Hh-R,90,180]])for(let k=0;k<=8;k++){const a=(a0+(a1-a0)*k/8)*Math.PI/180;pts.push([cx+R*Math.cos(a),cy+R*Math.sin(a)]);}
  const w=(u,v,o=0)=>[hx1+u*Math.cos(th)-o*Math.sin(th),hy0+v,-u*Math.sin(th)-o*Math.cos(th)];
  const p=([x,y,z])=>{const s=D/(D-z);return[CX+(x-CX)*s,CY+(y-CY)*s]};
  const P=q=>"M"+q.map(([a,b])=>a.toFixed(2)+","+b.toFixed(2)).join(" L")+" Z";
  const fr=pts.map(([u,v])=>p(w(u,v))),bk=pts.map(([u,v])=>p(w(u,v,T)));
  const ed=[R,Hh-R].map(v=>p(w(-W,v))).concat([Hh-R,R].map(v=>p(w(-W,v,T))));
  const kn=p(w(-W+5,Hh/2,-.6));const rim=onDark?` stroke="${OUT}" stroke-width="3"`:"";const ant=onDark?OUT:INK;
  return `<line x1="50" y1="6" x2="50" y2="16" stroke="${ant}" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="6" r="4" fill="${M}"/>`+
  `<rect x="24" y="16" width="52" height="34" rx="12" fill="${INK}"${rim}/><circle cx="40" cy="33" r="5" fill="#fff"/><circle cx="60" cy="33" r="5" fill="#fff"/>`+
  `<rect x="22" y="54" width="56" height="40" rx="10" fill="${INK}"${rim}/><rect x="${hx0}" y="${hy0}" width="${W}" height="${Hh}" rx="${R}" fill="#fff"/>`+
  `<path transform="translate(50,74.5) scale(1.15)" d="M0,8 C-12,0 -10,-10 -4,-8 C-2,-8 0,-6 0,-4 C0,-6 2,-8 4,-8 C10,-10 12,0 0,8 Z" fill="${H}"/>`+
  `<path d="${P(bk)}" fill="${MD}"/><path d="${P(ed)}" fill="${MD}"/><path d="${P(fr)}" fill="${M}"/><circle cx="${kn[0].toFixed(2)}" cy="${kn[1].toFixed(2)}" r="1.4" fill="#fff"/>`;
}
const txt=(x,y,s,sz,c,wt=600,ls=0,an="start")=>`<text x="${x}" y="${y}" text-anchor="${an}" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="${wt}" font-size="${sz}" letter-spacing="${ls}" fill="${c}">${s}</text>`;
const bar=(x,y,w,ai,h=3)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h/2}" fill="${H}"/>`+(ai>0?`<rect x="${x}" y="${y}" width="${(w*ai).toFixed(1)}" height="${h}" rx="${h/2}" fill="${M}"/>`:"");
function frame(w,h,rx,style,inner,title){
  const bg={light:`fill="#fff" stroke="${INK}" stroke-opacity="0.25"`,dark:`fill="${INK}" stroke="#fff" stroke-opacity="0.12"`,"clear-light":`fill="none" stroke="${INK}" stroke-opacity="0.3"`,"clear-dark":`fill="none" stroke="#fff" stroke-opacity="0.3"`}[style];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}"><title>${title}</title><rect x="0.5" y="0.5" width="${w-1}" height="${h-1}" rx="${rx}" ${bg}/>${inner}</svg>`;
}
function badge(size="large",style="light",label="human-ai",variant="robot"){
  const[,text,ai]=LABELS.find(l=>l[0]===label);const dk=style==="dark"||style==="clear-dark";const fg=dk?LIGHT:INK,mc=dk?TD:M;const t="Made Openly: "+text;
  if(size==="small"){const inner=variant==="robot"?`<svg x="2" y="4.5" width="22" height="22" viewBox="0 0 100 100">${robot(dk)}</svg>`+txt(25,17,text,10,fg)+bar(25,22,57,ai)
     :txt(44,11.5,"MADE OPENLY",6.8,mc,700,.6,"middle")+txt(44,22,text,9.5,fg,600,0,"middle")+bar(8,25.5,72,ai,2.5);return frame(88,31,5,style,inner,t);}
  const inner=variant==="robot"?`<svg x="6" y="7" width="48" height="48" viewBox="0 0 100 100">${robot(dk)}</svg>`+txt(58,20,"MADE OPENLY",9,mc,700,.8)+txt(58,38,text,16,fg)+bar(58,45,110,ai)
     :txt(88,21,"MADE OPENLY",11,mc,700,1.4,"middle")+txt(88,40,text,16,fg,600,0,"middle")+bar(16,48,144,ai);
  return frame(176,62,8,style,inner,t);
}

export const LABEL_SLUGS = LABELS.map((l) => l[0]);
export const SIZES = ["small", "large"];
export const VARIANTS = ["robot", "wordmark"];
export { INK, M, MD, H, LIGHT, TD, OUT, LABELS, STYLES, robot, txt, bar, frame, badge };

export const DIMENSIONS = { small: [88, 31], large: [176, 62] };

export function labelText(label) {
  return LABELS.find((l) => l[0] === label)[1];
}

// The robot on its own, for ./mascots/robot.svg.
export function mascotSvg(onDark = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">${robot(onDark)}</svg>`;
}

// Neutral badge for an unknown token (SPEC.md 8.2): "MADE OPENLY" only, no label, no bar.
export function neutralBadge(size = "large", style = "light") {
  const dk = style === "dark" || style === "clear-dark";
  const mc = dk ? TD : M;
  const t = "Made Openly";
  if (size === "small") return frame(88, 31, 5, style, txt(44, 19, "MADE OPENLY", 8, mc, 700, 0.6, "middle"), t);
  return frame(176, 62, 8, style, txt(88, 36, "MADE OPENLY", 13, mc, 700, 1.4, "middle"), t);
}

// Parse and validate badge settings; returns null if any value is unknown.
export function parseSettings({ label, style, size, variant }) {
  const s = {
    label: label ?? "human-ai",
    style: style ?? "light",
    size: size ?? "large",
    variant: variant ?? "robot",
  };
  if (!LABEL_SLUGS.includes(s.label) || !STYLES.includes(s.style) || !SIZES.includes(s.size) || !VARIANTS.includes(s.variant)) return null;
  return s;
}
