/* Pre-extracts Hiragino outlines for a bounded character set into fonts.mjs,
 * so the engine, the editor and every SVG need no font files. For each face:
 * horizontal outlines, the vertical-writing alternates the font substitutes
 * through `vert` (punctuation, brackets, ー, 〜, …, small kana, ＝, →) and
 * half-width digits (`hwid`) for tate-chū-yoko. Outlines are for local study.
 * Paths are integer font units (1000/em, y up), relative, as zigzag base-64
 * varints: commands . , ; : ! = M L C Q Z, numbers A–Z a–z 0–9 - _.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as fontkit from 'fontkit';
const dir=path.dirname(fileURLToPath(import.meta.url)),SYS='/System/Library/Fonts/';
export const FACES={
 mincho:{label:'Mincho',name:'Hiragino Mincho ProN W3',file:'ヒラギノ明朝 ProN.ttc',ps:'HiraMinProN-W3'},
 'mincho-bold':{label:'Mincho bold',name:'Hiragino Mincho ProN W6',file:'ヒラギノ明朝 ProN.ttc',ps:'HiraMinProN-W6'},
 gothic:{label:'Gothic',name:'Hiragino Kaku Gothic ProN W6',file:'ヒラギノ角ゴシック W6.ttc',ps:'HiraKakuProN-W6'},
 'gothic-heavy':{label:'Gothic heavy',name:'Hiragino Kaku Gothic StdN W8',file:'ヒラギノ角ゴシック W8.ttc',ps:'HiraKakuStdN-W8'},
 maru:{label:'Maru (rounded)',name:'Hiragino Maru Gothic ProN W4',file:'ヒラギノ丸ゴ ProN W4.ttc',ps:'HiraMaruProN-W4'}
};
// Kyōiku kanji (school grades 1–6) plus poster vocabulary and the reference copy.
const GRADES=['一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六',
 '引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話',
 '悪安暗医委意育員院飲運泳駅央横屋温化荷界開階寒感漢館岸起期客究急級宮球去橋業曲局銀区苦具君係軽血決研県庫湖向幸港号根祭皿仕死使始指歯詩次事持式実写者主守取酒受州拾終習集住重宿所暑助昭消商章勝乗植申身神真深進世整昔全相送想息速族他打対待代第題炭短談着注柱丁帳調追定庭笛鉄転都度投豆島湯登等動童農波配倍箱畑発反坂板皮悲美鼻筆氷表秒病品負部服福物平返勉放味命面問役薬由油有遊予羊洋葉陽様落流旅両緑礼列練路和',
 '愛案以衣位茨印英栄媛塩岡億加果貨課芽賀改械害街各覚潟完官管関観願岐希季旗器機議求泣給挙漁共協鏡競極熊訓軍郡群径景芸欠結建健験固功好香候康佐差菜最埼材崎昨札刷察参産散残氏司試児治滋辞鹿失借種周祝順初松笑唱焼照城縄臣信井成省清静席積折節説浅戦選然争倉巣束側続卒孫帯隊達単置仲沖兆低底的典伝徒努灯働特徳栃奈梨熱念敗梅博阪飯飛必票標不夫付府阜富副兵別辺変便包法望牧末満未民無約勇要養浴利陸良料量輪類令冷例連老労録',
 '圧囲移因永営衛易益液演応往桜可仮価河過快解格確額刊幹慣眼紀基寄規喜技義逆久旧救居許境均禁句型経潔件険検限現減故個護効厚耕航鉱構興講告混査再災妻採際在財罪殺雑酸賛士支史志枝師資飼示似識質舎謝授修述術準序招証象賞条状常情織職制性政勢精製税責績接設絶祖素総造像増則測属率損貸態団断築貯張停提程適統堂銅導得毒独任燃能破犯判版比肥非費備評貧布婦武復複仏粉編弁保墓報豊防貿暴脈務夢迷綿輸余容略留領歴',
 '胃異遺域宇映延沿恩我灰拡革閣割株干巻看簡危机揮貴疑吸供胸郷勤筋系敬警劇激穴券絹権憲源厳己呼誤后孝皇紅降鋼刻穀骨困砂座済裁策冊蚕至私姿視詞誌磁射捨尺若樹収宗就衆従縦縮熟純処署諸除承将傷障蒸針仁垂推寸盛聖誠舌宣専泉洗染銭善奏窓創装層操蔵臓存尊退宅担探誕段暖値宙忠著庁頂腸潮賃痛敵展討党糖届難乳認納脳派拝背肺俳班晩否批秘俵腹奮並陛閉片補暮宝訪亡忘棒枚幕密盟模訳郵優預幼欲翌乱卵覧裏律臨朗論'];
const EXTRA='尾込払押抜掛越超渡誘迎捜踏抱握触振揺震叫描恐怖驚喫誰僕俺彼皆互寝眠歳齢腰肩脚腕瞳唇汗怒寂偉柔硬軟濃薄鮮酢杯鍋箸缶瓶靴帽椅棚床壁畳縫紡柄紋浜嶋渓沢鎌函奇怪酔暦綺芋茸麺鮨丼餅援芭蕉幌郎之粧筑蛙唯鐵會單仙寿筐泰舞囃唐銕丞蜘蛛猶催吾輩猫踊渋袋珈琲響唄謡恋幻影闇雷嵐霧霞虹宵暁曙燈炎煙雫涙涼菊椿藤蓮柳楓藍紫珠華麗艶粋雅妙姫鬼殿湾岬峠滝沼舗菓辛豚象鯨舟帆跳戯雑込髪遅狭匠彩永遠瞬輝煌憧魂詠零壱弐祇稲穂嬢狐狸虎龍竜蝶鶴亀猿狼鳩鷲雀燕緒縁織踏響狂獅醍醐頃鍵扉窓窯陶磁漆刃剣笠傘扇凧琴笙鼓笛鈴灯籠提縞柄紋旦那爽涯岳嶺峰瀬濃淡墨硯翼羽鈍鋭彫刻晦朔弥皐';
const KANJI=[...new Set([...GRADES.join(''),...EXTRA])].join('');
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>String.fromCodePoint(a+i)).join('');
const KANA=range(0x3041,0x3096)+'ゝゞ'+range(0x30A1,0x30FA)+'ヽヾ';
// CJK punctuation and symbols are set upright, in their vertical forms where the font has them.
const PUNCT='　、。，．・：；？！゛゜〃々〆〇ー―～〜…‥（）〔〕［］｛｝〈〉「」『』【】〝〟＋－±×÷＝≠＜＞∞°′″℃￥％＃＆＊＠§☆★○●◎◇◆□■△▲▽▼※〒→←↑↓♪';
// Latin runs are set sideways (or upright, one per cell).
const LATIN=range(0x20,0x7E)+'‘’“”–—·€£©®™ÀÂÄÇÉÈÊËÎÏÔÖÙÛÜàâäçéèêëîïôöùûüßñÑ';
const ALPH='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',CMD={moveTo:['.',2],lineTo:[',',2],bezierCurveTo:[';',6],quadraticCurveTo:[':',4],closePath:['!',0]};
const num=v=>{let z=v>=0?v*2:-v*2-1,s='';while(z>=32){s+=ALPH[32+(z&31)];z>>=5;}return s+ALPH[z];};
function encode(glyph){let out='',last='',x=0,y=0,sx=0,sy=0;
 for(const c of glyph.path.commands){const [k,count]=CMD[c.command];if(!k)throw new Error('command '+c.command);
  if(k==='!'){out+='!';x=sx;y=sy;last='!';continue;}
  // Repeated commands omit their letter (a following moveTo implies lineTo, so moveTo always repeats it).
  if(k!==last||k==='.')out+=k;last=k;let px=x,py=y;
  for(let i=0;i<count;i+=2){const ax=Math.round(c.args[i]),ay=Math.round(c.args[i+1]);out+=num(ax-px)+num(ay-py);px=ax;py=ay;}
  x=px;y=py;if(k==='.'){sx=x;sy=y;}}
 return out;}
const DATA={},provenance={},hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
for(const [id,face] of Object.entries(FACES)){const file=SYS+face.file,font=fontkit.openSync(file,face.ps),all=KANJI+KANA+PUNCT+LATIN;
 const missing=[...all].filter(ch=>ch!==' '&&ch!=='　'&&!font.hasGlyphForCodePoint(ch.codePointAt(0)));if(missing.length)throw new Error(`${face.name} lacks ${missing.join('')}`);
 const g=[...all].map(ch=>encode(font.glyphForCodePoint(ch.codePointAt(0)))),vc=[],v=[];
 for(const ch of KANA+PUNCT){const base=font.glyphForCodePoint(ch.codePointAt(0)),alt=font.layout(ch,['vert']).glyphs[0];if(alt.id!==base.id){vc.push(ch);v.push(encode(alt));}}
 const h=[...'0123456789'].map(d=>{const run=font.layout(d,['hwid']),gl=run.glyphs[0];if(gl.advanceWidth!==500)throw new Error(face.name+' hwid '+d);return encode(gl);});
 DATA[id]={g:g.join('~'),a:[...LATIN].map(ch=>font.glyphForCodePoint(ch.codePointAt(0)).advanceWidth),vc:vc.join(''),v:v.join('~'),h:h.join('~')};
 provenance[id]={...face,path:file,postscriptName:font.postscriptName,family:font.familyName,version:font.version,unitsPerEm:font.unitsPerEm,ascent:font.ascent,descent:font.descent,fileSHA256:hash(file),
  glyphs:[...all].length,verticalAlternates:vc.length,features:['vert (vertical forms)','hwid (half-width digits for tate-chū-yoko)']};}
const CHARS={kanji:KANJI,kana:KANA,punct:PUNCT,latin:LATIN};
fs.writeFileSync(path.join(dir,'fonts.mjs'),`// Generated by prepare-fonts.mjs from macOS Hiragino fonts (see font-provenance.json).
// Vector outlines of a bounded character set for local study; font binaries are not embedded.
export const ALPH=${JSON.stringify(ALPH)};
export const CHARS=${JSON.stringify(CHARS)};
export const FACES=${JSON.stringify(Object.fromEntries(Object.entries(FACES).map(([k,f])=>[k,{label:f.label,name:f.name}])))};
export const DATA=${JSON.stringify(DATA)};
`);
fs.writeFileSync(path.join(dir,'font-provenance.json'),JSON.stringify({note:'Outlines extracted from fonts installed with macOS for a local type-system study only; not for redistribution.',em:{unitsPerEm:1000,ascent:880,descent:-120,box:'ideographic em box x 0–1000, y −120–880'},charset:{kanji:KANJI.length,kana:KANA.length,punctuation:PUNCT.length,latin:LATIN.length},faces:provenance},null,2));
const size=fs.statSync(path.join(dir,'fonts.mjs')).size;
console.log(`Prepared ${Object.keys(FACES).length} faces × ${[...KANJI+KANA+PUNCT+LATIN].length} glyphs (${KANJI.length} kanji); vertical alternates ${Object.values(DATA).map(d=>[...d.vc].length).join('/')}; fonts.mjs ${(size/1024).toFixed(0)} KB.`);
