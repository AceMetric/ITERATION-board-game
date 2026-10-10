"""Final master/share-copy checks; no perceptual quality score."""
from pathlib import Path
import hashlib,json,re,subprocess
import numpy as np
import imageio_ffmpeg
R=Path(__file__).resolve().parents[1];F=imageio_ffmpeg.get_ffmpeg_exe()
master=R/'输出/更迭-90秒混合宣传片-4K.mp4';share=R/'输出/更迭-90秒混合宣传片.mp4';before=R/'输出/1080P增强基准/Hybrid.mp4'
def decode(p,size):
 s=subprocess.run([F,'-hide_banner','-xerror','-i',str(p),'-f','null','-'],capture_output=True,text=True,check=True).stderr
 assert f'{size[0]}x{size[1]}'in s and '30 fps'in s,p
 n=int(re.findall(r'frame=\s*(\d+)',s)[-1]);assert n==2700,(p,n)
 assert re.search(r'Audio: aac.*48000 Hz, stereo',s)
 return {'file':str(p.relative_to(R)),'size':size,'frames':n,'fps':30,'fullDecode':'passed','sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
def pcm(p):
 b=subprocess.check_output([F,'-v','error','-i',str(p),'-map','0:a:0','-ac','2','-ar','48000','-c:a','pcm_f32le','-f','f32le','-'])
 return np.frombuffer(b,np.float32)
a,b,c=map(pcm,[master,share,before]);assert np.array_equal(a,b),'Share-copy audio changed'
assert len(a)==len(c),(len(a),len(c));error=float(np.max(np.abs(a-c)));assert error<1e-6,('audio changed',error)
peak=float(np.abs(a).max());assert peak<1,('clipping',peak)
frozen=json.loads((R/'记录/画质增强-时序与声音基准.json').read_text())
for p,sha in frozen.items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==sha,p
cadence=json.loads((R/'记录/AI逐帧时序核对.json').read_text());assert cadence['passed']and cadence['checkedFrames']==879
report={'passed':True,'videos':[decode(master,[3840,2160]),decode(share,[1920,1080])],'masterAndShareDecodedAudioIdentical':True,'baselineDecodedAudioMaxDifference':error,'peakDBFS':float(20*np.log10(peak)),'timingAudioFilesUnchanged':True,'threeDNative4K':True,'aiSource':[852,480],'aiOutput':[3840,2160],'aiNative4K':False,'aiFrameMatching':{'checkedFrames':cadence['checkedFrames'],'passed':cadence['passed'],'report':'记录/AI逐帧时序核对.json'},'visualScope':'All plain AI frames matched to source; transitions separately checked; normal/half-speed playback samples. Technical checks do not prove every visual detail.'}
(R/'记录/4K交付核对.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('4K master / 1080P share fully decoded; baseline audio identical; no clipping')
