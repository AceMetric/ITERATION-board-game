from pathlib import Path
import subprocess
import imageio_ffmpeg
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'输出'
font=(ROOT.parent/'素材/字体/SourceHanSansCN-Regular.otf').as_posix()
ff=imageio_ffmpeg.get_ffmpeg_exe()
filters="[0:v]scale=960:540[left];[1:v]scale=960:540[right];[left][right]hstack=inputs=2,pad=1920:1080:0:230:color=0x091321,drawtext=fontfile='"+font+"':text='更迭 / 动画升级对比':fontsize=42:fontcolor=0xe9be72:x=70:y=65,drawtext=fontfile='"+font+"':text='原版：整图运动与叠加效果':fontsize=26:fontcolor=0xf5edd9:x=70:y=170,drawtext=fontfile='"+font+"':text='新版：分层空间、主体动作与动态光影':fontsize=26:fontcolor=0xf5edd9:x=1010:y=170,drawtext=fontfile='"+font+"':text='三段动态测试 / 火光 · 玩家选择 · 星辰未来':fontsize=30:fontcolor=0xe9be72:x=70:y=845,drawtext=fontfile='"+font+"':text='同一混音用于两侧对比；原版按相同测试时长播放。':fontsize=23:fontcolor=0xa9b6c9:x=70:y=915[v]"
args=[ff,'-y','-hide_banner','-loglevel','warning','-i',str(OUT/'原版效果-对照.mp4'),'-i',str(OUT/'更迭-插画电影化样片-v1.mp4'),'-filter_complex',filters,'-map','[v]','-map','1:a:0','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart','-t','18',str(OUT/'更迭-动画升级对比-v1.mp4')]
subprocess.run(args,check=True);print('comparison exported')
