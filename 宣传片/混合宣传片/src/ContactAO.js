import * as T from 'three';
import {SSAOPass} from 'three/examples/jsm/postprocessing/SSAOPass.js';
// A fixed sample distribution avoids frame-dependent screen-space noise.
export class ContactAO extends SSAOPass {
 _generateSampleKernel(n){for(let i=0;i<n;i++){const a=i*2.399963229728653,z=(i+.5)/n,r=Math.sqrt(1-z*z),s=.1+.9*(i/n)**2;this.kernel.push(new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,z).multiplyScalar(s));}}
 _generateRandomKernelRotations(){const data=new Float32Array(16);for(let i=0;i<16;i++)data[i]=((i*7+3)%16)/8-1;this.noiseTexture=new T.DataTexture(data,4,4,T.RedFormat,T.FloatType);this.noiseTexture.wrapS=this.noiseTexture.wrapT=T.RepeatWrapping;this.noiseTexture.needsUpdate=true;}
}
