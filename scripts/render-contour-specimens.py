from pathlib import Path
import json,subprocess
root=Path(__file__).resolve().parent.parent
out=root/'output/contour-systems-v1';binary=root/'.build/image-library/release/poster'
recipes={r['id']:r for r in json.loads((root/'Sources/PosterCore/Resources/ShapeLibrary/ContourRecipes.json').read_text())}
cases=[
 ('rkc', 'contour-letter-channels', {}, {}),
 ('word-lines','contour-letter-channels',{'construction':1,'layout':0,'spacing':.012,'count':10},{'text':'DARK CURRENTS','secondaryInk':'#3154b4'}),
 ('counter-test','contour-letter-channels',{'construction':0,'expansion':.065,'spacing':.009,'count':12},{'text':'B8O','secondaryInk':'#dd6446'}),
 ('word','contour-letter-channels',{'construction':0,'layout':1,'expansion':.08,'spacing':.014,'count':12},{'text':'FORM'}),
 ('rounded-grid','contour-letter-channels',{'construction':0,'layout':2,'rounded':1,'count':12,'spacing':.008},{'text':'BAUHAUS'}),
 ('profiles','contour-profile-channels',{}, {'secondaryInk':'#eeeae1'}),
 ('parallel-profile','contour-profile-channels',{'mode':0,'copies':1,'satellites':0,'spacing':.014,'count':20,'expansion':.04},{}),
 ('custom-silhouette','contour-profile-channels',{'mode':0,'spacing':.012,'count':20,'expansion':.12},{'outline':json.loads((out/'custom-silhouette.json').read_text()),'secondaryInk':'#da6148'})]
for name,id,values,custom in cases:
 folder=out/'specimens'/name
 if folder.exists():continue
 p={'version':'poster-shape-preset-v1','recipe':recipes[id],'seed':817,'parameters':values,'contour':dict(version='contour-customization-v1',**custom)}
 if id.endswith('letter-channels'):p['fontProfileID']='archivoblack-ArchivoBlack-Regular-w400-d100'
 path=out/('.'+name+'-preset.json');path.write_text(json.dumps(p))
 subprocess.run([str(binary),'shape-library','render','--preset',str(path),'--out',str(folder)],cwd=root,check=True,stdout=subprocess.DEVNULL);path.unlink()
 print('Rendered',name,flush=True)
