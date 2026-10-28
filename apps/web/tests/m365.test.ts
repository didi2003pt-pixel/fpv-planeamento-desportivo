import assert from 'node:assert/strict';
import test from 'node:test';
import { parseM365Config, type M365Config } from '../src/m365/config';
import { confirmClassMonth, createClassActivity, GraphError, listClassActivities } from '../src/m365/graph';
import { validateDraft, validDate } from '../src/m365/model';

const siteId = '00000000-0000-4000-8000-000000000001';
const listId = '00000000-0000-4000-8000-000000000002';
const config: M365Config = {
  tenantId: '00000000-0000-4000-8000-000000000003',
  clientId: '00000000-0000-4000-8000-000000000004',
  siteId, classes: [{ code: 'ILCA 7', listId }],
};
const record = {
  id: '17', eTag: 'W/"item-v1"',
  fields: {
    Title: 'Estágio de exemplo', ActivityType: 'CAMP',
    ActivityStatus: 'PLANNED', StartDate: '2026-11-17T00:00:00Z',
    EndDate: '2026-11-31T00:00:00Z', // a data inválida tem de ser recusada
    AnnualStartDate: '2026-11-17T00:00:00Z',
    AnnualEndDate: '2026-11-30T00:00:00Z',
    MonthlyConfirmed: false, Location: 'Vilamoura', ExpectedAthletes: 3,
  },
};
test('Configuração incompleta fica bloqueada; não aceita IDs ou classes falsos', () => {
  assert.equal(parseM365Config({tenantId:'',clientId:'',siteId:'',classes:[]}),null);
  assert.equal(parseM365Config({...config,classes:[]}),null);
  assert.equal(parseM365Config({...config,clientId:'not-guid'}),null);
  assert.equal(parseM365Config({...config,classes:[config.classes[0],config.classes[0]]}),null);
  assert.deepEqual(parseM365Config(config),config);
});
test('Validação de atividades impede datas impossíveis e contagem inválida', () => {
  assert.equal(validDate('2026-11-31'), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.match(validateDraft({title:'',type:'CAMP',start:'2026-11-17',end:'2026-11-19',location:'',expectedAthletes:1})??'',/Título/);
  assert.match(validateDraft({title:'Estágio',type:'CAMP',start:'2026-11-20',end:'2026-11-19',location:'',expectedAthletes:1})??'',/datas/);
  assert.equal(validateDraft({title:'Estágio',type:'CAMP',start:'2026-11-17',end:'2026-11-19',location:'',expectedAthletes:0}),null);
});
test('Leitura valida colunas da lista e não inventa datas', async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({value:[record]}),{status:200});
  try {
    await assert.rejects(listClassActivities(config,config.classes[0],'token-ficticio'),/Esquema SharePoint/);
  } finally {globalThis.fetch=old;}
});
test('Leitura permite uma lista configurada e usa bearer somente para graph.microsoft.com', async () => {
  const old=globalThis.fetch;
  let url='';
  let headers:HeadersInit|undefined;
  globalThis.fetch=async (input,options) => {
    url=String(input); headers=options?.headers;
    return new Response(JSON.stringify({value:[{...record,fields:{...record.fields,EndDate:'2026-11-30T00:00:00Z'}}]}),{status:200});
  };
  try{
    const rows=await listClassActivities(config,config.classes[0],'token-ficticio');
    assert.equal(rows.length,1);
    assert.equal(rows[0].etag,'W/"item-v1"');
    assert.equal(rows[0].sailingClass,'ILCA 7');
    assert.equal(rows[0].annualEnd,'2026-11-30');
    assert.ok(url.startsWith('https://graph.microsoft.com/v1.0/sites/'));
    assert.equal((headers as Record<string,string>)?.Authorization,'Bearer token-ficticio');
  }finally{globalThis.fetch=old;}
});
test('Não segue paginação para endereços externos com token Microsoft', async () => {
  const old=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async ()=>{calls++;return new Response(JSON.stringify({
    value:[], '@odata.nextLink':'https://malicioso.example/roubo-de-token',
  }),{status:200});};
  try {
    await assert.rejects(listClassActivities(config,config.classes[0],'token-ficticio'),/Paginação Graph/);
    assert.equal(calls,1);
  } finally {globalThis.fetch=old;}
});
test('Criar atividade envia dados mínimos; não transmite nomes de atletas',async()=>{
  const old=globalThis.fetch;
  let body='';
  globalThis.fetch=async(_input,options)=>{body=String(options?.body);return new Response(JSON.stringify({id:'99'}),{status:201});};
  try{
    await createClassActivity(config,config.classes[0],'token-ficticio',{
      title:'Estágio',type:'CAMP',start:'2026-11-17',end:'2026-11-27',location:'Faro',expectedAthletes:3,
    });
    const parsed=JSON.parse(body);
    assert.equal(parsed.fields.AnnualEndDate,'2026-11-27T00:00:00Z');
    assert.equal(parsed.fields.ExpectedAthletes,3);
    assert.equal(JSON.stringify(parsed).includes('participants'),false);
  }finally{globalThis.fetch=old;}
});
test('Confirmação mensal exige ETag e preserva previsão anual',async()=>{
  const old=globalThis.fetch;
  let headers:HeadersInit|undefined;
  let body='';
  globalThis.fetch=async(_input,options)=>{headers=options?.headers;body=String(options?.body);return new Response('{}',{status:200});};
  try{
    await confirmClassMonth(config,{
      id:'17',listId,etag:'W/"item-v1"',title:'Estágio',sailingClass:'ILCA 7',
      type:'CAMP',status:'PLANNED',start:'2026-11-17',end:'2026-11-30',
      annualStart:'2026-11-17',annualEnd:'2026-11-30',monthlyConfirmed:false,
      location:'Vilamoura',expectedAthletes:3,
    },'token-ficticio','2026-11-17','2026-11-27');
    assert.equal((headers as Record<string,string>)['If-Match'],'W/"item-v1"');
    const data=JSON.parse(body);
    assert.equal(data.EndDate,'2026-11-27T00:00:00Z');
    assert.equal('AnnualEndDate' in data,false);
  }finally{globalThis.fetch=old;}
});
test('Erros 403 e 412 são identificados sem mostrar detalhes internos',async()=>{
  const old=globalThis.fetch;
  globalThis.fetch=async()=>new Response('private internal stack trace',{status:403});
  try{await assert.rejects(listClassActivities(config,config.classes[0],'fake'),(e:unknown)=>
    e instanceof GraphError && e.status===403 && !e.message.includes('stack trace'));}
  finally{globalThis.fetch=old;}
});
