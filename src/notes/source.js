/** Parse consecutive note declarations, including optional mark connectors. */
export function parseNoteDeclarations(tokens,line,readString) {
  const notes=[];
  for (let index=0;index<tokens.length;) {

    if (tokens[index]!=='note' || index+2>=tokens.length) { throw new Error(`Line ${line}: expected note NUMBER "Text".`); }

    const note={number:Number(tokens[index+1]),text:readString(tokens[index+2],line)};
    index+=3;

    const options=new Set();
    while (tokens[index]==='connect' || tokens[index]==='fontSize' || tokens[index]==='position') {
      const option=tokens[index];

      if (options.has(option)) { throw new Error(`Line ${line}: duplicate note ${option} option.`); }

      options.add(option);

      if (option==='position') {

        if (tokens[index+1]===undefined) { throw new Error(`Line ${line}: expected a note mark position.`); }

        note.position=tokens[index+1]; index+=2; continue;
      }

      if (option==='fontSize') { note.fontSize=Number(tokens[index+1]); index+=2; continue; }

      index++;
      let label='';

      if (tokens[index]===':') { label=readString(tokens[index+1],line); index+=2; }

      const dashed=tokens[index]==='dashed';

      if (dashed || tokens[index]==='solid') { index++; }

      note.connector={label,dashed};
    }
    notes.push(note);
  }
  return notes;
}

export function formatNoteDeclaration(note) {
  const connector=note.connector;
  return `note ${note.number} ${JSON.stringify(note.text)}${note.position && note.position!=='top-left' ? ` position ${note.position}` : ''}${note.fontSize!==14 ? ` fontSize ${note.fontSize}` : ''}${connector ? ` connect${connector.label ? ' : '+JSON.stringify(connector.label) : ''} ${connector.dashed ? 'dashed' : 'solid'}` : ''}`;
}
