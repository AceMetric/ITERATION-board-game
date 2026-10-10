#!/bin/zsh
set -e
cd "$(dirname "$0")"
echo '请把包含 01、03、05、07、08、10 编号视频的文件夹拖到此窗口，然后按回车：'
IFS= read -r video_folder
# Finder may shell-escape spaces or quote a dragged path. zsh (Q) removes quoting without evaluation.
video_folder=${video_folder% }
video_folder=${(Q)video_folder}
../工具/.venv/bin/python tools/import_ai.py "$video_folder"
../工具/.venv/bin/python tools/assemble.py
echo '视频已导入并重新组接。按回车关闭。'
read -r
