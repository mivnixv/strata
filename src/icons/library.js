/** Icon IDs are paths relative to the repository's icons directory. */
export function iconId(value) {
  if (value == null) { return null; }

  if (typeof value !== 'string' || value.length>500 || !/^(?:[a-z0-9_]+\/)*[a-z0-9_]+\.(svg|png|webp|jpg|jpeg)$/.test(value)) {
    throw new Error('Icon must be a lowercase file path relative to icons/, without traversal.');
  }

  return value;
}
export class IconLibrary {
  constructor({embedded=null,basePath='/assets/icons/',fetchAsset=(url)=>fetch(url)}={}) {
    this.embedded=embedded;this.basePath=basePath;this.fetchAsset=fetchAsset;
  }
  resolve(id) {
    iconId(id);

    if (this.embedded) { return this.embedded[id] ?? null; }

    return this.basePath+id;
  }
  async collect(resources) {
    const assets={};
    for (const id of new Set(resources.map(resource=>resource.icon).filter(Boolean))) {
      const url=this.resolve(id);

      if (!url) { throw new Error('Icon not embedded in this offline file: '+id); }
      if (this.embedded) { assets[id]=url;continue; }

      const response=await this.fetchAsset(url);

      if (!response.ok) { throw new Error('Icon not found: '+id); }

      const blob=await response.blob();
      assets[id]=await new Promise((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
      });
    }
    return assets;
  }
}
