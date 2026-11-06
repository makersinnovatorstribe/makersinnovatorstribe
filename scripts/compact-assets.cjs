/* Conservative lexical minification: preserve literals, newlines/ASI and order.
   No bundler dependency, symbol renaming or transformation of application code. */
'use strict';
const vm = require('node:vm');

function compactJs(source) {
  let output = '', i = 0, previous = '';
  const word = /[\w$]/;
  const quotedEnd = start => { let p=start+1;while(p<source.length){if(source[p]==='\\')p+=2;else if(source[p++]===source[start])break;}return p; };
  function templateEnd(start) {
    let p=start+1;
    while(p<source.length){
      if(source[p]==='\\'){p+=2;continue;}
      if(source[p]==='`')return p+1;
      if(source[p]==='$'&&source[p+1]==='{'){
        p+=2;let depth=1;
        while(p<source.length&&depth){
          const c=source[p];
          if(c==='"'||c==="'"){p=quotedEnd(p);continue;}
          if(c==='`'){p=templateEnd(p);continue;}
          if(c==='/'&&source[p+1]==='/'){while(p<source.length&&source[p]!=='\n')p++;continue;}
          if(c==='/'&&source[p+1]==='*'){const end=source.indexOf('*/',p+2);p=end<0?source.length:end+2;continue;}
          if(c==='{')depth++;else if(c==='}')depth--;p++;
        }
      } else p++;
    }
    return p;
  }
  while (i < source.length) {
    const c = source[i], n = source[i+1];
    if (c === '/' && n === '/') { while (i < source.length && source[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') {
      const end = source.indexOf('*/', i+2);
      if (end < 0) throw new Error('Unclosed script comment');
      output += source.slice(i,end+2).includes('\n') ? '\n' : ' ';
      i = end+2;continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const end=c==='`'?templateEnd(i):quotedEnd(i);output+=source.slice(i,end);i=end;
      previous = 'literal';continue;
    }
    // A regexp can contain quotes, // or /*; keep that token byte-for-byte.
    const prefix = output.trimEnd();
    if (c === '/' && (!previous || /[=(:,!&|?;{[>]/.test(previous) || /\b(?:return|throw|case|typeof|void|yield)\s*$/.test(prefix))) {
      let characterClass=false;output+=c;i++;
      while(i<source.length){const value=source[i++];output+=value;if(value==='\\'&&i<source.length)output+=source[i++];else if(value==='[')characterClass=true;else if(value===']')characterClass=false;else if(value==='/'&&!characterClass){while(i<source.length&&/[a-z]/i.test(source[i]))output+=source[i++];break}}
      previous='literal';continue;
    }
    if (c === '\r') { i++;continue; }
    if (c === '\n') { if (!output.endsWith('\n')) output+='\n';i++;continue; }
    if (/\s/.test(c)) {
      let end=i+1;while(end<source.length&&/[\t ]/.test(source[end]))end++;
      const a=output.at(-1),b=source[end];
      if ((a && b && word.test(a) && word.test(b)) || (a==='+'&&b==='+') || (a==='-'&&b==='-'))output+=' ';
      i=end;continue;
    }
    output+=c;previous=c;i++;
  }
  output=output.trim()+'\n';
  // Fail closed: a minification error must never reach the publishing folder.
  new vm.Script(output);
  return output;
}
function compactCss(source) {
  let output='',i=0,space=false;
  while(i<source.length){const c=source[i],n=source[i+1];
    if(c==='/'&&n==='*'){const end=source.indexOf('*/',i+2);if(end<0)throw new Error('Unclosed CSS comment');i=end+2;space=true;continue}
    if(c==='"'||c==="'"){if(space&&!/[{;:,\s]$/.test(output))output+=' ';space=false;const quote=c;output+=source[i++];while(i<source.length){const v=source[i++];output+=v;if(v==='\\'&&i<source.length)output+=source[i++];else if(v===quote)break}continue}
    if(/\s/.test(c)){space=true;i++;continue}
    if(/[{};]/.test(c)){output=output.trimEnd();output+=c;space=false;i++;continue}
    if(space&&output&&!/[{;:,]$/.test(output))output+=' ';space=false;output+=c;i++;
  }
  return output.trim()+'\n';
}
module.exports={compactJs,compactCss};
