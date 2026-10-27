'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const FRAME = /^frame-[a-f0-9-]{36}\.jpg$/;
async function saveFrame(store, nativeImage, id, data) {
  if (typeof data !== 'string' || data.length > 3_000_000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(data)) throw Error('Invalid image or image exceeds 2 MB.');
  const image = nativeImage.createFromDataURL(data);
  if (image.isEmpty()) throw Error('Image could not be decoded.');
  const {width,height} = image.getSize();
  if (width > 4096 || height > 4096) throw Error('Image dimensions exceed 4096 pixels.');
  const normalized = width > 1280 ? image.resize({width:1280}) : image;
  const dir=store.dir(id); await fs.mkdir(dir,{recursive:true,mode:0o700});
  const files=await fs.readdir(dir); if(files.filter(x=>FRAME.test(x)).length >= 100) throw Error('Session frame limit reached (100).');
  const name=`frame-${randomUUID()}.jpg`;
  await fs.writeFile(path.join(dir,name),normalized.toJPEG(80),{flag:'wx',mode:0o600}); return name;
}
async function readFrame(store,id,name) {
  if (!FRAME.test(name)) throw Error('Invalid frame reference.');
  const file=path.join(store.dir(id),name), info=await fs.lstat(file);
  if(!info.isFile() || info.isSymbolicLink() || info.size>2_000_000) throw Error('Invalid frame file.');
  return (await fs.readFile(file)).toString('base64');
}
async function selectedFrames(store,s,enabled) {
  if(enabled !== true) return [];
  const selected=s.events.filter(e=>e.type==='frame' && e.frame && e.imageApproved===true);
  if(!selected.length) throw Error('Select at least one reviewed frame for visual analysis.');
  if(selected.length>12) throw Error('Select at most 12 frames per analysis.');
  return Promise.all(selected.map(async e=>({id:e.id,at:e.at,image:await readFrame(store,s.id,e.frame)})));
}
module.exports={saveFrame,readFrame,selectedFrames};
