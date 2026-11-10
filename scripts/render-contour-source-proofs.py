from pathlib import Path
import json,subprocess,copy
root=Path(__file__).resolve().parent.parent;out=root/'output/contour-systems-v1';binary=root/'.build/image-library/release/poster'
for id,title in [('contour-letter-channels','RKC / CONTOUR STUDY'),('contour-profile-channels','CONTOUR SYSTEMS')]:
 target=out/'source-proofs'/id
 if (target/'poster.png').exists():continue
 scene=json.loads((out/'embeddings'/(id+'-scene.json')).read_text());scene.pop('composition',None);scene['posterID']=id+'-source-proof';scene['aspect']=1.414
 art=scene['elements'][0];art['bounds']=dict(x=.015,y=.015,width=.97,height=.91);art['clipBounds']=dict(x=0,y=0,width=1,height=1)
 scene['background']='#181a1b' if id.endswith('letter-channels') else '#ff6a12'
 art['color']='#f0ebdf' if id.endswith('letter-channels') else '#202322';art['contour']=dict(version='contour-customization-v1',secondaryInk='#ed9d7a' if id.endswith('letter-channels') else '#eeeae1')
 label=dict(sourceElementID='meta:contour-source-proof',kind='text',bounds=dict(x=.055,y=.945,width=.89,height=.03),rotation=0,text=title,color='#f0ebdf' if id.endswith('letter-channels') else '#202322',shape='rectangle',outline=False,shadow=False,offsetX=0,offsetY=0,copies=1,preserveTypeProportions=True,fontName='HelveticaNeue-Bold',textAlignment='left',zIndex=20)
 scene['elements'].append(label);path=out/('.'+id+'-proof.json');path.write_text(json.dumps(scene));subprocess.run([str(binary),'scene','render','--genome',str(path),'--out',str(target),'--width','900'],cwd=root,check=True,stdout=subprocess.DEVNULL);path.unlink()
print('Rendered source-proportion color studies')
