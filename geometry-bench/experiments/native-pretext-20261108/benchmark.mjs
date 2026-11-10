import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import os from 'node:os';

const here=path.dirname(fileURLToPath(import.meta.url));
const out=path.resolve(process.argv[2]??'output/native-pretext-20261108/benchmark');
await fs.mkdir(out,{recursive:true});
try {await fs.access(path.join(out,'results.json'));throw Error('Choose a fresh benchmark folder.');}catch(e){if(e.code!=='ENOENT')throw e;}
const exec=promisify(execFile),build=path.join(here,'benchmark-build');
await fs.mkdir(build,{recursive:true});
const files=['TextWrappingMethod.swift','TextWrappingPreferences.swift','PreviousTextWrapping.swift','CoreTextWrappingCache.swift','TextWrapping.swift'];
const sources=files.map(f=>path.join(here,'workspace/Sources/PosterCore',f));
const hashes=Object.fromEntries(await Promise.all(sources.map(async f=>[path.basename(f),createHash('sha256').update(await fs.readFile(f)).digest('hex')])));
console.log('Building optimized native benchmark in its private folder…');
await exec('/usr/bin/swiftc',['-O','-swift-version','6','-module-cache-path',path.join(build,'module-cache'),...sources,path.join(here,'benchmark.swift'),'-o',path.join(build,'benchmark')],{maxBuffer:4e6});
console.log('Comparing uncached, cold, measurement-reuse and completed-layout paths…');
const {stdout}=await exec(path.join(build,'benchmark'),[path.join(here,'cases.json')],{maxBuffer:8e6});
const cases=JSON.parse(stdout);
const result={metadata:{createdAt:new Date().toISOString(),cpu:os.cpus()[0].model,arch:os.arch(),loadAverage:os.loadavg(),optimization:'swiftc -O -swift-version 6',rounds:21,widthsPerSweep:16,sourceSHA256:hashes},cases};
await fs.writeFile(path.join(out,'results.json'),JSON.stringify(result,null,2));
const n=x=>x<.01?x.toFixed(4):x.toFixed(3);
const labels={headline:'Long headline',details:'Dense event details',japanese:'Japanese copy'};
const rows=Object.entries(cases).map(([key,c])=>{
 const t=c.timings,old=t.previousSweep.medianMs;
 return `| ${labels[key]} | ${n(old)} | ${n(t.coldSweep.medianMs)} | ${n(t.measurementWarmSweep.medianMs)} | ${n(t.layoutWarmSweep.medianMs)} | ${(old/t.measurementWarmSweep.medianMs).toFixed(1)}× | ${(old/t.layoutWarmSweep.medianMs).toFixed(1)}× |`;
});
const report=`# Native Core Text caching benchmark\n\nAll methods are native Swift + Core Text on ${result.metadata.cpu}. Twenty-one rotating-order samples per method; 16 widths per sweep; milliseconds, lower is better. Compilation, process startup and rendering are excluded. Other sessions remained active, so absolute times can vary.\n\n| Copy | Previous | Cold cache | Warm measurements | Completed layouts | Measurement speedup | Layout speedup |\n|---|---:|---:|---:|---:|---:|---:|\n${rows.join('\n')}\n\nCold cache means a new cache for each complete sweep. Warm measurements retains Core Text ink bounds while limiting the completed-layout cache to one entry, forcing every width to run the wrapping algorithm. Completed layouts retains all 16 width results. Single-layout comparisons:\n\n| Copy | Previous ms | Cold cached ms |\n|---|---:|---:|\n${Object.entries(cases).map(([key,c])=>`| ${labels[key]} | ${n(c.timings.previousSingle.medianMs)} | ${n(c.timings.coldSingle.medianMs)} |`).join('\n')}\n\n## Correctness\n\n${Object.entries(cases).map(([key,c])=>`- ${labels[key]}: ${c.exactMatches}/16 exact line matches. Warm measurement path made ${c.warmMeasurementCallsAfter-c.warmMeasurementCallsBefore} additional Core Text measurements, with ${c.warmMeasurementLayoutHits} completed-layout hits. Retained measurement strings use an estimated ${c.estimatedMeasurementBytes} bytes.`).join('\n')}\n\nThe implementation preserves the previous whitespace and glyph-height rules. This is a wrapping benchmark, not a whole-generation or aesthetic-quality benchmark. Raw samples and source hashes are in results.json. The Settings toggle selects the actual uncached previous implementation when disabled.\n`;
await fs.writeFile(path.join(out,'REPORT.md'),report);
const csv=['copy,method,sample,ms'];
for(const [key,c] of Object.entries(cases))for(const [name,t]of Object.entries(c.timings))if(t.samplesMs)t.samplesMs.forEach((v,i)=>csv.push(`${key},${name},${i},${v}`));
await fs.writeFile(path.join(out,'timings.csv'),csv.join('\n')+'\n');
console.log(report);
