import csv,io,json,unicodedata,urllib.request,datetime
from pathlib import Path
profiles=[
('muller-brockmann','Josef Müller-Brockmann',['Josef Müller-Brockmann']),('hofmann','Armin Hofmann',['Armin Hofmann']),('ruder','Emil Ruder',['Emil Ruder']),('weingart','Wolfgang Weingart',['Wolfgang Weingart']),('tschichold','Jan Tschichold',['Jan Tschichold']),('bill','Max Bill',['Max Bill']),('aicher','Otl Aicher',['Otl Aicher']),('gerstner','Karl Gerstner',['Karl Gerstner']),('bayer','Herbert Bayer',['Herbert Bayer']),('moholy-nagy','László Moholy-Nagy',['László Moholy-Nagy']),('lissitzky','El Lissitzky',['El Lissitzky']),('rodchenko','Aleksandr Rodchenko',['Aleksandr Rodchenko','Alexander Rodchenko']),('cassandre','A. M. Cassandre',['A. M. Cassandre','A.M. Cassandre','Adolphe Mouron']),('bass','Saul Bass',['Saul Bass']),('rand','Paul Rand',['Paul Rand']),('glaser','Milton Glaser',['Milton Glaser']),('vignelli','Massimo Vignelli',['Massimo Vignelli']),('scher','Paula Scher',['Paula Scher']),('greiman','April Greiman',['April Greiman']),('carson','David Carson',['David Carson']),('brody','Neville Brody',['Neville Brody']),('tanaka','Ikko Tanaka',['Ikko Tanaka']),('fukuda','Shigeo Fukuda',['Shigeo Fukuda']),('kamekura','Yusaku Kamekura',['Yusaku Kamekura']),('yokoo','Tadanori Yokoo',['Tadanori Yokoo']),('matsunaga','Shin Matsunaga',['Shin Matsunaga']),('sato','Koichi Sato',['Koichi Sato','Kōichi Satō']),('troxler','Niklaus Troxler',['Niklaus Troxler']),('schraivogel','Ralph Schraivogel',['Ralph Schraivogel'])]
norm=lambda s:''.join(c for c in unicodedata.normalize('NFKD',s).lower() if c.isalnum())
url='https://media.githubusercontent.com/media/MuseumofModernArt/collection/main/Artworks.csv'
rows=[]
with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'PosterLab personal collection research'}),timeout=90) as response:
 reader=csv.DictReader(io.TextIOWrapper(response,encoding='utf-8-sig',newline=''))
 for r in reader:
  matches=[(key,name) for key,name,aliases in profiles if any(norm(alias) in norm(r.get('Artist','')) for alias in aliases)]
  if not matches or not r.get('ImageURL') or r.get('Cataloged')!='Y':continue
  if r.get('Classification') not in ['Design','Graphic Design','Print','Prints','Illustrated Book','Drawing']:continue
  if not any(t in r.get('Medium','').lower() for t in ['paper','print','lithograph','screen','letterpress','offset','lino','etch','woodcut']):continue
  for key,name in matches:
   rows.append({'designerID':key,'designer':name,'workID':'moma-'+r['ObjectID'],'title':r['Title'],'creator':r['Artist'],'classification':r['Classification'],'medium':r['Medium'],'date':r['Date'],'credit':r['CreditLine'],'accession':r['AccessionNumber'],'recordURL':r['URL'],'imageURL':r['ImageURL'],'museum':'The Museum of Modern Art','metadataSource':'https://github.com/MuseumofModernArt/collection','metadataLicense':'CC0; catalog metadata only','imageRights':'Artwork/image rights are separate from catalog metadata. Retained for local personal research; not licensed as CC0 or bundled for redistribution.'})
root=Path('output/designer-references');root.mkdir(parents=True,exist_ok=True)
manifest={'version':'designer-reference-catalog-v1','retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'datasetURL':url,'profiles':[{'id':k,'name':n,'availableWorks':sum(x['designerID']==k for x in rows)} for k,n,a in profiles],'works':rows}
(root/'catalog.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False))
print([(p['name'],p['availableWorks']) for p in manifest['profiles']],flush=True)
print('Total credited graphic work records:',len(rows),flush=True)
