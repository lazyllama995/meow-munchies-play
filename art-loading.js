// Unused themes and celebrations must not compete with the first screen.
export function createArtLoader({createImage=()=>new Image()}={}){
  const sources=new WeakMap(),pending=new WeakMap();
  return {
    image(src){const image=createImage();image.decoding='async';sources.set(image,src);return image;},
    load(image){
      if(pending.has(image))return pending.get(image);
      image.src=sources.get(image);
      const request=image.decode().then(()=>image).catch(error=>{pending.delete(image);throw error;});
      pending.set(image,request);return request;
    },
  };
}
