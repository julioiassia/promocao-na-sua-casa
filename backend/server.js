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
app.use((req,res,next)=>{res.header('Access-Control-Allow-Origin','*');res.header('Access-Control-Allow-Headers','*');next();});

const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:30*1024*1024}});
const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_KEY);
const hashes=new Set();

async function pdfParaImagens(buffer){
  const {pdf}=require('pdf-to-img');
  const doc=await pdf(buffer,{scale:2});
  const paginas=[];
  for await(const p of doc)paginas.push(p);
  return paginas;
}

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
  const t=texto.trim().replace(/```json|```/g,'').trim();
  try{return JSON.parse(t);}catch(e){
    try{const i=t.indexOf('{');const f=t.lastIndexOf('}');if(i!==-1&&f!==-1)return JSON.parse(t.substring(i,f+1));}catch(e2){}
    return{produtos:[]};
  }
}

async function extrairComIA(anthropic,conteudo,tipo){
  const prompt='Extraia TODOS os produtos com precos deste encarte de supermercado. Para cada produto identifique a categoria entre: Graos e Cereais, Carnes e Aves, Laticinios, Padaria, Hortifruti, Bebidas, Limpeza, Higiene Pessoal, Mercearia, Frios e Embutidos, Congelados, Outros. Retorne APENAS JSON valido sem texto adicional: {"produtos":[{"nome":"nome completo com quantidade e marca","nome_generico":"ap0,"quantidade":1.0,"unidade":"kg ou g ou L ou ml ou un","categoria":"categoria","confianca":"alta"}]}. Se nao encontrar: {"produtos":[]}';
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
  const resp=await anthropic.messages.create({model:'claude-haiku-4-5-20251001',max_tokens:2000,messages});
  return parseJSONSeguro(resp.content[0].text);
}

async function salvarPromocoes(produtos,mercadoNome,hash){
  const inserts=produtos.map(p=>{
    const ppU=calcularPrecoPorUnidade(p.preco,p.quantidade,p.unidade);
    return{mercado_nome:mercadoNome,nome:p.nome,marca:p.marca||'',preco:p.preco,quantidade:p.quantidade||null,unidade:p.unidade||'un',unidade_padrao:p.unidade||'un',preco_por_unidade:ppU,categoria:p.categoria||'Outros',foto_hash:hash};
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
    const paginas=await pdfParaImagens(req.file.buffer);
    if(!paginas.length)return res.status(422).json({erro:'Nao foi possivel processar o PDF.'});
    const anthropic=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY});
    const todosProdutos=[];
    for(let i=0;i<Math.min(paginas.length,5);i++){
      const dados=await extrairComIA(anthropic,[paginas[i]],'paginas');
      if(dados.produtos&&dados.produtos.length)todosProdutos.push(...dados.produtos);
    }
    if(!todosProdutos.length)return res.status(422).json({erro:'Nenhum produto encontrado no PDF.'});
    hashes.add(hash);
    res.json({sucesso:true,produtos:todosProdutos,paginas:paginas.length});
  }catch(e){console.error(e);res.status(500).json({erro:e.message});}
});

app.post('/publicar',async(req,res)=>{
  try{
    const{produtos,mercado}=req.body;
    if(!produtos||!produtos.length)return res.status(400).json({erro:'Sem produtos'});
    const salvos=await salvarPromocoes(produtos,mercado,'manual-'+Date.now());
    res.json({sucesso:true,total:salvos.length});
  }catch(e){console.error(e);res.status(500).json({erro:e.message});}
});

app.get('/promocoes',async(req,res)=>{
  try{
    const{data,error}=await supabase.from('promocoes').select('*').order('criado_em',{ascending:false});
    if(error)throw error;
    res.json(data);
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