"""Measure actual decoded old/new waveforms, independent of mixer bus labels."""
from pathlib import Path
import miniaudio,numpy as np,json
R=Path(__file__).resolve().parents[1];B=R/'.cache/材质与片尾精修前'
def read(p):return np.array(miniaudio.decode_file(str(p),output_format=miniaudio.SampleFormat.FLOAT32,nchannels=2,sample_rate=48000).samples).reshape(-1,2).astype(float)
old=read(B/'master.wav');new=read(R/'public/audio/master.wav');score=read(B/'music.wav');gain=json.loads((B/'声音核对.json').read_text())['masterGain'];res0=old-score*gain;res1=new-score*gain
windows={'ambience':(5.5,7.5,-10),'cue':(1.3,2.1,-14),'operation':(13.3,16.7,-12)};measure={}
for bus,(start,end,wanted) in windows.items():
 a=res0[int(start*48000):int(end*48000)];c=res1[int(start*48000):int(end*48000)];db=float(20*np.log10(np.sqrt(np.mean(c*c))/np.sqrt(np.mean(a*a))));measure[bus]={'measuredDB':db,'requestedDB':wanted};assert abs(db-wanted)<.12,(bus,db)
assert (B/'music.wav').read_bytes()==(R/'public/audio/music.wav').read_bytes()
assert len(new)==4320000 and abs(new).max()<1
report={'passed':True,'oldAndNewMusicStemIdentical':True,'effectiveMusicGain':.9*gain,'masterGainUnchanged':gain,'isolatedWindows':measure,'peakDBFS':float(20*np.log10(abs(new).max())),'samples':len(new),'musicSpeed':1}
(R/'记录/混音实测.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('Decoded waveform verification passed:',measure)
