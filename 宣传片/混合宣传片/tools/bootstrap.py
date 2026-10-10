"""Restore working assets without rewriting the committed edit or manifests."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import subprocess

R = Path(__file__).resolve().parents[1]
PROJECT = R.parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description='核对原素材，并准备本地贴图、字体、AI常规版和环境声。')
    parser.add_argument('--check-only', action='store_true')
    parser.add_argument('--output-root', type=Path, default=R,
                        help='可在临时目录验证准备流程，不改动正式工程。')
    args = parser.parse_args()
    target = args.output_root.resolve()
    assets = json.loads((R / 'src/assets.json').read_text())
    ai = json.loads((R / 'src/ai.json').read_text())
    music = json.loads((R / 'src/music.json').read_text())
    for entry in assets.values():
        assert digest(PROJECT / entry['source']) == entry['sha256'], entry['source']
    for entry in ai.values():
        assert digest(PROJECT / entry['source']) == entry['sourceSha256'], entry['source']
    assert (PROJECT / music['source']).is_file(), music['source']
    print(f'原图 {len(assets)} 份、AI视频 {len(ai)} 段及配乐来源核对通过。', flush=True)
    if args.check_only:
        return
    for name in ['public/textures', 'public/scenes', 'public/fonts', 'public/ai',
                 'public/audio', 'public/ai-enhanced-4k', '即梦素材包', '记录', '输出']:
        (target / name).mkdir(parents=True, exist_ok=True)
    for entry in assets.values():
        destination = target / 'public' / entry['file']
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(PROJECT / entry['source'], destination)
    for source in (PROJECT / '宣传片/素材/字体').iterdir():
        if source.is_file() and source.name != '.DS_Store':
            shutil.copy2(source, target / 'public/fonts' / source.name)
    for entry in assets.values():
        if entry['file'].startswith('scenes/'):
            shutil.copy2(PROJECT / entry['source'], target / '即梦素材包' / Path(entry['file']).name)
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    for identifier, entry in ai.items():
        source = PROJECT / entry['source']
        subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(source), '-t', str(entry['seconds']),
                        '-vf', 'scale=1920:1080:flags=lanczos,fps=30,setsar=1', '-an',
                        '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
                        '-movflags', '+faststart', str(target / 'public/ai' / f'{identifier}.mp4')], check=True)
        if entry.get('hasAudio'):
            subprocess.run([ffmpeg, '-v', 'error', '-y', '-i', str(source), '-t', str(entry['seconds']),
                            '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s24le',
                            str(target / 'public/audio' / f'{identifier}-ai.wav')], check=True)
    print('准备完成；src 中的卡面裁切、剪辑、跟踪、文案及声音参数保持不变。', flush=True)


if __name__ == '__main__':
    main()
