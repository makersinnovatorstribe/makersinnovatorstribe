const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/Jun Leong/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const output=path.resolve(__dirname,'../assets/images/cutouts');fs.mkdirSync(output,{recursive:true});
const source='C:/Users/Jun Leong/.codex/generated_images/01a0ff08-1c9b-74b3-8609-ce5223a48079/';
const files=[['exec-a5414fe6-4d5c-4a59-a5c3-646c9e6e559c.png','mascot-rug.webp'],['exec-6d25d5d8-b5ff-4129-98eb-6e7cedb79e78.png','strawberry-bag.webp'],['exec-f16d90b9-c200-461d-a2a8-91828c785680.png','layered-wood.webp']];
Promise.all(files.map(async ([input,name])=>{await sharp(path.join(source,input)).trim().resize({width:600,height:600,fit:'inside'}).webp({quality:88}).toFile(path.join(output,name));console.log(name)})).catch(e=>{console.error(e);process.exitCode=1});
