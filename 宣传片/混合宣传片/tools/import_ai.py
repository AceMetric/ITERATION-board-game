"""Import the selected Jimeng videos by shot number; validate and conform locally."""
from pathlib import Path
import argparse,json,subprocess,re,hashlib,shutil,os,sys
R=Path(__file__).resolve().parents[1]
def ffmpeg():
 try:
  import imageio_ffmpeg
  return imageio_ffmpeg.get_ffmpeg_exe()
 except ImportError:
  f=shutil.which('ffmpeg')
  if not f:raise SystemExit('请使用项目的 宣传片/工具/.venv/bin/python，或安装 ffmpeg。')
  return f
F=ffmpeg()
def inspect(p):
 r=subprocess.run([F,'-hide_banner','-i',str(p)],capture_output=True,text=True).stderr
 dur=re.search(r'Duration: (\d+):(\d+):([\d.]+)',r);size=re.search(r'Video:.*? (\d{2,5})x(\d{2,5})(?:[,\s\[])',r)
 if not dur or not size:raise ValueError('无法读取视频时长或画面尺寸：'+str(p))
 h,m,s=dur.groups();w,v=map(int,size.groups());return int(h)*3600+int(m)*60+float(s),w,v,'Audio:'in r
parser=argparse.ArgumentParser(description='文件夹中命名 01.mp4、03.mp4、05.mp4、07.mp4、08.mp4、10.mp4；可分批导入。');parser.add_argument('folder',type=Path,nargs='?');parser.add_argument('--variant',choices=['original','enhanced']);parser.add_argument('--4k',action='store_true',dest='fourk');args=parser.parse_args()
if args.variant:
 subprocess.run([str(R/'.venv-upscale/bin/python'),str(R/'tools/enhance_ai.py'),args.variant]+(['--4k'] if args.fourk else []),check=True)
 for tool in ['prepare_subjects.py','prepare_bridges.py']:subprocess.run([sys.executable,str(R/'tools'/tool)],check=True)
 raise SystemExit(0)
if args.folder is None:parser.error('请提供视频文件夹，或使用 --variant。')
manifest=json.loads((R/'src/ai.json').read_text());found=0
for id,entry in manifest.items():
 candidates=[p for p in args.folder.iterdir()if p.is_file()and(p.stem==id or p.stem.lower()in [f'sense{int(id)}',f'scene{int(id)}'] or p.stem.startswith(id+'-')or p.stem.startswith(id+'_'))and p.suffix.lower()in['.mp4','.mov','.webm']]
 if not candidates:continue
 if len(candidates)>1:raise SystemExit(f'{id} 有多个候选视频；请只保留最终选定的一条。')
 src=candidates[0].resolve();duration,w,h,audio=inspect(src);sec=entry['seconds']
 if duration<sec-.05:raise SystemExit(f'{id} 视频只有 {duration:.2f} 秒，少于 {sec} 秒；请重新生成足够时长。')
 if abs(w/h-16/9)>.03:raise SystemExit(f'{id} 的比例为 {w}×{h}，请先确认并导出16:9版本。')
 # Validate the whole input before modifying the active manifest.
 subprocess.run([F,'-v','error','-xerror','-i',str(src),'-map','0:v:0','-f','null','-'],check=True)
 dest=R/'public/ai'/f'{id}.mp4';temp=dest.with_name(id+'-importing.mp4')
 subprocess.run([F,'-v','error','-y','-i',str(src),'-t',str(sec),'-vf','scale=1920:1080:flags=lanczos,fps=30,tpad=stop_mode=clone:stop_duration=0.05,setsar=1','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(temp)],check=True);os.replace(temp,dest)
 native=R/'public/audio'/f'{id}-ai.wav'
 if audio:subprocess.run([F,'-v','error','-y','-i',str(src),'-t',str(sec),'-vn','-ac','2','-ar','48000','-c:a','pcm_s24le',str(native)],check=True)
 elif native.exists():native.unlink()
 old_hash=entry.get('sourceSha256');new_hash=hashlib.sha256(src.read_bytes()).hexdigest()
 if old_hash and old_hash!=new_hash:
  entry.pop('enhancement',None);entry['activeVariant']='original'
 active=entry.get('activeVariant','original');enhanced=entry.get('enhancement')
 if active=='enhanced' and enhanced and (R/'public'/enhanced['file']).exists():dest=R/'public'/enhanced['file']
 entry['originalFile']='ai/'+id+'.mp4'
 entry.update(status='ready',file=str(dest.relative_to(R/'public')),source=str(src.relative_to(R.parents[1])) if src.is_relative_to(R.parents[1]) else str(src),nativeSize=[w,h],sourceDuration=duration,sourceSha256=hashlib.sha256(src.read_bytes()).hexdigest(),hasAudio=audio,notes=('本地超分与原片放大混合后输出；分辨率见 enhancement.outputSize，非原生高清。' if active=='enhanced' and enhanced else '按镜头预算取前段；统一缩放至1080P输出，不代表AI原生1080P。'))
 (R/'src/ai.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');found+=1;print(f'{id} 已导入：原始 {w}×{h}，{duration:.2f} 秒。')
if not found:raise SystemExit('没有找到对应编号视频。')
if (R/'tools/prepare_subjects.py').exists():subprocess.run([sys.executable,str(R/'tools/prepare_subjects.py')],check=True)
if (R/'tools/prepare_bridges.py').exists():subprocess.run([sys.executable,str(R/'tools/prepare_bridges.py')],check=True)
subprocess.run([sys.executable,str(R/'tools/audio.py')],check=True)
print('导入完成。审片页会更新；运行 assemble.py 重新组接。')
