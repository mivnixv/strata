/** Ignore transparent pixels and tolerate neutral antialiasing. */
export function grayscalePixels(pixels) {
  let visible=false;
  for (let index=0;index<pixels.length;index+=4) {

    if (pixels[index+3]<16) { continue; }

    visible=true;
    const channels=[pixels[index],pixels[index+1],pixels[index+2]];

    if (Math.max(...channels)-Math.min(...channels)>12) { return false; }

  }
  return visible;
}
export class IconTint {
  constructor() { this.cache=new Map(); }
  detect(url) {

    if (this.cache.has(url)) { return this.cache.get(url); }
    if (this.cache.size>=512) { this.cache.clear(); }

    const result=new Promise(resolve=>{
      const image=new Image();
      image.onload=()=>{
        try {
          const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
          const context=canvas.getContext('2d',{willReadFrequently:true});
          context.drawImage(image,0,0,64,64);
          resolve(grayscalePixels(context.getImageData(0,0,64,64).data));
        } catch { resolve(false); }
      };
      image.onerror=()=>resolve(false);
      image.src=url;
    });
    this.cache.set(url,result);
    return result;
  }
  apply(element,filterId) {
    this.detect(element.getAttribute('href')).then(grayscale=>{

      if (grayscale) { element.setAttribute('filter',`url(#${filterId})`); }

    });
  }
}
