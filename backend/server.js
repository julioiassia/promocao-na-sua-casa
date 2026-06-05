const express=require('express');
const multer=require('multer');
const crypto=require('crypto');
const Anthropic=require('@anthropic-ai/sdk');
const path=require('path');
const {createClient}=require('@supabase/supabase-js');

const app=express();
app.use(express.json());
app.use(express.static(path.join(__dirname,'..')));
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'..','usuario.html')));
app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'..','admin.html')));
app.get('/versao',(req,res)=>res.json({versao:'2026-06-05-v7',pdf:'sonnet-compact'}));
app.use((req,res,next)=>{res.header('Access-Control-Allow-Origin','*');res.header('Access-Control-Allow-Headers','*');next();});

const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:30*1024*1024}});
const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_KEY);
const hashes=new Set();


function calcularPrecoPorUnidade(preco,quantidade,unidade){
  if(!preco||!quantidade||quantidade<=0)return null;
  const u=(unidade||'').toLowerCase();
  if(u.includes('kg')||u.includes('kilo'))return preco/quantidade;
  if(u.includes('g')&&!u.includes('kg'))return(preco/quantidade)*1000;
  if(u.includes('ml'))return(preco/quantidade)*1000;
  if(u.includes('l')&&!u.includes('ml'))return preco/quantidade;
  return null;
}

function parseJSONSeguro(texto){
  // Remove markdown code blocks
  let t=texto.trim().replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
  // Tenta parse direto
  try{return JSON.parse(t);}catch(e){}
  // JSON truncado: recupera todos os objetos completos
  try{
    const start=t.indexOf('[');
    if(start!==-1){
      // Acha o ultimo objeto completo (termina com },  ou  }  seguido de whitespace/])
      const matches=[...t.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}/g)];
      if(matches.length){
        const produtos=[];
        for(const m of matches){
          try{const p=JSON.parse(m[0]);if(p.nome&&p.preco)produtos.push(p);}catch(ex){}
        }
        if(produtos.length)return{produtos};
      }
    }
  }catch(e2){}
  // Ultimo recurso: tenta fechar o array/objeto truncado
  try{
    const i=t.indexOf('{');
    const lastComma=t.lastIndexOf('},');
    if(i!==-1&&lastComma>i){
      const fixed=t.substring(i,lastComma+1)+']}';
      return JSON.parse(fixed);
    }
  }catch(e3){}
  return{produtos:[]};
}

async function extrairComIA(anthropic,conteudo,tipo){
  const hoje=new Date().toISOString().split('T')[0];
  const prompt=`Extraia TODOS os produtos com precos deste encarte de supermercado. Data de hoje: ${hoje}. Regras: 1) nome_generico deve ser ESPECIFICO - ex: "Leite Integral", "Leite Condensado", "Creme de Leite", "Feijao Carioca", "Feijao Preto", "Oleo de Soja", "Azeite de Oliva" - NUNCA use nomes genericos demais como apenas "Leite" ou "Feijao". 2) Sempre extraia quantidade e unidade. 3) Categoria entre: Graos e Cereais, Carnes e Aves, Laticinios, Padaria, Hortifruti, Bebidas, Limpeza, Higiene Pessoal, Mercearia, Frios e Embutidos, Congelados, Outros. 4) Se o encarte tiver data de vigencia ou validade da promocao (ex: "valido ate 30/06", "de 01 a 07/06"), extraia no campo validade no formato YYYY-MM-DD. Se nao houver data visivel, coloque null. Retorne APENAS JSON valido: {"produtos":[{"nome":"nome completo com marca e quantidade","nome_generico":"tipo especifico do produto sem marca","marca":"marca","preco":0.00,"quantidade":1.0,"unidade":"kg ou g ou L ou ml ou un","categoria":"categoria","validade":"YYYY-MM-DD ou null","confianca":"alta"}]}. Se nao encontrar produtos: {"produtos":[]}`;
  let messages;
  if(tipo==='imagem'){
    messages=[{role:'user',content:[{type:'image',source:{type:'base64',media_type:conteudo.mimeType,data:conteudo.data}},{type:'text',text:prompt}]}];
  }else if(tipo==='paginas'){
    const content=conteudo.map(p=>({type:'image',source:{type:'base64',media_type:'image/png',data:p.toString('base64')}}));
    content.push({type:'text',text:prompt});
    messages=[{role:'user',content}];
  }else{
    messages=[{role:'user',content:prompt+'\n\nCONTEUDO:\n'+conteudo.substring(0,15000)}];
  }
  const resp=await anthropic.messages.create({model:'claude-haiku-4-5-20251001',max_tokens:4000,messages});
  return parseJSONSeguro(resp.content[0].text);
}

async function salvarPromocoes(produtos,mercadoNome,hash){
  const inserts=produtos.map(p=>{
    const ppU=calcularPrecoPorUnidade(p.preco,p.quantidade,p.unidade);
    return{mercado_nome:mercadoNome,nome:p.nome,nome_generico:p.nome_generico||p.nome,marca:p.marca||'',preco:p.preco,quantidade:p.quantidade||null,unidade:p.unidade||'un',unidade_padrao:p.unidade||'un',preco_por_unidade:ppU,categoria:p.categoria||'Outros',validade:p.validade||null,foto_hash:hash};
  });
  const{error}=await supabase.from('promocoes').insert(inserts);
  if(error)throw new Error('Erro ao salvar: '+error.message);
  return inserts;
}

app.post('/upload-admin',upload.single('foto'),async(req,res)=>{
  try{
    if(!req.file)return res.status(400).json({erro:'Sem foto'});
    const hash=crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    if(hashes.has(hash))return res.status(400).json({erro:'Foto ja enviada'});
    const anthropic=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY});
    const dados=await extrairComIA(anthropic,{mimeType:req.file.mimetype,data:req.file.buffer.toString('base64')},'imagem');
    if(!dados.produtos||!dados.produtos.length)return res.status(422).json({erro:'Nenhum produto encontrado.'});
    hashes.add(hash);
    res.json({sucesso:true,produtos:dados.produtos});
  }catch(e){console.error(e);res.status(500).json({erro:e.message});}
});

app.post('/upload-pdf-admin',upload.single('pdf'),async(req,res)=>{
  try{
    if(!req.file)return res.status(400).json({erro:'Sem PDF'});
    const hash=crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    if(hashes.has(hash))return res.status(400).json({erro:'PDF ja enviado'});
    const anthropic=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY});
    const hoje=new Date().toISOString().split('T')[0];
    // Prompt compacto: sem indentacao, sem campo confianca, para caber em menos tokens
    const prompt=`Liste todos os produtos com preco deste encarte. Data: ${hoje}. Retorne JSON compacto numa unica linha, sem espacos extras: {"produtos":[{"n":"nome+marca+qtd","g":"tipo especifico sem marca ex:Leite Integral","m":"marca","p":0.00,"q":1.0,"u":"kg/g/L/ml/un","c":"categoria","v":"YYYY-MM-DD ou null"}]}. Categorias: Graos e Cereais,Carnes e Aves,Laticinios,Padaria,Hortifruti,Bebidas,Limpeza,Higiene Pessoal,Mercearia,Frios e Embutidos,Congelados,Outros. Validade: se o encarte tiver data de vigencia coloque em v, senao null. Responda APENAS o JSON, sem texto adicional.`;
    const resp=await anthropic.messages.create({
      model:'claude-sonnet-4-6',
      max_tokens:8192,
      messages:[{role:'user',content:[
        {type:'document',source:{type:'base64',media_type:'application/pdf',data:req.file.buffer.toString('base64')}},
        {type:'text',text:prompt}
      ]}]
    });
    const rawText=resp.content[0].text;
    let dados=parseJSONSeguro(rawText);
    // Normaliza campos curtos (n/g/m/p/q/u/c/v) para campos completos
    if(dados.produtos&&dados.produtos.length){
      dados.produtos=dados.produtos.map(p=>({
        nome:p.nome||p.n||'',
        nome_generico:p.nome_generico||p.g||p.nome||p.n||'',
        marca:p.marca||p.m||'',
        preco:p.preco||p.p||0,
        quantidade:p.quantidade||p.q||null,
        unidade:p.unidade||p.u||'un',
        categoria:p.categoria||p.c||'Outros',
        validade:p.validade||p.v||null,
        confianca:'alta'
      }));
    }
    if(!dados.produtos||!dados.produtos.length)return res.status(422).json({erro:'IA nao encontrou produtos. Detalhe: '+rawText.substring(0,300)});
    hashes.add(hash);
    res.json({sucesso:true,produtos:dados.produtos,paginas:1});
  }catch(e){console.error('ERRO PDF:',e);res.status(500).json({erro:e.message});}
});

app.post('/publicar',async(req,res)=>{
  try{
    const{produtos,mercado}=req.body;
    if(!produtos||!produtos.length)return res.status(400).json({erro:'Sem produtos'});
    const salvos=await salvarPromocoes(produtos,mercado,'manual-'+Date.now());
    res.json({sucesso:true,total:salvos.length});
  }catch(e){console.error(e);res.status(500).json({erro:e.message});}
});

// Retorna somente promoções ativas (não expiradas)
// Com validade → oculta se validade < hoje
// Sem validade → ativa somente no dia de criação (até 23:59)
app.get('/promocoes',async(req,res)=>{
  try{
    const{data,error}=await supabase.from('promocoes').select('*').order('criado_em',{ascending:false});
    if(error)throw error;
    const hoje=new Date();
    hoje.setHours(0,0,0,0);
    const hojeStr=hoje.toISOString().split('T')[0];
    const ativas=data.filter(p=>{
      if(p.validade){
        return p.validade>=hojeStr;
      }else{
        const criado=new Date(p.criado_em);
        criado.setHours(0,0,0,0);
        return criado.getTime()===hoje.getTime();
      }
    });
    res.json(ativas);
  }catch(e){res.status(500).json({erro:e.message});}
});

// Histórico de preços para o gráfico de evolução (inclui expiradas)
app.get('/historico/:nome_generico',async(req,res)=>{
  try{
    const nome=decodeURIComponent(req.params.nome_generico);
    const{data,error}=await supabase
      .from('promocoes')
      .select('preco,preco_por_unidade,mercado_nome,criado_em')
      .ilike('nome_generico',`%${nome}%`)
      .order('criado_em',{ascending:true});
    if(error)throw error;
    const grupos={};
    data.forEach(p=>{
      const dia=p.criado_em.split('T')[0];
      if(!grupos[dia])grupos[dia]={dia,precos:[],mercados:[]};
      grupos[dia].precos.push(Number(p.preco));
      if(!grupos[dia].mercados.includes(p.mercado_nome))grupos[dia].mercados.push(p.mercado_nome);
    });
    const historico=Object.values(grupos).map(g=>({
      dia:g.dia,
      melhor:Math.min(...g.precos),
      pior:Math.max(...g.precos),
      mercados:g.mercados
    }));
    res.json(historico);
  }catch(e){res.status(500).json({erro:e.message});}
});

app.get('/mercados',async(req,res)=>{
  try{
    const{data,error}=await supabase.from('mercados').select('*');
    if(error)throw error;
    res.json(data);
  }catch(e){res.status(500).json({erro:e.message});}
});

const PORT=process.env.PORT||3001;
app.listen(PORT,()=>console.log('APP PROMOCAO NA SUA CASA rodando na porta '+PORT));