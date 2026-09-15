const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
function harness(initialSetup=false,profile={}){
 let slots=[],index=0,cancelled=false;
 const react={...require('react'),useState(initial){const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value}]},useRef(value){return {current:value}},useEffect(){}};
 const m={exports:{}};const placeholder=()=>null;
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/plan-chat.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports:m.exports,module:m,require:n=>n==='react'?react:n==='react/jsx-runtime'?require(n):n==='lucide-react'?new Proxy({},{get:()=>placeholder}):n.includes('coach-memory')?{useCoachMemory:()=>({setOffer(){}})}:new Proxy({},{get:()=>placeholder}),console,setTimeout,clearTimeout,AbortController});
 const props={initialSetup,data:{profile,templates:[],exercises:[]},state:{messages:[],plan:null,ids:[]},onDraft(){},onSave(){},onDataChange(){},onReset(){},onView(){},onCancel(){cancelled=true}};
 function render(){index=0;return m.exports.PlanChat(props)}
 function nodes(node){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(nodes);return [node,...nodes(node.props?.children)]}
 function text(node){if(node==null||typeof node==='boolean')return '';if(typeof node==='string'||typeof node==='number')return String(node);if(Array.isArray(node))return node.map(text).join('');return text(node.props?.children)}
 function click(label){const button=nodes(render()).find(n=>n.type==='button'&&text(n).trim().startsWith(label.trim()));assert(button,`Missing button: ${label}`);button.props.onClick()}
 return {render,nodes,text,click,get cancelled(){return cancelled}};
}
const chat=harness();chat.render().props.onOpen();let tree=chat.render();assert(chat.nodes(tree).some(n=>n.type==='textarea'));assert(!chat.text(tree).includes('Use quick setup'));assert(!chat.text(tree).includes('Write my own request'));assert(!chat.text(tree).includes('Step 1 of 5'));
const create=harness(true);assert(create.text(create.render()).includes('Quick setup'));assert(create.text(create.render()).includes('Describe your plan'));create.click('Quick setup');assert(!create.nodes(create.render()).some(n=>n.type==='textarea'));create.click('Back');assert(create.text(create.render()).includes('Describe your plan'));create.click('Quick setup');for(let i=0;i<4;i++)create.click('Skip for now ');assert(create.nodes(create.render()).some(n=>n.type==='textarea'));assert(create.nodes(create.render()).some(n=>n.type==='button'&&create.text(n).includes('Create my plan')&&!n.props.disabled));
const known=harness(true,{goal:'Get stronger',equipment:'Dumbbells up to 35 lb'});known.click('Quick setup');assert(known.nodes(known.render()).some(n=>n.type==='button'&&n.props['aria-pressed']&&known.text(n).includes('Get stronger')));
const cancel=harness(true);cancel.nodes(cancel.render()).find(n=>n.props?.['aria-label']==='Go back').props.onClick();assert(cancel.cancelled);
const source=fs.readFileSync('components/plan-chat.tsx','utf8');assert(source.includes('Plan ready to refine'));assert(source.includes('Ask for any changes below before saving.'));assert(source.indexOf('onDraft(plan')<source.indexOf("stage('progress'"));assert(source.includes('Review &amp; save plan'));
console.log('PASS: regular chat has no setup controls; creation has two direct paths, back/cancel, skippable setup and prefilled profile answers.');
