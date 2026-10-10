from pathlib import Path
import numpy as np,miniaudio,wave,json,subprocess,hashlib
import imageio_ffmpeg
R=Path(__file__).resolve().parents[1];S=R.parent/'素材/声音';sr=48000;rng=np.random.default_rng(28625)
shots=[('00',4),('01',6),('02',12),('03',6),('04',9),('05',6),('06',11),('07',5),('08',10),('09',10),('10',6),('11',5)]
def read(p):
 d=miniaudio.decode_file(str(p),output_format=miniaudio.SampleFormat.FLOAT32,nchannels=2,sample_rate=sr)
 return np.array(d.samples,dtype=np.float64).reshape(-1,2)
def fade(a,fi=.03,fo=.08):
 a=a.copy();n=min(len(a),int(fi*sr));m=min(len(a),int(fo*sr))
 if n:a[:n]*=np.linspace(0,1,n)[:,None]
 if m:a[-m:]*=np.linspace(1,0,m)[:,None]
 return a
def write(p,a):
 a=np.clip(a,-.94,.94);v=np.rint(a*8388607).astype(np.int32).ravel().astype(np.uint32);b=np.column_stack([v&255,(v>>8)&255,(v>>16)&255]).astype(np.uint8).tobytes()
 with wave.open(str(p),'wb')as f:f.setnchannels(2);f.setsampwidth(3);f.setframerate(sr);f.writeframes(b)
def tap(length=.13,seed=0):
 n=int(sr*length);t=np.arange(n)/sr;r=np.random.default_rng(100+seed);noise=r.normal(size=n);smooth=np.convolve(noise,np.ones(7)/7,mode='same');v=(smooth*.31+np.sin(t*2*np.pi*(650+seed*19))*.16)*np.exp(-t*52)*np.minimum(t/.001,1)
 return np.column_stack([v,v*.92])
def chime():
 t=np.arange(int(sr*.65))/sr;v=(np.sin(2*np.pi*660*t)+.6*np.sin(2*np.pi*990*t))*np.exp(-t*7)*np.minimum(t/.007,1)*.045;return np.column_stack([v,v])
card=fade(read(S/'A05-卡牌.wav'))*.6
mix_config=json.loads((R/'src/mix.json').read_text());atten={k:10**(v/20) for k,v in mix_config['attenuationDB'].items()}
buses={bus:{id:np.zeros((sec*sr,2)) for id,sec in shots} for bus in atten};events=[]
rhythm=json.loads((R/'src/rhythm.json').read_text())['shots'];kindByID={'02':'purchase','04':'patent','06':'wonder','09':'final'}
def presentation_time(id,at):
 knots=rhythm.get(kindByID.get(id));
 if not knots:return at
 slopes=[(b[1]-a[1])/(b[0]-a[0]) for a,b in zip(knots,knots[1:])]
 def tangent(j):return 1 if j in [0,len(knots)-1] else 2*slopes[j-1]*slopes[j]/(slopes[j-1]+slopes[j])
 def source(t):
  if t<=0 or t>=knots[-1][0]:return t
  i=next(i for i in range(len(knots)-1) if t<=knots[i+1][0]);x,y=knots[i];xx,yy=knots[i+1];h=xx-x;u=(t-x)/h
  return (2*u**3-3*u*u+1)*y+(u**3-2*u*u+u)*h*tangent(i)+(-2*u**3+3*u*u)*yy+(u**3-u*u)*h*tangent(i+1)
 lo=0;hi=knots[-1][0]
 for _ in range(40):
  mid=(lo+hi)/2
  if source(mid)<at:lo=mid
  else:hi=mid
 return (lo+hi)/2
def add(id,sound,at,gain=1,label=''):
 source_at=at;at=presentation_time(id,at)
 bus='cue' if 'chime' in label else 'ambience' if 'ambience' in label else 'operation'
 a=buses[bus][id];st=int(at*sr);n=min(len(sound),len(a)-st)
 if n>0:a[st:st+n]+=sound[:n]*gain
 events.append({'shot':id,'at':at,'sourceActionTime':source_at,'source':label,'gain':gain,'bus':bus,'attenuationDB':mix_config['attenuationDB'][bus]})
for id,times in {'02':[1.3,4,4.9,5.8,7.6,8.25,10.2],'04':[1.6,3.25,7.5],'06':[2.7,3.8,6.2,7.3,9,9.35,9.53,9.71,9.89,10.07,10.15,10.25,10.43],'09':[1.5,3.8,8.8],'11':[.25]}.items():
 for at in times:add(id,card,at,1,'A05-卡牌.wav')
for id,start,end,count in [('04',2.7,5.1,2),('09',4,6.4,5)]:
 for i in range(count):
  for j,p in enumerate([.04,.24,.43,.61,.76,.88,.96]):add(id,tap(seed=i*7+j),start+(end-start)*p,1-.65*p,'procedural dice / fixed seed')
for id,at in [('00',1.35),('11',1.8),('02',8),('04',5.5),('09',6.7)]:add(id,chime(),at,1,'procedural soft chime')
# Pending AI scenes use existing licensed environment beds, never pretend they are generated video.
beds={'01':('A01-火声.wav',.35),'03':('A02-田野与流水.wav',.12),'05':('A04-建造.wav',.24),'07':('A06-蒸汽与金属.wav',.3),'08':('A08-群山风声.wav',.4),'10':('A09-深空氛围.wav',.4)}
ai=json.loads((R/'src/ai.json').read_text());ai_missing_audio=[]
for id,(name,gain) in beds.items():
 if ai[id]['status']!='ready':
  snd=read(S/name);n=len(buses['ambience'][id]);snd=np.tile(snd,(int(np.ceil(n/len(snd))),1))[:n];add(id,fade(snd,.2,.4),0,gain,name+' / placeholder ambience')
# Explicitly selected score: preserve its timing, dynamics and existing ending.
music_config=json.loads((R/'src/music.json').read_text())
music_source=R.parents[1]/music_config['source'];music=read(music_source);N=90*sr;tempo=1.0
if music_config['fit']!='preserve-speed' or len(music)!=N:
 raise SystemExit('当前配乐需完整90秒且原速接入；请先明确调整方案。')
music_gain=float(music_config['gain']);pad=music*music_gain
out={id:sum(buses[bus][id]*atten[bus] for bus in buses) for id,sec in shots}
master=pad.copy();offset=0
for id,sec in shots:
 write(R/'public/audio'/f'{id}-foley.wav',out[id]);master[offset*sr:(offset+sec)*sr]+=out[id]-buses['ambience'][id]*atten['ambience'];offset+=sec
ambience=np.concatenate([buses['ambience'][id] for id,sec in shots])
# Sound handles use the same per-edit source windows and speed curve as picture.
starts={};cursor=0
for id,sec in shots:starts[id]=cursor;cursor+=sec
edit=json.loads((R/'src/edit.json').read_text());ambience_bridges=[]
def mix_handle(snd,start,gain=.65):
 st=int(round(start*sr));n=min(len(snd),len(ambience)-st)
 if st<0:snd=snd[-st:];st=0;n=min(len(snd),len(ambience))
 if n>0:ambience[st:st+n]+=snd[:n]*gain

def retime(native,start,n,L,id,edge):
 cache=R/'.cache'/f'audio-{id}-{edge}.wav';pieces=[];chains=[];count=6
 # Constant-tempo pieces approximate the picture's Hermite curve without changing pitch.
 def source(u):return ((-2*u**3+3*u*u)*(n-1)+(u**3-2*u*u+u)*(L-1)+(u**3-u*u)*(L-1))/30
 for k in range(count):
  u=k/count;v=(k+1)/count;x=source(u);y=source(v);duration=L/30/count;speed=(y-x)/duration;filters=[]
  while speed<.5:filters.append('atempo=0.5');speed/=.5
  filters.append(f'atempo={speed:.8f}')
  chains.append(f'[0:a]atrim=start={start+x}:end={start+y},asetpts=PTS-STARTPTS,'+','.join(filters)+f',apad,atrim=duration={duration}[a{k}]');pieces.append(f'[a{k}]')
 chains.append(''.join(pieces)+f'concat=n={count}:v=0:a=1[out]')
 subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(native),'-filter_complex',';'.join(chains),'-map','[out]','-ac','2','-ar',str(sr),str(cache)],check=True)
 return read(cache)

for id in beds:
 native=R/'public/audio'/f'{id}-ai.wav'
 if ai[id]['status']!='ready':continue
 if not native.exists():ai_missing_audio.append(id);continue
 snd=read(native);sec=len(buses['ambience'][id])/sr;head=next(j for j in edit['joins'] if j['pair'].endswith('-'+id));tail=next(j for j in edit['joins'] if j['pair'].startswith(id+'-'))
 body=snd[int((head['post']/30-.08)*sr):int((sec-tail['pre']/30+.08)*sr)];mix_handle(fade(body,.16,.16),starts[id]+head['post']/30-.08)
 for edge,j,n in [('head',head,head['post']),('tail',tail,tail['pre'])]:
  L=j['pre']+j['post'];source_start=0 if edge=='head' else sec-n/30;boundary=starts[id] if edge=='head' else starts[id]+sec;at=boundary-j['pre']/30
  handle=retime(native,source_start,n,L,id,edge);times=np.arange(len(handle))/sr+at
  if edge=='head':env=np.clip((times-(boundary-j['audioLead']))/.2,0,1)*np.clip((at+L/30-times)/.12,0,1)
  else:env=np.clip((times-at)/.12,0,1)*np.clip((boundary+j['audioTail']-times)/.25,0,1)
  handle*=env[:,None];mix_handle(handle,at);ambience_bridges.append({'shot':id,'edge':edge,'start':at,'duration':L/30,'audioLead':j['audioLead'],'audioTail':j['audioTail'],'pitchPreserved':True,'editConfig':j['pair']})
# Freeze the old mastering gain. Reducing effects must never raise the score.
gain=float(mix_config['masterGain']);master+=ambience*atten['ambience']
measurements={}
for bus in buses:
 reference=ambience if bus=='ambience' else np.concatenate([buses[bus][id] for id,sec in shots])
 reduced=reference*atten[bus]
 measurements[bus]={'requestedDB':mix_config['attenuationDB'][bus],'measuredDB':float(20*np.log10(np.sqrt(np.mean(reduced**2))/np.sqrt(np.mean(reference**2))))}
 write(R/'public/audio'/f'{bus}.wav',reduced*gain)
write(R/'public/audio/effects.wav',master-pad)
write(R/'public/audio/music.wav',pad)
master*=gain
if np.max(np.abs(master))>=.94:raise SystemExit('混音超出峰值余量；请检查分轨，不可自动整体增响。')
write(R/'public/audio/master.wav',master);write(R/'输出/90秒审片混音.wav',master)
pilot=np.concatenate([pad[10*sr:22*sr]+out['02'],pad[59*sr:69*sr]+out['08']])
# The non-contiguous pilot uses its own short wind lead and native body.
snd=fade(read(R/'public/audio/08-ai.wav'),.35,.4);st=12*sr;n=min(len(snd),len(pilot)-st);pilot[st:st+n]+=snd[:n]*.65*atten['ambience']
pilot*=gain;write(R/'public/audio/pilot.wav',fade(pilot,.05,.3))
(R/'记录/声音核对.json').write_text(json.dumps({'duration':90,'sampleRate':sr,'bits':24,'channels':2,'peakDBFS':float(20*np.log10(np.max(np.abs(master)))),'events':events,'musicSource':music_config['source'],'musicSourceSHA256':hashlib.sha256(music_source.read_bytes()).hexdigest(),'musicDuration':len(music)/sr,'musicGain':music_gain,'preservedSourceTiming':True,'musicTempo':tempo,'masterGain':gain,'musicEffectiveGain':music_gain*gain,'autoNormalize':False,'busMeasurements':measurements,'mixConfig':mix_config,'aiWithoutAudio':ai_missing_audio,'ambienceBridges':ambience_bridges,'notes':'逐镜配置声音提前进入与延续；环境声分段保调匹配画面速度曲线；使用用户生成并指定的ITERATION.wav原速配乐；操作音效降低12dB、提示音14dB、环境声10dB，冻结原配乐有效增益且不自动整体增响；既有音效记录见 宣传片/记录/声音记录.json；骰声及提示音由本脚本生成。AI占位环境音不代表生成结果。'},ensure_ascii=False,indent=2)+'\n')
print('Audio ready: 90-second master, 22-second pilot and shot foley.')
