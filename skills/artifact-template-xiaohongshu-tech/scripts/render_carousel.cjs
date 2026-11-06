#!/usr/bin/env node
'use strict';

/** JSON-driven, mobile-readable 3:4 editorial carousel renderer. */
const fs = require('node:fs');
const path = require('node:path');

const W = 1440, H = 1920, M = 96, CW = W - M * 2;
const DEFAULT_COLORS = {
  paper: '#F2F3ED', white: '#FFFFFF', ink: '#14241C', dark: '#101B17',
  dark2: '#192A22', muted: '#617064', soft: '#DDE3D8', line: '#CDD6C9',
  lime: '#BCED72', green: '#315A3B', lightGreen: '#E2ECD6', gray: '#AEBDB0'
};
const ICONS = new Set(['chip','folder','code','book','doc','clock','memory',
  'battery','search','check','share','app','spark']);
const LAYOUTS = new Set(['cover','cards','hub','process','roadmap','comparison']);
let Canvas, Sharp;

function dependency(name) {
  try { return require(name); }
  catch (normalError) {
    const root = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
    if (root) {
      try { return require(path.join(root, name)); }
      catch (fallbackError) {
        throw new Error(`Cannot load ${name} from normal Node resolution or CODEX_PRIMARY_RUNTIME_NODE_MODULES. Install it with npm. ${fallbackError.message}`);
      }
    }
    throw new Error(`Missing dependency ${name}. Install @napi-rs/canvas and sharp, or set CODEX_PRIMARY_RUNTIME_NODE_MODULES. ${normalError.message}`);
  }
}

function assert(condition, message) { if (!condition) throw new Error(message); }
function string(value, name, required = true) {
  assert(typeof value === 'string' && (!required || value.trim()), `${name} must be ${required ? 'a non-empty' : 'a'} string.`);
}
function integer(value, min, max, name) {
  assert(Number.isInteger(value) && value >= min && value <= max, `${name} must be an integer from ${min} to ${max}.`);
}
function strings(value, name, max = 6) {
  assert(Array.isArray(value) && value.length <= max, `${name} must be an array with at most ${max} strings.`);
  value.forEach((v, i) => string(v, `${name}[${i}]`));
}
function item(value, name) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${name} must be an object.`);
  string(value.title, `${name}.title`);
  if (value.body !== undefined) string(value.body, `${name}.body`, false);
  for (const key of ['eyebrow','tag','label']) if (value[key] !== undefined) string(value[key], `${name}.${key}`, false);
  if (value.icon !== undefined) assert(ICONS.has(value.icon), `${name}.icon must be one of: ${[...ICONS].join(', ')}.`);
}

function validateConfig(config) {
  assert(config && typeof config === 'object' && !Array.isArray(config), 'Input must be one JSON object.');
  assert(config.version === 1, 'Input version must be 1.');
  string(config.title, 'title');
  for (const key of ['brand','footer','overviewTitle']) if (config[key] !== undefined) string(config[key], key, false);
  if (config.bodySize !== undefined) integer(config.bodySize, 40, 44, 'bodySize');
  if (config.palette !== undefined) {
    assert(config.palette && typeof config.palette === 'object' && !Array.isArray(config.palette), 'palette must be an object.');
    for (const [key, color] of Object.entries(config.palette)) {
      assert(Object.hasOwn(DEFAULT_COLORS, key), `Unknown palette key: ${key}.`);
      assert(typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color), `palette.${key} must be #RRGGBB.`);
    }
  }
  assert(Array.isArray(config.pages) && config.pages.length >= 1 && config.pages.length <= 20, 'pages must contain 1–20 pages.');
  const ids = new Set();
  config.pages.forEach((p, i) => {
    const key = `pages[${i}]`;
    assert(p && typeof p === 'object' && !Array.isArray(p), `${key} must be an object.`);
    assert(LAYOUTS.has(p.layout), `${key}.layout must be one of: ${[...LAYOUTS].join(', ')}.`);
    string(p.id, `${key}.id`);
    assert(/^[a-z0-9][a-z0-9_-]{0,63}$/.test(p.id), `${key}.id must be a lowercase filename-safe slug.`);
    assert(!ids.has(p.id), `${key}.id duplicates another page id.`); ids.add(p.id);
    string(p.title, `${key}.title`);
    for (const field of ['subtitle','section','takeaway','source']) if (p[field] !== undefined) string(p[field], `${key}.${field}`, false);
    if (p.dark !== undefined) assert(typeof p.dark === 'boolean', `${key}.dark must be boolean.`);
    if (p.bodySize !== undefined) integer(p.bodySize, 40, 44, `${key}.bodySize`);
    if (p.titleSize !== undefined) integer(p.titleSize, 88, 112, `${key}.titleSize`);
    if (p.tags !== undefined) strings(p.tags, `${key}.tags`, 4);
    if (p.layout === 'cover') {
      assert(p.hero && typeof p.hero === 'object', `${key}.hero is required. Use {mode:"image",path:"assets/hero.png"}; choose mode:"diagram" explicitly for a schematic.`);
      assert(['image','diagram'].includes(p.hero.mode), `${key}.hero.mode must be image or diagram; there is no silent fallback.`);
      if (p.hero.mode === 'image') {
        string(p.hero.path, `${key}.hero.path`);
        if (p.hero.fit !== undefined) assert(['contain','cover'].includes(p.hero.fit), `${key}.hero.fit must be contain or cover.`);
      } else {
        string(p.hero.center, `${key}.hero.center`);
        strings(p.hero.labels, `${key}.hero.labels`, 3);
        assert(p.hero.labels.length === 3, `${key}.hero.labels must have exactly 3 labels.`);
      }
      if (p.caption !== undefined) string(p.caption, `${key}.caption`, false);
      if (p.accentLine !== undefined) integer(p.accentLine, 0, 2, `${key}.accentLine`);
    } else if (p.layout === 'cards') {
      assert(Array.isArray(p.items) && p.items.length >= 2 && p.items.length <= 4, `${key}.items must contain 2–4 cards.`);
      if (p.arrangement !== undefined) assert(['stack','grid','rows'].includes(p.arrangement), `${key}.arrangement must be stack, grid, or rows.`);
      p.items.forEach((v, j) => item(v, `${key}.items[${j}]`));
    } else if (p.layout === 'hub') {
      assert(Array.isArray(p.items) && p.items.length === 4, `${key}.items must contain exactly 4 branches.`);
      p.items.forEach((v, j) => item(v, `${key}.items[${j}]`));
      string(p.center, `${key}.center`);
    } else if (p.layout === 'process' || p.layout === 'roadmap') {
      const count = p.layout === 'process' ? 3 : 4;
      assert(Array.isArray(p.items) && p.items.length === count, `${key}.items must contain exactly ${count} steps.`);
      p.items.forEach((v, j) => item(v, `${key}.items[${j}]`));
      if (p.note !== undefined) string(p.note, `${key}.note`, false);
    } else if (p.layout === 'comparison') {
      assert(['shared','side-by-side'].includes(p.variant), `${key}.variant must be shared or side-by-side.`);
      assert(Array.isArray(p.items) && p.items.length === 2, `${key}.items must contain exactly 2 items.`);
      p.items.forEach((v, j) => item(v, `${key}.items[${j}]`));
      if (p.variant === 'shared') string(p.shared, `${key}.shared`);
      if (p.diagramCaption !== undefined) string(p.diagramCaption, `${key}.diagramCaption`, false);
      if (p.supporting !== undefined) {
        assert(Array.isArray(p.supporting) && p.supporting.length === 2, `${key}.supporting must contain exactly 2 cards.`);
        p.supporting.forEach((v, j) => item(v, `${key}.supporting[${j}]`));
      }
    }
  });
  return config;
}

function graphemes(text) {
  if (typeof Intl.Segmenter === 'function') return [...new Intl.Segmenter(undefined, {granularity:'grapheme'}).segment(text)].map(s => s.segment);
  return Array.from(text);
}

class Painter {
  constructor(config, pageConfig, index, audit) {
    this.config = config; this.p = pageConfig; this.index = index; this.audit = audit;
    this.C = {...DEFAULT_COLORS, ...(config.palette || {})};
    this.canvas = Canvas.createCanvas(W, H); this.ctx = this.canvas.getContext('2d');
    this.dark = pageConfig.dark === undefined ? pageConfig.layout === 'cover' : pageConfig.dark;
    this.fg = this.dark ? this.C.paper : this.C.ink;
    this.muted = this.dark ? this.C.gray : this.C.muted;
    this.body = pageConfig.bodySize || config.bodySize || 42;
    this.prefix = `pages[${index}].`;
  }
  issue(field, reason, detail = {}) { this.audit.overflow.push({page:this.index + 1, id:this.p.id, field:this.prefix + field, reason, ...detail}); }
  font(size, bold = false) { return `${size}px ${bold ? 'XHSBold' : 'XHSRegular'}`; }
  rect(x,y,w,h,fill,r=0,stroke=null,lw=2) {
    const c=this.ctx;c.beginPath();c.roundRect(x,y,w,h,r);
    if(fill){c.fillStyle=fill;c.fill();} if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}
  }
  line(x1,y1,x2,y2,color=this.C.line,lw=3) {
    const c=this.ctx;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=lw;c.lineCap='round';c.stroke();
  }
  circle(x,y,r,fill,stroke=null,lw=2) {
    const c=this.ctx;c.beginPath();c.arc(x,y,r,0,Math.PI*2);
    if(fill){c.fillStyle=fill;c.fill();} if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}
  }
  arrow(x1,y1,x2,y2,color=this.C.green,lw=4) {
    this.line(x1,y1,x2,y2,color,lw);
    const a=Math.atan2(y2-y1,x2-x1),s=14;
    this.line(x2,y2,x2-s*Math.cos(a-.6),y2-s*Math.sin(a-.6),color,lw);
    this.line(x2,y2,x2-s*Math.cos(a+.6),y2-s*Math.sin(a+.6),color,lw);
  }
  wrap(value,width,size,bold=false) {
    const c=this.ctx;c.font=this.font(size,bold);
    const result=[];
    for(const explicit of String(value).split('\n')) {
      const tokens=explicit.match(/[A-Za-z0-9][A-Za-z0-9._/+\-]*|\s+|[^\x00-\x7F]|./gu) || [''];
      let current='';
      const push=()=>{result.push(current.trimEnd());current='';};
      for(let token of tokens) {
        if(!current) token=token.trimStart();
        if(!token) continue;
        if(c.measureText(token).width>width) {
          if(current) push();
          for(const g of graphemes(token)) {
            if(current && c.measureText(current+g).width>width) push();
            current+=g;
          }
        } else if(current && c.measureText(current+token).width>width) {push();current=token.trimStart();}
        else current+=token;
      }
      result.push(current.trimEnd());
    }
    return result;
  }
  measure(value,box,opt={}) {
    const size=opt.size || this.body,bold=!!opt.bold,lh=opt.lineHeight || Math.round(size*1.36);
    const lines=opt.wrap===false?String(value).split('\n'):this.wrap(value,box.w,size,bold);
    this.ctx.font=this.font(size,bold);
    return {size,bold,lh,lines,height:lines.length*lh,width:Math.max(0,...lines.map(s=>this.ctx.measureText(s).width))};
  }
  text(field,value,box,opt={}) {
    if(value===undefined || value==='') return {bottom:box.y,height:0,lines:[]};
    const m=this.measure(value,box,opt),c=this.ctx;
    const safe=opt.safe===false?{x:0,y:0,w:W,h:H}:{x:M,y:0,w:CW,h:H};
    if(box.w<=0 || box.h<=0) this.issue(field,'invalid_text_box',{box});
    if(box.x<safe.x-.5 || box.x+box.w>safe.x+safe.w+.5 || box.y<0 || box.y+box.h>H) this.issue(field,'box_outside_page_safe_area',{box,safe});
    if(m.width>box.w+0.5 || m.height>box.h+0.5 || (opt.maxLines && m.lines.length>opt.maxLines)) {
      this.issue(field,'text_does_not_fit',{text:value,box,size:m.size,lineHeight:m.lh,lineCount:m.lines.length,width:m.width,height:m.height,maxLines:opt.maxLines || null});
    }
    c.font=this.font(m.size,m.bold);c.textBaseline='top';c.textAlign='left';c.fillStyle=opt.color || this.fg;
    const y0=box.y+(opt.valign==='middle'?(box.h-m.height)/2:0);
    const drawn=[];
    m.lines.forEach((s,i)=>{
      const width=c.measureText(s).width;
      const x=box.x+(opt.align==='center'?(box.w-width)/2:opt.align==='right'?box.w-width:0);
      c.fillText(s,x,y0+i*m.lh);
      drawn.push({text:s,x,y:y0+i*m.lh,width});
    });
    this.audit.textRecords.push({page:this.index+1,field:this.prefix+field,text:value,box,size:m.size,lineHeight:m.lh,lines:drawn});
    return {bottom:y0+m.height,height:m.height,lines:m.lines};
  }
  pill(field,label,x,y,opt={}) {
    const size=opt.size || 27,h=opt.h || 58,c=this.ctx,pad=opt.pad || 24;
    c.font=this.font(size,!!opt.bold);
    const width=Math.ceil(c.measureText(label).width+pad*2);
    if(x+width>W-M+.5) this.issue(field,'pill_outside_safe_area',{x,y,width,maxX:W-M});
    this.rect(x,y,width,h,opt.fill || this.C.lightGreen,h/2);
    this.text(field,label,{x:x+pad,y:y+(h-Math.round(size*1.3))/2,w:width-pad*2,h:Math.round(size*1.3)},
      {size,bold:!!opt.bold,color:opt.color || this.C.ink,wrap:false,lineHeight:Math.round(size*1.3),maxLines:1});
    return width;
  }
  tags(field,labels,x,y,opt={}) {
    let xx=x;
    (labels || []).forEach((s,i)=>{xx+=this.pill(`${field}[${i}]`,s,xx,y,opt)+16;});
    return labels && labels.length ? y+(opt.h || 58) : y;
  }
  icon(kind,x,y,s=74,color=this.C.green) {
    const c=this.ctx;c.save();c.translate(x,y);c.scale(s/80,s/80);c.strokeStyle=color;c.lineWidth=4;c.lineCap='round';c.lineJoin='round';
    const l=(a,b,d,e)=>this.line(a,b,d,e,color,4);
    if(kind==='chip') {
      this.rect(18,18,44,44,null,9,color,4);this.rect(30,30,20,20,null,4,color,3);
      for(const q of [27,40,53]){l(q,7,q,18);l(q,62,q,73);l(7,q,18,q);l(62,q,73,q);}
    } else if(kind==='folder') {
      c.beginPath();c.moveTo(10,26);c.lineTo(10,65);c.quadraticCurveTo(10,70,16,70);c.lineTo(67,70);c.quadraticCurveTo(72,70,72,64);c.lineTo(72,28);c.lineTo(39,28);c.lineTo(30,16);c.lineTo(15,16);c.quadraticCurveTo(10,16,10,21);c.stroke();l(15,39,67,39);
    } else if(kind==='code') {l(26,23,10,40);l(10,40,26,57);l(54,23,70,40);l(70,40,54,57);l(46,15,34,65);
    } else if(kind==='book') {c.beginPath();c.moveTo(40,20);c.quadraticCurveTo(26,9,9,16);c.lineTo(9,64);c.quadraticCurveTo(25,58,40,69);c.quadraticCurveTo(55,58,71,64);c.lineTo(71,16);c.quadraticCurveTo(54,9,40,20);c.lineTo(40,69);c.stroke();
    } else if(kind==='doc') {c.beginPath();c.moveTo(18,9);c.lineTo(49,9);c.lineTo(64,25);c.lineTo(64,71);c.lineTo(18,71);c.closePath();c.stroke();l(48,10,48,27);l(48,27,64,27);l(29,41,54,41);l(29,51,54,51);l(29,61,45,61);
    } else if(kind==='clock') {this.circle(40,40,29,null,color,4);l(40,21,40,40);l(40,40,55,49);
    } else if(kind==='memory') {this.rect(7,21,66,37,null,6,color,4);for(const xx of [17,34,51])this.rect(xx,30,11,17,null,2,color,3);for(const xx of [17,29,41,53,65])l(xx,59,xx,68);
    } else if(kind==='battery') {this.rect(10,23,56,34,null,7,color,4);this.rect(67,33,7,14,color,2);c.beginPath();c.moveTo(40,26);c.lineTo(29,43);c.lineTo(42,43);c.lineTo(33,56);c.stroke();
    } else if(kind==='search') {this.circle(33,32,22,null,color,4);l(49,49,70,70);l(22,38,30,29);l(30,29,37,35);l(37,35,45,22);
    } else if(kind==='check') {this.circle(40,40,30,null,color,4);l(23,41,35,53);l(35,53,58,28);
    } else if(kind==='share') {this.circle(18,40,9,null,color,4);this.circle(61,17,9,null,color,4);this.circle(61,63,9,null,color,4);l(27,35,52,22);l(27,45,52,58);
    } else if(kind==='app') {this.rect(10,10,60,60,null,12,color,4);for(const xx of [23,45])for(const yy of [23,45])this.rect(xx,yy,12,12,null,3,color,3);
    } else if(kind==='spark') {c.beginPath();c.moveTo(40,5);c.quadraticCurveTo(44,34,73,40);c.quadraticCurveTo(44,44,40,75);c.quadraticCurveTo(35,45,7,40);c.quadraticCurveTo(35,35,40,5);c.stroke();}
    c.restore();
  }
  base() {
    const C=this.C;
    this.rect(0,0,W,H,this.dark?C.dark:C.paper);
    this.rect(M,84,42,42,this.dark?C.lime:C.ink,12);
    this.line(M+12,105,M+30,105,this.dark?C.dark:C.lime,4);
    this.line(M+21,96,M+21,114,this.dark?C.dark:C.lime,4);
    this.text('brand',this.config.brand || '学习观察',{x:M+60,y:87,w:760,h:44},{size:29,bold:true,wrap:false,maxLines:1});
    this.text('section',this.p.section || '',{x:1004,y:91,w:340,h:38},{size:24,color:this.muted,align:'right',wrap:false,maxLines:1});
    this.line(M,1798,W-M,1798,this.dark?'#395044':C.line,2);
    this.text('footer',this.config.footer || '',{x:M,y:1820,w:950,h:46},{size:24,color:this.muted,wrap:false,maxLines:1});
    this.text('pageNumber',`${String(this.index+1).padStart(2,'0')} / ${String(this.config.pages.length).padStart(2,'0')}`,
      {x:1144,y:1816,w:200,h:46},{size:30,bold:true,align:'right',wrap:false,maxLines:1});
  }
  header() {
    const size=this.p.titleSize || 88;
    const t=this.text('title',this.p.title,{x:M,y:204,w:CW,h:280},{size,bold:true,lineHeight:Math.round(size*1.24),maxLines:2});
    let bottom=t.bottom;
    if(this.p.subtitle) bottom=this.text('subtitle',this.p.subtitle,{x:M,y:bottom+22,w:CW,h:120},
      {size:this.body,color:this.muted,lineHeight:Math.round(this.body*1.36),maxLines:2}).bottom;
    return {top:Math.max(574,bottom+38),bottom:this.p.takeaway?1474:1668};
  }
  ending() {
    if(this.p.takeaway) {
      const C=this.C,y=1512,h=164,fill=this.dark?C.lime:C.lightGreen;
      this.rect(M,y,CW,h,fill,28);this.rect(M+34,y+35,6,h-70,this.dark?C.ink:C.green,3);
      this.text('takeaway',this.p.takeaway,{x:M+66,y:y+20,w:CW-120,h:h-40},
        {size:46,bold:true,color:C.ink,lineHeight:60,maxLines:2,valign:'middle'});
    }
    this.text('source',this.p.source || '',{x:M,y:1714,w:CW,h:70},{size:23,color:this.muted,lineHeight:32,maxLines:2});
  }
  card(field,a,x,y,w,h,opt={}) {
    const C=this.C,dark=opt.dark === undefined?this.dark:opt.dark;
    const fg=dark?C.paper:C.ink,muted=dark?C.gray:C.muted,pad=34;
    this.rect(x,y,w,h,dark?C.dark2:C.white,30);
    let yy=y+pad;
    if(a.icon || a.eyebrow) {
      if(a.icon) this.icon(a.icon,x+pad,yy,70,dark?C.lime:C.green);
      if(a.eyebrow) this.text(`${field}.eyebrow`,a.eyebrow,{x:x+pad+(a.icon?88:0),y:yy+9,w:w-pad*2-(a.icon?88:0),h:42},
        {size:26,color:muted,align:a.icon?'right':'left',wrap:false,maxLines:1});
      yy+=98;
    }
    const titleSize=opt.titleSize || (w<800?44:58);
    const titleMaxLines=opt.titleMaxLines || 2;
    const titleH=Math.round(titleSize*1.25)*titleMaxLines;
    const tr=this.text(`${field}.title`,a.title,{x:x+pad,y:yy,w:w-pad*2,h:Math.min(titleH,h-(yy-y)-pad)},
      {size:titleSize,bold:true,color:fg,lineHeight:Math.round(titleSize*1.25),maxLines:titleMaxLines});
    yy=tr.bottom+24;
    if(a.body) this.text(`${field}.body`,a.body,{x:x+pad,y:yy,w:w-pad*2,h:y+h-pad-yy},
      {size:this.body,color:muted,lineHeight:Math.round(this.body*1.36)});
  }
  drawCards(area) {
    const p=this.p,n=p.items.length,arr=p.arrangement || (n===4?'grid':'stack');
    const gap=28,total=area.bottom-area.top;
    if(arr==='grid') {
      const rows=Math.ceil(n/2),w=(CW-gap)/2,h=(total-gap*(rows-1))/rows;
      p.items.forEach((a,i)=>this.card(`items[${i}]`,a,M+(i%2)*(w+gap),area.top+Math.floor(i/2)*(h+gap),w,h));
    } else if(arr==='rows') {
      const h=total/n;
      p.items.forEach((a,i)=>{
        const y=area.top+i*h,x=M+180,w=CW-180;
        this.line(M,y-12,W-M,y-12,this.dark?'#34483D':this.C.line,2);
        this.text(`items[${i}].number`,String(i+1).padStart(2,'0'),{x:M,y:y+10,w:140,h:90},{size:70,bold:true,color:this.dark?this.C.lime:this.C.green,lineHeight:88});
        const tr=this.text(`items[${i}].title`,a.title,{x,y:y+10,w,h:146},{size:58,bold:true,lineHeight:72,maxLines:2});
        const bodyY=tr.bottom+20,tagH=a.tag?76:0;
        const br=this.text(`items[${i}].body`,a.body || '',{x,y:bodyY,w,h:y+h-28-tagH-bodyY},{size:this.body,color:this.muted});
        if(a.tag) this.pill(`items[${i}].tag`,a.tag,x,br.bottom+16,{fill:this.dark?this.C.dark2:this.C.lightGreen,color:this.dark?this.C.lime:this.C.green,size:27,h:56});
      });
    } else {
      const h=(total-gap*(n-1))/n;
      p.items.forEach((a,i)=>{
        const y=area.top+i*(h+gap);
        if(n>=3 && a.icon) {
          this.rect(M,y,CW,h,this.dark?this.C.dark2:this.C.white,30);
          this.circle(M+104,y+h/2,62,this.C.lime);this.icon(a.icon,M+66,y+h/2-38,76,this.C.ink);
          const tr=this.text(`items[${i}].title`,a.title,{x:M+220,y:y+30,w:CW-260,h:138},{size:54,bold:true,lineHeight:67,maxLines:2});
          this.text(`items[${i}].body`,a.body || '',{x:M+220,y:tr.bottom+18,w:CW-260,h:y+h-28-tr.bottom-18},{size:this.body,color:this.muted});
        } else this.card(`items[${i}]`,a,M,y,CW,h,{titleSize:n===2?64:54,titleMaxLines:1});
      });
    }
  }
  drawHub(area) {
    const C=this.C,p=this.p;
    let top=area.top;
    if(p.tags?.length) {this.tags('tags',p.tags,M,top,{fill:this.dark?C.dark2:C.white,color:this.fg,size:27,h:60});top+=124;}
    const h=242,w=480,bottom=area.bottom-48,cx=W/2,cy=(top+bottom)/2,r=154;
    const positions=[{x:M,y:top},{x:W-M-w,y:top},{x:M,y:bottom-h},{x:W-M-w,y:bottom-h}];
    if(bottom-top<620) this.issue('items','hub_area_too_short',{top,bottom,minimumHeight:620});
    positions.forEach(a=>this.line(a.x<W/2?a.x+w:a.x,a.y+h/2,cx,cy,this.dark?'#34483D':C.line,4));
    this.circle(cx,cy,r,this.dark?C.dark2:C.ink);this.circle(cx,cy,r+22,null,this.dark?'#34483D':C.line,2);
    this.icon('spark',cx-40,cy-110,80,C.lime);
    this.text('center',p.center,{x:cx-r+22,y:cy-4,w:r*2-44,h:130},{size:46,bold:true,color:C.paper,align:'center',lineHeight:62,maxLines:2});
    p.items.forEach((a,i)=>{
      const b=positions[i];this.rect(b.x,b.y,w,h,this.dark?C.dark2:C.white,28);
      if(a.icon) this.icon(a.icon,b.x+26,b.y+26,62,this.dark?C.lime:C.green);
      const tx=b.x+(a.icon?108:30),tw=w-(a.icon?138:60);
      this.text(`items[${i}].title`,a.title,{x:tx,y:b.y+28,w:tw,h:60},{size:42,bold:true,maxLines:1});
      this.text(`items[${i}].body`,a.body || '',{x:b.x+30,y:b.y+122,w:w-60,h:94},{size:this.body,color:this.muted,lineHeight:55,maxLines:1});
    });
  }
  drawProcess(area) {
    const C=this.C,p=this.p,gap=42,w=(CW-gap*2)/3;
    const extra=p.note || p.tags?.length ? 176 : 0;
    const h=area.bottom-area.top-extra;
    p.items.forEach((a,i)=>{
      const x=M+i*(w+gap),y=area.top,highlight=i===1;
      this.rect(x,y,w,h,highlight?C.ink:(this.dark?C.dark2:C.white),30);
      const fg=highlight?C.paper:this.fg,mut=highlight?C.gray:this.muted;
      this.text(`items[${i}].number`,String(i+1).padStart(2,'0'),{x:x+30,y:y+30,w:100,h:46},{size:27,bold:true,color:highlight?C.lime:C.green,wrap:false,maxLines:1});
      this.icon(a.icon || ['search','code','check'][i],x+w/2-60,y+136,120,highlight?C.lime:C.green);
      const tr=this.text(`items[${i}].title`,a.title,{x:x+30,y:y+316,w:w-60,h:128},{size:50,bold:true,color:fg,align:'center',lineHeight:64,maxLines:2});
      this.text(`items[${i}].body`,a.body || '',{x:x+36,y:tr.bottom+26,w:w-72,h:y+h-36-tr.bottom-26},{size:this.body,color:mut,lineHeight:62});
      if(i<2)this.arrow(x+w+8,y+h/2,x+w+gap-8,y+h/2,C.green,4);
    });
    let y=area.top+h+40;
    if(p.note) {const r=this.text('note',p.note,{x:M,y,w:CW,h:60},{size:this.body,color:this.muted,maxLines:1});y=r.bottom+16;}
    this.tags('tags',p.tags || [],M,y,{size:30,h:62,fill:this.dark?C.dark2:C.lightGreen,color:this.dark?C.lime:C.ink});
  }
  drawRoadmap(area) {
    const p=this.p,C=this.C,row=(area.bottom-area.top)/4,cx=M+47;
    this.line(cx,area.top+46,cx,area.top+3*row+48,this.dark?'#3A5141':C.line,4);
    p.items.forEach((a,i)=>{
      const y=area.top+i*row;this.circle(cx,y+46,47,C.lime);
      this.text(`items[${i}].number`,String(i+1).padStart(2,'0'),{x:cx-43,y:y+20,w:86,h:50},{size:35,bold:true,color:C.ink,align:'center',lineHeight:46,maxLines:1});
      const x=M+146,w=CW-146,tr=this.text(`items[${i}].title`,a.title,{x,y:y+2,w,h:138},{size:54,bold:true,lineHeight:68,maxLines:2});
      this.text(`items[${i}].body`,a.body || '',{x,y:tr.bottom+26,w,h:y+row-26-tr.bottom-26},{size:this.body,color:this.muted});
    });
  }
  drawComparison(area) {
    const p=this.p,C=this.C;
    if(p.variant==='side-by-side') {
      const gap=34,w=(CW-gap)/2,h=area.bottom-area.top;
      p.items.forEach((a,i)=>this.card(`items[${i}]`,a,M+i*(w+gap),area.top,w,h,{titleSize:58}));return;
    }
    const supportH=p.supporting?282:0,gap=p.supporting?28:0,diagramH=area.bottom-area.top-supportH-gap;
    const y=area.top;this.rect(M,y,CW,diagramH,this.dark?C.dark2:C.white,32);
    let headingBottom=y+36;
    if(p.diagramCaption) headingBottom=this.text('diagramCaption',p.diagramCaption,{x:M+40,y:y+36,w:CW-80,h:116},{size:this.body,color:this.muted,maxLines:2}).bottom;
    const nodeW=330,nodeH=130,leftX=M+151,rightX=W-M-151-nodeW;
    const nodeY=Math.max(y+142,headingBottom+44),barY=nodeY+nodeH+58;
    if(barY+100+30>y+diagramH) this.issue('shared','shared_diagram_does_not_fit',{diagramH,requiredHeight:barY+130-y});
    p.items.forEach((a,i)=>{
      const x=i?rightX:leftX;this.rect(x,nodeY,nodeW,nodeH,C.ink,24);
      this.text(`items[${i}].title`,a.title,{x:x+20,y:nodeY+22,w:nodeW-40,h:90},{size:58,bold:true,color:i?C.lime:C.paper,align:'center',lineHeight:76,maxLines:1});
      this.line(x+nodeW/2,nodeY+nodeH,x+nodeW/2,barY,C.green,5);
    });
    this.rect(leftX,barY,rightX+nodeW-leftX,100,C.lime,20);
    this.text('shared',p.shared,{x:leftX+26,y:barY+20,w:rightX+nodeW-leftX-52,h:62},{size:42,bold:true,color:C.ink,align:'center',maxLines:1});
    if(p.supporting) {
      const sy=y+diagramH+gap,sw=(CW-34)/2;
      p.supporting.forEach((a,i)=>{
        const sx=M+i*(sw+34);this.rect(sx,sy,sw,supportH,this.dark?C.dark2:C.white,28);
        if(a.icon)this.icon(a.icon,sx+26,sy+30,60,this.dark?C.lime:C.green);
        const tx=sx+(a.icon?108:34),tw=sw-(a.icon?140:68);
        const tr=this.text(`supporting[${i}].title`,a.title,{x:tx,y:sy+36,w:tw,h:60},{size:40,bold:true,maxLines:1});
        this.text(`supporting[${i}].body`,a.body || '',{x:sx+34,y:Math.max(sy+126,tr.bottom+20),w:sw-68,h:122},{size:this.body,color:this.muted,lineHeight:56,maxLines:2});
      });
    }
  }
  async drawCover(inputDir) {
    const p=this.p,C=this.C,size=p.titleSize || 106,lh=Math.round(size*1.31);
    const titleLines=this.wrap(p.title,CW,size,true);
    if(titleLines.length>3)this.issue('title','cover_title_exceeds_three_lines',{lineCount:titleLines.length});
    titleLines.forEach((s,i)=>this.text(`title.line[${i}]`,s,{x:M,y:204+i*lh,w:CW,h:lh},
      {size,bold:true,color:i===(p.accentLine??titleLines.length-1)?C.lime:this.fg,lineHeight:lh,maxLines:1,wrap:false}));
    const subY=204+titleLines.length*lh+32;
    const sub=this.text('subtitle',p.subtitle || '',{x:M,y:subY,w:CW,h:118},{size:this.body,color:this.muted,lineHeight:57,maxLines:2});
    const heroBox={x:M,y:Math.max(804,sub.bottom+34),w:CW,h:0};heroBox.h=1538-heroBox.y;
    if(heroBox.h<480)this.issue('hero','cover_header_leaves_too_little_hero_space',{heroBox,minimumHeight:480});
    if(p.hero.mode==='image') {
      const imagePath=path.resolve(inputDir,p.hero.path);
      assert(fs.existsSync(imagePath) && fs.statSync(imagePath).isFile(), `Missing cover hero: ${imagePath}. Generate the image first, or explicitly choose hero.mode="diagram".`);
      const image=await Canvas.loadImage(imagePath),fit=p.hero.fit || 'contain';
      const scale=fit==='cover'?Math.max(heroBox.w/image.width,heroBox.h/image.height):Math.min(heroBox.w/image.width,heroBox.h/image.height);
      const dw=image.width*scale,dh=image.height*scale;
      const c=this.ctx;c.save();c.beginPath();c.roundRect(heroBox.x,heroBox.y,heroBox.w,heroBox.h,32);c.clip();
      this.rect(heroBox.x,heroBox.y,heroBox.w,heroBox.h,this.dark?C.dark2:C.lightGreen);
      c.drawImage(image,heroBox.x+(heroBox.w-dw)/2,heroBox.y+(heroBox.h-dh)/2,dw,dh);c.restore();
      this.audit.images.push({page:this.index+1,path:imagePath,fit,box:heroBox});
    } else {
      this.drawCoverDiagram(heroBox,p.hero);
      this.audit.images.push({page:this.index+1,mode:'diagram',illustrationStyle:p.hero.illustrationStyle || 'Explicit programmatic schematic',box:heroBox});
    }
    this.text('caption',p.caption || '',{x:M,y:1572,w:CW,h:72},{size:48,bold:true,lineHeight:65,maxLines:1});
    this.tags('tags',p.tags || [],M,1668,{size:27,h:58,fill:this.dark?C.dark2:C.lightGreen,color:this.dark?C.lime:C.ink});
    if(p.source)this.text('source',p.source,{x:M,y:1740,w:CW,h:36},{size:23,color:this.muted,lineHeight:32,maxLines:1});
  }
  drawCoverDiagram(b,hero) {
    const C=this.C,cx=b.x+b.w/2,cy=b.y+b.h*.43;
    this.rect(b.x,b.y,b.w,b.h,this.dark?C.dark2:C.lightGreen,32);
    this.circle(cx,cy,182,null,this.dark?'#3A5141':C.line,3);
    this.circle(cx,cy,148,C.ink);
    this.icon('spark',cx-43,cy-116,86,C.lime);
    this.text('hero.center',hero.center,{x:cx-123,y:cy+2,w:246,h:96},{size:44,bold:true,color:C.paper,align:'center',lineHeight:58,maxLines:1});
    const gap=24,w=(b.w-96-gap*2)/3,y=b.y+b.h-162;
    hero.labels.forEach((label,i)=>{
      const x=b.x+48+i*(w+gap);
      this.line(cx,cy+148,x+w/2,y,this.dark?'#4F6C55':C.green,3);
      this.rect(x,y,w,96,i===1?C.lime:(this.dark?C.dark:C.white),22);
      this.text(`hero.labels[${i}]`,label,{x:x+18,y:y+20,w:w-36,h:62},{size:40,bold:true,color:i===1?C.ink:this.fg,align:'center',maxLines:1});
    });
  }
  async render(inputDir) {
    this.base();
    if(this.p.layout==='cover')await this.drawCover(inputDir);
    else {
      const area=this.header();
      if(area.top>=area.bottom)this.issue('title','header_consumes_content_area',{area});
      const fn={cards:'drawCards',hub:'drawHub',process:'drawProcess',roadmap:'drawRoadmap',comparison:'drawComparison'}[this.p.layout];
      this[fn](area);this.ending();
    }
    return this.canvas.toBuffer('image/png');
  }
}

async function overview(config, rendered, output) {
  const gap=24,thumbW=432,thumbH=576,columns=Math.min(3,rendered.length),rows=Math.ceil(rendered.length/columns),top=152;
  const canvas=Canvas.createCanvas(columns*thumbW+(columns+1)*gap,rows*thumbH+(rows+1)*gap+top);
  const c=canvas.getContext('2d'),colors={...DEFAULT_COLORS,...(config.palette || {})};
  c.fillStyle='#E6E9E0';c.fillRect(0,0,canvas.width,canvas.height);c.textBaseline='top';
  const title=config.overviewTitle || `${config.title}｜${rendered.length} 张图文`;
  c.font='40px XHSBold';c.fillStyle=colors.ink;
  let line='',lines=[];
  for(const g of graphemes(title)) {if(line && c.measureText(line+g).width>canvas.width-gap*2){lines.push(line);line=g;}else line+=g;}
  lines.push(line);
  assert(lines.length<=2, 'overviewTitle is too long for a two-line overview heading; shorten it.');
  lines.forEach((s,i)=>c.fillText(s,gap,24+i*48));
  c.font='24px XHSRegular';c.fillStyle=colors.muted;
  c.fillText(`1440 × 1920 · 3:4 · ${rendered.length} pages`,gap,122);
  for(let i=0;i<rendered.length;i++) {
    const im=await Canvas.loadImage(rendered[i].png);
    c.drawImage(im,gap+(i%columns)*(thumbW+gap),top+gap+Math.floor(i/columns)*(thumbH+gap),thumbW,thumbH);
  }
  const dest=path.join(output,'overview.png');fs.writeFileSync(dest,canvas.toBuffer('image/png'));return dest;
}

async function renderCarousel(config, options) {
  const out=path.resolve(options.output),inputDir=path.resolve(options.inputDir || process.cwd());
  fs.mkdirSync(out,{recursive:true});
  const audit={version:1,status:'validating',pages:Array.isArray(config.pages)?config.pages.length:0,
    dimensions:{width:W,height:H,margin:M,aspectRatio:'3:4'},overflow:[],textRecords:[],images:[],files:[],overview:null,errors:[]};
  const auditPath=path.join(out,'layout_audit.json');
  const writeAudit=()=>fs.writeFileSync(auditPath,JSON.stringify(audit,null,2)+'\n');
  try {
    validateConfig(config);
    for(const [key,value] of [['fontRegular',options.fontRegular],['fontBold',options.fontBold]]) {
      assert(value, `Provide --${key==='fontRegular'?'font-regular':'font-bold'} or ${key==='fontRegular'?'XHS_FONT_REGULAR':'XHS_FONT_BOLD'}.`);
      assert(fs.existsSync(path.resolve(value)), `Font file does not exist: ${value}`);
    }
    Canvas=dependency('@napi-rs/canvas');Sharp=dependency('sharp');
    assert(Canvas.GlobalFonts.registerFromPath(path.resolve(options.fontRegular),'XHSRegular'), 'Unable to register the regular font.');
    assert(Canvas.GlobalFonts.registerFromPath(path.resolve(options.fontBold),'XHSBold'), 'Unable to register the bold font.');
    const rendered=[];
    for(let i=0;i<config.pages.length;i++) {
      const p=new Painter(config,config.pages[i],i,audit);
      rendered.push({id:config.pages[i].id,layout:config.pages[i].layout,png:await p.render(inputDir)});
    }
    if(audit.overflow.length) {
      audit.status='failed';writeAudit();
      const err=new Error(`Layout failed: ${audit.overflow.length} overflow issue(s). Shorten or reflow the flagged text; fonts were not reduced. Audit: ${auditPath}`);
      err.exitCode=2;throw err;
    }
    const pngDir=path.join(out,'02_lossless_PNG'),jpgDir=path.join(out,'01_ready_to_post_JPG');
    fs.mkdirSync(pngDir,{recursive:true});fs.mkdirSync(jpgDir,{recursive:true});
    audit.status='saving';
    for(let i=0;i<rendered.length;i++) {
      const r=rendered[i],name=`${String(i+1).padStart(2,'0')}_${r.id}`;
      const pngPath=path.join(pngDir,name+'.png'),jpgPath=path.join(jpgDir,name+'.jpg');
      fs.writeFileSync(pngPath,r.png);
      await Sharp(r.png).flatten({background:config.palette?.paper || DEFAULT_COLORS.paper}).jpeg({quality:96,chromaSubsampling:'4:4:4'}).toFile(jpgPath);
      audit.files.push({index:i+1,name,layout:r.layout,pngPath,jpgPath,width:W,height:H});
    }
    audit.overview=await overview(config,rendered,out);audit.status='passed';writeAudit();
    return {pages:audit.pages,overflow:0,output:out,overview:audit.overview,audit:auditPath,files:audit.files};
  } catch(error) {
    audit.status='failed';audit.errors.push(error.message);writeAudit();throw error;
  }
}

function parseArgs(argv) {
  const result={};
  for(let i=0;i<argv.length;i++) {
    const a=argv[i];if(a==='--help' || a==='-h'){result.help=true;continue;}
    assert(['--input','--output','--font-regular','--font-bold'].includes(a), `Unknown argument: ${a}`);
    assert(i+1<argv.length && !argv[i+1].startsWith('--'), `Missing value for ${a}.`);
    const key={'--input':'input','--output':'output','--font-regular':'fontRegular','--font-bold':'fontBold'}[a];
    assert(result[key]===undefined, `Duplicate argument: ${a}`);result[key]=argv[++i];
  }
  return result;
}
async function main() {
  const args=parseArgs(process.argv.slice(2));
  if(args.help) {
    console.log('Usage: node render_carousel.cjs --input post.json --output output-dir --font-regular font.otf --font-bold bold.otf\nFonts may also be supplied with XHS_FONT_REGULAR and XHS_FONT_BOLD.\nRequires @napi-rs/canvas and sharp. Outputs 1440×1920 PNG + JPEG96 (4:4:4), overview.png, layout_audit.json.\nText overflow exits 2; invalid input or missing assets exits 1. No automatic font shrinking.');return;
  }
  assert(args.input && args.output, '--input and --output are required. Use --help for usage.');
  const input=path.resolve(args.input);
  const config=JSON.parse(fs.readFileSync(input,'utf8'));
  const result=await renderCarousel(config,{...args,inputDir:path.dirname(input),fontRegular:args.fontRegular || process.env.XHS_FONT_REGULAR,fontBold:args.fontBold || process.env.XHS_FONT_BOLD});
  console.log(JSON.stringify(result,null,2));
}
if(require.main===module)main().catch(error=>{console.error(`ERROR: ${error.message}`);process.exitCode=error.exitCode || 1;});
module.exports={renderCarousel,validateConfig,DEFAULT_COLORS};
