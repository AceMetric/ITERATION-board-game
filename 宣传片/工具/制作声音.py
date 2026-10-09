"""Editable original score and processed CC0 foley. Needs only NumPy + macOS afconvert.
Run after visual approval: python3 制作声音.py
The composition is original additive synthesis, not a recording of an orchestra.
"""
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import urljoin, unquote, urlparse, quote
from html.parser import HTMLParser
import numpy as np
import wave, json, hashlib, subprocess

OUT=Path(__file__).resolve().parents[1]
DEST=OUT/'素材/声音'
RAW=DEST/'来源'
SR=48000
SEED=20261009
RNG=np.random.default_rng(SEED)
RECORDS=[]

def pcm24(path, x):
    path.parent.mkdir(parents=True,exist_ok=True)
    x=np.asarray(x,dtype=np.float64)
    if x.ndim==1:x=np.column_stack([x,x])
    x=x-x.mean(axis=0,keepdims=True)
    peak=float(np.max(np.abs(x)))
    if peak>=.99:raise ValueError(f'Clipping risk: {path}, {peak}')
    v=np.rint(x*8388607).astype(np.int32).reshape(-1)
    data=np.column_stack([v&255,(v>>8)&255,(v>>16)&255]).astype(np.uint8).tobytes()
    with wave.open(str(path),'wb') as f:
        f.setnchannels(2);f.setsampwidth(3);f.setframerate(SR);f.writeframes(data)
    return {'path':str(path.relative_to(OUT.parent)),'sampleRate':SR,'channels':2,'bitDepth':24,'duration':round(len(x)/SR,3),'peakDbFS':round(20*np.log10(max(peak,1e-12)),2),'rmsDbFS':round(20*np.log10(max(float(np.sqrt(np.mean(x*x))),1e-12)),2),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}

def fade(x, a=.05, b=.1):
    x=x.copy();n=len(x)
    aa=min(n,int(a*SR));bb=min(n,int(b*SR))
    shape=(-1,1) if x.ndim==2 else (-1,)
    if aa:x[:aa]*=np.linspace(0,1,aa).reshape(shape)
    if bb:x[-bb:]*=np.linspace(1,0,bb).reshape(shape)
    return x

def stereo(x,pan=0):
    return np.column_stack([x*np.sqrt((1-pan)/2),x*np.sqrt((1+pan)/2)])

def colornoise(dur,low=40,high=2000):
    n=int(dur*SR);freq=np.fft.rfftfreq(n,1/SR)
    spec=np.fft.rfft(RNG.normal(size=n))
    weight=np.minimum(1,(freq/max(low,1))**2)/(1+(freq/high)**4)
    y=np.fft.irfft(spec*weight,n=n)
    return y/max(np.max(np.abs(y)),1e-8)

def voice(midi,dur,kind='strings'):
    t=np.arange(int(dur*SR))/SR;freq=440*2**((midi-69)/12)
    vib=.002*np.sin(2*np.pi*4.8*t)
    phase=2*np.pi*freq*(t+np.cumsum(vib)/SR)
    y=np.zeros_like(t)
    for h in range(1,13):
        weight=(1/h**1.65 if kind=='strings' else (1/h**1.1)*np.exp(-h/8) if kind=='horn' else 1/h**2.2)
        y+=weight*np.sin(h*phase+.09*h)
    attack=.55 if kind=='strings' else .09 if kind=='horn' else .012
    env=np.minimum(1,t/attack)*np.minimum(1,(dur-t)/(.55 if kind=='strings' else .25))
    if kind=='bell':env*=np.exp(-t*1.8)
    if kind=='horn':env*=.8+.2*np.minimum(1,t/.4)
    return y*env*.28

def reverb(x):
    y=x.copy()
    for delay,gain in [(.073,.16),(.149,.12),(.257,.10),(.411,.07),(.673,.045),(.977,.025)]:
        k=int(delay*SR);y[k:]+=x[:-k,::-1]*gain
    return y

def original_score():
    beat=60/72;bar=beat*4;dur=24*bar+5
    stems={k:np.zeros((int(dur*SR),2)) for k in ['弦乐与空间','铜管主题','钟音与脉动','鼓与金属']}
    notes=[]
    def add(track,at,y,amp=1,pan=0):
        y=stereo(y,pan)*amp;start=int(at*SR);end=min(len(stems[track]),start+len(y))
        if end>start:stems[track][start:end]+=y[:end-start]
    chords=[[50,57,62,66],[43,55,59,62],[47,54,59,62],[45,57,61,64],[50,57,62,66],[43,55,59,62],[40,55,59,64],[45,57,61,64]]
    theme=[(0,62,1.5),(1.5,66,.5),(2,69,1),(3,73,1),(4,74,2),(6,73,1),(7,69,1),(8,67,1.5),(9.5,66,.5),(10,64,1),(11,66,1),(12,69,2),(14,66,1),(15,64,1)]
    for b in range(24):
        chord=chords[b%8] if b<22 else [38,50,57,62,66,69]
        level=.28+.025*min(b,18)
        for i,note in enumerate(chord):
            add('弦乐与空间',b*bar,voice(note,bar+.7),level,(-.5+i*.22))
        if b<4 or b>=22:
            add('钟音与脉动',b*bar,voice(chord[-1]+12,bar,'bell'),.75,.35)
        if 4<=b<22:
            for eighth in range(8):
                n=chord[[1,2,3,2,1,2,3,2][eighth]]+12
                add('钟音与脉动',b*bar+eighth*beat/2,voice(n,beat*.8,'bell'),.28+.015*b,np.sin(eighth)*.4)
        if 8<=b<22:
            for bt in [0,2]:
                t=np.arange(int(1.3*SR))/SR
                kick=np.sin(2*np.pi*(48*t+34*(1-np.exp(-t*10))/10))*np.exp(-t*4)
                add('鼓与金属',b*bar+bt*beat,kick,.6 if b<16 else .9,-.1)
            for bt in [1,3]:
                y=colornoise(.4,200,6000)*np.exp(-np.arange(int(.4*SR))/SR*16)
                add('鼓与金属',b*bar+bt*beat,y,.25,.3)
        if b in [8,16,22]:
            t=np.arange(int(4*SR))/SR
            add('鼓与金属',b*bar,colornoise(4,1200,14000)*np.exp(-t*1.4),.4,-.3)
    for startbar in [8,12,16,20]:
        for bt,midi,length in theme:
            if startbar==20 and bt>=8:break
            add('铜管主题',startbar*bar+bt*beat,voice(midi,length*beat+.18,'horn'),.85 if startbar<16 else 1.05,-.1)
            notes.append({'beat':startbar*4+bt,'midi':midi,'durationBeats':length})
    add('铜管主题',22*bar,voice(74,2*bar,'horn'),.95,0)
    for k in stems:stems[k]=fade(reverb(stems[k]),1.5,4.5)
    mix=sum(stems.values());gain=.78/np.max(np.abs(mix));mix*=gain
    for k,x in stems.items():pcm24(DEST/'分轨'/f'M01-{k}.wav',x*gain)
    r=pcm24(DEST/'M01-原创电子管弦配乐.wav',mix)
    r.update(id='M01',name='文明向前',source='Codex 原创加法合成',version=1,bpm=72,key='D major',description='约85秒电子管弦版本，弦乐空间、上行铜管主题、钟音脉动与鼓组逐渐汇聚；四份分轨可重新混音。不是现场管弦录音。',shots=[str(i).zfill(2) for i in range(1,11)])
    RECORDS.append(r)
    (DEST/'M01-乐谱参数.json').write_text(json.dumps({'seed':SEED,'bpm':72,'bars':24,'key':'D major','chordsMidi':chords,'hornTheme':notes,'masterGain':float(gain)},ensure_ascii=False,indent=2)+'\n')

class Links(HTMLParser):
    def __init__(self):super().__init__();self.urls=[]
    def handle_starttag(self,tag,attrs):
        if tag=='a':
            a=dict(attrs)
            if 'href' in a:self.urls.append(a['href'])

def source(page,filename,author):
    html=urlopen(Request(page,headers={'User-Agent':'Mozilla/5.0'}),timeout=40).read().decode()
    parser=Links();parser.feed(html)
    links=[urljoin(page,u) for u in parser.urls if unquote(urlparse(u).path).endswith('/'+filename)]
    if not links:raise ValueError(f'Missing source file on {page}: {filename}')
    url=links[0];safe=quote(url,safe=':/?=&%')
    file=RAW/filename;RAW.mkdir(parents=True,exist_ok=True)
    if not file.exists():file.write_bytes(urlopen(Request(safe,headers={'User-Agent':'Mozilla/5.0'}),timeout=60).read())
    info={'page':page,'download':url,'file':str(file.relative_to(OUT.parent)),'author':author,'license':'CC0','sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
    (RAW/(filename+'.来源.json')).write_text(json.dumps(info,ensure_ascii=False,indent=2)+'\n')
    converted=RAW/(file.stem+'-48k.wav')
    if not converted.exists():subprocess.run(['/usr/bin/afconvert','-f','WAVE','-d','LEI16@48000',str(file),str(converted)],check=True,capture_output=True)
    with wave.open(str(converted),'rb') as f:
        ch=f.getnchannels();x=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').reshape(-1,ch)/32768
    if x.shape[1]==1:x=np.repeat(x,2,axis=1)
    return x[:,:2],info

def normalize(x,peak=.48):return x*peak/max(np.max(np.abs(x)),1e-9)

def loop(x,dur):
    # Equal-power crossfade avoids discontinuities at repeated recording boundaries.
    target=int(dur*SR);cross=min(int(.18*SR),len(x)//5)
    y=x.copy();ramp=np.linspace(0,1,cross)[:,None]
    while len(y)<target:
        joint=y[-cross:]*(1-ramp)+x[:cross]*ramp
        y=np.concatenate([y[:-cross],joint,x[cross:]],axis=0)
    return fade(y[:target],.3,.7)

def foley():
    specs=[
      ('A01','火声','https://opengameart.org/content/fire-crackling','fire-1.wav','AntumDeluge',12),
      ('A02','田野与流水','https://opengameart.org/content/waterflow-sound','waterflow.mp3','TyberiusGames',12),
      ('A03','纸页','https://opengameart.org/content/scorchers-foley-sounds','paper_rustling.wav','scorcher24',0),
      ('A04','建造','https://opengameart.org/content/metal-impact-sounds','thud2.wav','Brian MacIntosh / BMacZero',0),
      ('A05','卡牌','https://opengameart.org/content/various-paper-sound-effects','paper_sound_-_1.mp3','Luckius',0),
      ('A06','蒸汽与金属','https://opengameart.org/content/steam-boiler-sound-loop','generator_loop.wav','bart',12),
      ('A08','群山风声','https://opengameart.org/content/short-wind-sound','short wind sound.wav','remaxim',12),
    ]
    for id,name,page,file,author,dur in specs:
        x,info=source(page,file,author)
        if id=='A04':
            # Three measured, separated construction impacts with softer higher frequencies.
            base=x.copy();x=np.zeros((int(3.6*SR),2))
            for at,level in [(0,.9),(.85,.7),(1.8,1)]:
                start=int(at*SR);n=min(len(base),len(x)-start);x[start:start+n]+=base[:n]*level
        if id=='A05':x=x[:int(min(.75,len(x)/SR)*SR)]
        x=loop(x,dur) if dur else fade(x,.008,.08)
        r=pcm24(DEST/f'{id}-{name}.wav',normalize(x))
        r.update(id=id,name=name,version=1,shots=[id[1:]],source=info,processing='48kHz/24bit stereo；去直流；峰值归一；短淡入淡出'+('；录音交叉淡化延展至12秒' if dur else ''),description={'A04':'沉稳建造敲击；来自金属低沉撞击录音的三次编排。','A05':'纸张短滑动拟作卡牌落位；不是实录桌游卡牌。','A02':'灌溉与河流的水声，田野感由画面承担。','A08':'山间风声氛围；原始短风声经过延展。'}.get(id,name))
        RECORDS.append(r)

def electronic():
    dur=6;t=np.arange(int(dur*SR))/SR;x=np.zeros_like(t)
    for at,note in [(0,74),(.6,81),(1.2,86),(2.4,81),(3,86),(3.6,90)]:
        y=voice(note,.75,'bell');i=int(at*SR);x[i:i+len(y)]+=y
    r=pcm24(DEST/'A07-电子脉冲.wav',normalize(fade(reverb(stereo(x,.1)),.03,.4),.4));r.update(id='A07',name='电子脉冲',shots=['07'],version=1,source='Codex 原创合成',description='固定音列的轻微电子脉冲，适配知识节点连接。');RECORDS.append(r)
    dur=16;t=np.arange(int(dur*SR))/SR;x=np.zeros_like(t)
    for f,a in [(55,.4),(82.4069,.2),(110,.11),(164.8138,.08)]:x+=a*np.sin(2*np.pi*f*t+.18*np.sin(2*np.pi*.09*t))
    x+=colornoise(dur,50,500)*.07
    r=pcm24(DEST/'A09-深空氛围.wav',normalize(fade(reverb(stereo(x,.05)),2,3),.3));r.update(id='A09',name='深空氛围',shots=['09'],version=1,source='Codex 原创合成',description='低频和声与缓慢漂移的氛围设计，作为游戏未来愿景的声音。');RECORDS.append(r)

def main():
    DEST.mkdir(parents=True,exist_ok=True)
    original_score();foley();electronic()
    RECORDS.sort(key=lambda x:x['id'])
    (OUT/'记录/声音记录.json').write_text(json.dumps(RECORDS,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps([{'id':r['id'],'duration':r['duration'],'peakDbFS':r['peakDbFS']} for r in RECORDS],ensure_ascii=False))

if __name__=='__main__':main()
