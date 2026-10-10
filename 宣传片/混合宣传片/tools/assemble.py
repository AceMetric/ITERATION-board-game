from pathlib import Path
import subprocess,json,shutil,sys
R=Path(__file__).resolve().parents[1]
try:
 import imageio_ffmpeg
 F=imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:F=shutil.which('ffmpeg')
if not F:raise SystemExit('请使用 宣传片/工具/.venv/bin/python 运行，或提供 ffmpeg。')
ai=json.loads((R/'src/ai.json').read_text());pending=[id for id,e in ai.items()if e['status']!='ready']
# Render the edit itself: two-sided moving-subject bridges cannot survive a hard concatenation.
if '--reuse' not in sys.argv:
 for task in ['movie','pilot']:subprocess.run(['node','tools/render.mjs',task],cwd=R,check=True)
# Counting/decompressing frames cannot detect stale HTML-video screenshots.
# Reject a bad edit before replacing the user-facing master.
subprocess.run([sys.executable,str(R/'tools/check_ai_cadence.py'),str(R/'输出/Hybrid.mp4'),'--report','记录/AI逐帧时序核对.json'],check=True)
subprocess.run([sys.executable,str(R/'tools/check_ai_cadence.py'),str(R/'输出/Pilot.mp4'),'--pilot','--report','记录/样片AI逐帧时序核对.json'],check=True)
name='更迭-90秒混合审片-AI待生成'if pending else'更迭-90秒混合宣传片'
name+='-4K'
pilot='首轮样片-学习科技与FAST'+('-AI占位'if'08'in pending else'')+'-4K'
for source,target in [('Hybrid',name),('Pilot',pilot)]:
 src=R/'输出'/(source+'.mp4');dst=R/'输出'/(target+'.mp4')
 if not src.exists():raise SystemExit('缺少最新渲染：'+str(src))
 info=subprocess.run([F,'-hide_banner','-i',str(src)],capture_output=True,text=True).stderr
 if '3840x2160' not in info:raise SystemExit('必须先完成4K渲染：'+str(src))
 subprocess.run([F,'-v','error','-y','-i',str(src),'-c','copy','-movflags','+faststart',str(dst)],check=True)
 subprocess.run([F,'-v','error','-xerror','-i',str(dst),'-f','null','-'],check=True)
 print('完成并完整解码：'+str(dst))
# Share-friendly 1080P copy is derived from the 4K master; audio is stream-copied.
subprocess.run([F,'-v','error','-y','-i',str(R/'输出'/(name+'.mp4')),'-vf','scale=1920:1080:flags=lanczos','-c:v','libx264','-preset','fast','-crf','16','-c:a','copy','-movflags','+faststart',str(R/'输出/更迭-90秒混合宣传片.mp4')],check=True)
(R/'记录/交付状态.json').write_text(json.dumps({'duration':90,'fps':30,'size':[3840,2160],'threeDSeconds':47,'aiSeconds':39,'openingSeconds':4,'aiPending':pending,'completeFilm':not pending,'fullDecode':'passed','master':'输出/'+name+'.mp4','transitions':'per-edit tracked meshes and calibrated camera; local temporal repair; 180-degree directional motion blur; native ambience driven by src/edit.json','aiNativeSize':[852,480],'aiEnhancedOutputSize':[3840,2160],'aiEnhancement':'记录/AI画质增强处理-4k.json','threeDRenderSize':[3840,2160],'shareCopy':'输出/更迭-90秒混合宣传片.mp4','revision':7,'refinement':'配乐优先混音；哑光纸牌与细织物桌垫；中央片尾开创文案；卡牌动作卡点；清理校准标签','mix':json.loads((R/'src/mix.json').read_text()),'mixVerification':'记录/混音实测.json','rhythmVerification':'记录/配乐卡点分析.json','refinementBefore':'输出/对比基准/更迭-材质与片尾精修前.mp4','music':json.loads((R/'src/music.json').read_text()),'musicVerification':'记录/混音实测.json','copy':'文档/文明场景宣传语.md','wonderSlot':'右下角奇观位；奇观库在右侧桌垫外；取得后进入个人区','printedSlots':'左上事件牌；左下商店牌堆；下方商店公开区；上方与右侧基础科技','cardPairs':'64 explicit original face/back pairs; 记录/卡背与牌位核对.json','placementBefore':'输出/对比基准/更迭-牌位修正前.mp4','musicPrompt':'文档/配乐生成提示词.md','transitionReel':'输出/TransitionReel.mp4','comparison':'输出/FeatureCompare.mp4','before':'输出/对比基准/更迭-精修前.mp4','note':'六段即梦实片已导入；AI场景经本地超分与原片放大混合，三维与文字原生4K渲染，转场素材4K；AI由480P超分至4K。'},ensure_ascii=False,indent=2)+'\n')
