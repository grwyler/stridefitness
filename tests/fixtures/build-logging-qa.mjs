import {build} from 'vite';
import react from '@vitejs/plugin-react';
await build({configFile:false,publicDir:false,define:{'process.env.NODE_ENV':'"production"'},plugins:[react()],build:{outDir:'public/logging-qa',emptyOutDir:true,lib:{entry:'tests/fixtures/logging-qa.tsx',formats:['es'],fileName:'fixture'},rollupOptions:{output:{assetFileNames:'[name][extname]'}}}});

import {writeFileSync} from 'node:fs';
writeFileSync('public/logging-qa/index.html',`<!doctype html><html><head><title>Phone logging QA</title></head><body><p>390px disposable logging test</p><iframe title="Phone logging" src="./phone.html" style="width:390px;height:820px;border:1px solid #ccc"></iframe></body></html>`);
writeFileSync('public/logging-qa/phone.html',`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./fixture.css"></head><body><div id="root"></div><script type="module" src="./fixture.js"></script></body></html>`);
