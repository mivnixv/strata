/** Every iteration consumes source; token count is bounded by source bytes. */
export class DslLexer {
  scan(source) {
    const tokens=[];
    const pattern=/[ \t\r]+|#[^\n]*|\n|"(?:\\[^\n]|[^"\\\n])*"|->|[{}\[\]:;,]|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|[A-Za-z_][\w.-]*/gy;
    let offset=0, line=1, column=1;
    while (offset<source.length) {
      pattern.lastIndex=offset;
      const match=pattern.exec(source);

      if (!match) { throw new Error(`Line ${line}, column ${column}: unexpected character ${JSON.stringify(source[offset])}.`); }

      const raw=match[0], token={raw,line,column};
      offset+=raw.length;

      if (raw==='\n') { tokens.push({...token,kind:'separator',value:raw}); line++; column=1; continue; }

      column+=raw.length;

      if (/^[ \t\r#]/.test(raw)) { continue; }

      const kind=raw.startsWith('"') ? 'string' : /^-?\d/.test(raw) ? 'number' : /^[A-Za-z_]/.test(raw) ? 'word' : raw===';' ? 'separator' : 'symbol';
      let value=raw;

      if (kind==='string') {
        try { value=JSON.parse(raw); }
        catch { throw new Error(`Line ${line}, column ${token.column}: invalid quoted string; use JSON escapes.`); }
      }
      if (kind==='number') { value=Number(raw); }

      tokens.push({...token,kind,value});
    }
    tokens.push({kind:'eof',raw:'',value:'',line,column});
    return tokens;
  }
}
