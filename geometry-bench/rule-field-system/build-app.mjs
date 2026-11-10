// Builds the editor page PosterLab bundles: engine and outlines in one offline script, no gallery or references.
//   node geometry-bench/rule-field-system/build-app.mjs <out/index.html>
import fs from 'node:fs';
import path from 'node:path';
import {buildSync} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {FAMILIES,CONTROLS,OPTIONS,LABELS} from './engine.mjs';
import {workshopHTML} from './workshop.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),out=process.argv[2];
if(!out)throw new Error('Pass the output path, e.g. workspaces/rule-field/Sources/PosterCore/Resources/RuleField/index.html');
const bundle=buildSync({entryPoints:[path.join(here,'engine.mjs')],bundle:true,format:'iife',globalName:'RuleField',minify:true,write:false,platform:'browser'}).outputFiles[0].text;
const html=workshopHTML({engine:bundle.replaceAll('</script','<\\/script'),FAMILIES,CONTROLS,OPTIONS,LABELS,references:[],app:true});
// An unchanged page keeps its timestamp, so SwiftPM does not rebuild PosterCore for it.
if(fs.existsSync(out)&&fs.readFileSync(out,'utf8')===html){console.log('Unchanged',out);process.exit(0);}
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,html);
console.log('Wrote',out,fs.statSync(out).size,'bytes');
