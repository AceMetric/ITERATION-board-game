from pathlib import Path
import json, subprocess, wave
import numpy as np
import miniaudio
ROOT=Path(__file__).resolve().parents[1]
NODE='/Users/acemetric/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
config=json.loads(subprocess.check_output([NODE,'--input-type=module','-e',"import {SETTINGS} from "+json.dumps((ROOT/'程序/参数.js').as_uri())+";console.log(JSON.stringify(SETTINGS))"],text=True))
SR=48000;N=int(config['duration']*SR)
sounds=ROOT.parent/'素材/声音'
def read(name):
    d=miniaudio.decode_file(str(sounds/name),output_format=miniaudio.SampleFormat.FLOAT32,nchannels=2,sample_rate=SR)
    return np.asarray(d.samples,dtype=np.float64).reshape(-1,2)
def fades(a,fadein=.06,fadeout=.15):
    a=a.copy();ni=min(len(a),int(fadein*SR));no=min(len(a),int(fadeout*SR))
    a[:ni]*=np.linspace(0,1,ni)[:,None];a[-no:]*=np.linspace(1,0,no)[:,None];return a
music=read('M01-原创电子管弦配乐.wav');start=int(config['audio']['musicStart']*SR)
music=fades(music[start:start+N],.25,.9)
t=np.arange(N)/SR;music*=np.interp(t,[0,6,12,18],[.66,.76,.87,.87])[:,None]
result=music.copy();events=[]
for event in config['audio']['events']:
    a=read(event['file']);count=min(len(a),int(event['duration']*SR),N-int(event['at']*SR));a=fades(a[:count],.025,.2 if count>SR else .035)*event['gain'];offset=int(event['at']*SR);result[offset:offset+count]+=a;events.append({**event,'actualDuration':count/SR})
peak=float(np.max(np.abs(result)));gain=min(1,10**(-1.3/20)/peak);result*=gain
out=ROOT/'输出/样片混音.wav';out.parent.mkdir(exist_ok=True,parents=True)
integers=np.clip(np.rint(result*8388607),-8388608,8388607).astype(np.int32).ravel();u=integers.astype(np.uint32);packed=np.column_stack([u&255,(u>>8)&255,(u>>16)&255]).astype(np.uint8).tobytes()
with wave.open(str(out),'wb')as f:f.setnchannels(2);f.setsampwidth(3);f.setframerate(SR);f.writeframes(packed)
record={'duration':N/SR,'sampleRate':SR,'channels':2,'bits':24,'peakDBFS':float(20*np.log10(np.max(np.abs(result)))),'rmsDBFS':float(20*np.log10(np.sqrt(np.mean(result**2)))),'masterGain':gain,'music':{'file':'M01-原创电子管弦配乐.wav','excerptStart':config['audio']['musicStart'],'originalSynth':True},'events':events,'note':'过渡与落位使用同一秒制时间轴；现有合成配乐用于动作测试，可替换正式配乐。'}
(ROOT/'记录/混音记录.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');print(json.dumps(record,ensure_ascii=False))
