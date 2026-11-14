/** Measure the actual font; shrink before truncating at the readability floor. */
export class TextFit {
  constructor(measure) { this.measure=measure; }
  fit(text,width,{min=12,max=24,weight=400,spacing=0}={}) {
    const available=Math.max(0,width);
    const measured=(value,size)=>this.measure(value,size,weight)+Math.max(0,value.length-1)*spacing;
    const natural=measured(text,max);
    const size=Math.max(min,Math.min(max,Math.floor(max*available/Math.max(1,natural))));

    if (measured(text,size)<=available) { return {text,size}; }
    if (measured('…',size)>available) { return {text:'',size}; }

    const characters=Array.from(text);
    let low=0,high=characters.length;
    while (low<high) {
      const middle=Math.ceil((low+high)/2);

      if (measured(characters.slice(0,middle).join('')+'…',size)<=available) { low=middle; }
      else { high=middle-1; }

    }
    return {text:characters.slice(0,low).join('')+'…',size};
  }
}
