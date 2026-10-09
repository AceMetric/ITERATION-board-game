"""Local static preview with byte ranges, required for reliable MP4 seeking."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import os,re,argparse
ROOT=Path(__file__).resolve().parents[3]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def send_head(self):
        self._byte_range=None
        file=Path(self.translate_path(self.path))
        if not file.is_file():return super().send_head()
        size=file.stat().st_size;value=self.headers.get('Range')
        start,end=0,size-1
        if value:
            match=re.fullmatch(r'bytes=(\d*)-(\d*)',value)
            if not match or not any(match.groups()):
                self.send_error(416,'Unsupported byte range');return None
            a,b=match.groups()
            if a:start=int(a);end=min(int(b)if b else end,end)
            else:start=max(0,size-int(b))
            if start>end or start>=size:
                self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.send_header('Content-Length','0');self.end_headers();return None
            self._byte_range=(start,end)
        stream=file.open('rb');self.send_response(206 if value else 200)
        self.send_header('Content-Type',self.guess_type(str(file)));self.send_header('Accept-Ranges','bytes');self.send_header('Content-Length',str(end-start+1));self.send_header('Last-Modified',self.date_time_string(file.stat().st_mtime))
        if value:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        self.end_headers();stream.seek(start);return stream
    def copyfile(self,source,out):
        if self._byte_range is None:return super().copyfile(source,out)
        count=self._byte_range[1]-self._byte_range[0]+1
        while count:
            chunk=source.read(min(count,1024*1024))
            if not chunk:break
            out.write(chunk);count-=len(chunk)
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=18790);args=parser.parse_args();os.chdir(ROOT)
    print(f'http://127.0.0.1:{args.port}/宣传片/动画/动态样片.html',flush=True)
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
