"""Detect percussive score accents; choose frame-aligned action landing targets.
Only the action clock moves. Source music, shot boundaries and reading holds stay fixed.
"""
from pathlib import Path
import numpy as np,miniaudio,json
R=Path(__file__).resolve().parents[1]
src=R.parents[1]/'宣传片/AI配乐/ITERATION.wav'
a=miniaudio.decode_file(str(src),output_format=miniaudio.SampleFormat.FLOAT32,nchannels=1,sample_rate=24000)
y=np.array(a.samples);n=2048;hop=240;w=np.hanning(n)
windows=np.lib.stride_tricks.sliding_window_view(np.pad(y,(n//2,n//2)),n)[::hop]
spec=np.abs(np.fft.rfft(windows*w));freq=np.fft.rfftfreq(n,1/24000)
# Log spectral flux identifies attacks rather than sustained loud orchestration.
log=np.log1p(spec*8);diff=np.maximum(np.diff(log,axis=0,prepend=log[:1]),0)
weights=np.where((freq>=45)&(freq<300),1.7,np.where((freq>=300)&(freq<3500),1,.25))
flux=(diff*weights).sum(axis=1);smooth=np.convolve(flux,[.2,.6,.2],mode='same')
base=np.array([np.median(smooth[max(0,i-75):i+76]) for i in range(len(smooth))]);strength=np.maximum(smooth-base,0)
peaks=[i for i in range(2,len(strength)-2) if strength[i]>=max(strength[i-2:i+3]) and strength[i]>np.percentile(strength,65)]
# Suppress neighboring peaks of the same attack, retaining the stronger one.
selected=[]
for i in sorted(peaks,key=lambda i:strength[i],reverse=True):
 if all(abs(i-j)>=16 for j in selected):selected.append(i)
selected.sort();onsets=[{'time':round(i*hop/24000,3),'strength':round(float(strength[i]),3)} for i in selected]
starts={'purchase':10,'patent':28,'wonder':43,'final':69}
controls={'purchase':[(0,0),(3.2,.0),(4,.22),(4.9,.22),(5.8,.22),(7.6,.25),(8.25,.16),(10.2,.23),(12,0)],'patent':[(0,0),(3.25,.15),(5.1,.25),(5.5,.15),(7.5,.24),(9,0)],'wonder':[(0,0),(2.7,.15),(3.8,.2),(6.2,.2),(7.3,.18),(9,.22),(10.43,.12),(11,0)],'final':[(0,0),(3.8,.18),(6.4,.26),(6.7,.12),(8.8,.24),(10,0)]}
config={'fps':30,'music':'宣传片/AI配乐/ITERATION.wav','musicSpeed':1,'method':'log spectral flux accents; choose nearby attacks; preserve shot boundaries and monotonic action clock','shots':{}};choices=[]
for kind,points in controls.items():
 knots=[]
 for t,radius in points:
  target=starts[kind]+t
  candidates=[p for p in onsets if abs(p['time']-target)<=radius]
  if candidates:
   best=max(candidates,key=lambda p:p['strength']*(.35+.65*(1-abs(p['time']-target)/max(radius,.001))))
   real=round((best['time']-starts[kind])*30)/30
  else:real=t;best=None
  knots.append([round(real,6),t])
  if radius:choices.append({'shot':kind,'originalGlobal':target,'newGlobal':round(starts[kind]+real,4),'offset':round(real-t,4),'accent':best})
 # Extremely close accents must not collapse two distinct actions.
 for i in range(1,len(knots)):
  if knots[i][0]-knots[i-1][0]<.16:knots[i][0]=points[i][0]
 config['shots'][kind]=knots
(R/'src/rhythm.json').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n')
(R/'记录/配乐卡点分析.json').write_text(json.dumps({'onsets':onsets,'actionLandings':choices,'sourceUnchanged':True,'wholeFilmSeconds':90},ensure_ascii=False,indent=2)+'\n')
for c in choices:print(c['shot'],c['originalGlobal'],'→',c['newGlobal'],'offset',c['offset'])
