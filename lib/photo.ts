// Photos stay in this conversation's memory; canvas export strips file metadata.
export async function preparePhoto(file:File):Promise<string>{
 if(file.size>20*1024*1024)throw new Error('Choose a photo smaller than 20 MB.');
 if(!file.type.startsWith('image/'))throw new Error('Choose a photo, not another file type.');
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=url;
  try{await image.decode()}catch{throw new Error('This photo format could not be opened. Try a JPEG, PNG, or a new camera photo.')}
  if(!image.naturalWidth||!image.naturalHeight)throw new Error('This photo could not be opened. Try another one.');
  const scale=Math.min(1,1024/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Photo upload is unavailable in this browser.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const photo=canvas.toDataURL('image/jpeg',.8);
  if(photo.length>1500000)throw new Error('This photo is too large. Try a smaller photo.');
  return photo;
 }finally{URL.revokeObjectURL(url)}
}
