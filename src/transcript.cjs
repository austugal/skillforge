(function(root){
'use strict';
function timestamp(s){const m=s.match(/^(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})$/);if(!m || +m[2]>59 || +m[3]>59)throw Error('Invalid subtitle timestamp.');return ((+(m[1]||0)*60 + +m[2])*60 + +m[3])*1000 + +m[4];}
function parseTranscript(input){
 if(typeof input!=='string'||input.length>500000)throw Error('Transcript limit is 500 KB.');
 const cues=[];const blocks=input.replace(/^\uFEFF/,'').replace(/\r/g,'').split(/\n\s*\n/);
 for(const block of blocks){const lines=block.trim().split('\n');if(!lines.length || /^(WEBVTT|NOTE|STYLE|REGION)(\s|$)/.test(lines[0]))continue;
 const i=lines.findIndex(x=>x.includes('-->'));if(i<0)continue;
 const m=lines[i].match(/^(\S+)\s+-->\s+(\S+)/);if(!m)throw Error('Invalid subtitle cue.');
 const at=timestamp(m[1]),end=timestamp(m[2]);if(end<at)throw Error('Subtitle ends before it starts.');
 const text=lines.slice(i+1).join(' ').replace(/<[^>]*>/g,'').trim();if(text)cues.push({at,text});
 if(cues.length>1000)throw Error('Transcript limit is 1,000 cues.');
 }if(!cues.length)throw Error('No SRT or WebVTT subtitle cues found.');return cues.sort((a,b)=>a.at-b.at);
}
if(typeof module!=='undefined')module.exports={parseTranscript};else root.SkillForgeTranscript={parseTranscript};
})(typeof window!=='undefined'?window:globalThis);
