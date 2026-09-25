import * as THREE from 'three';
import { createSoftUnionGeometry } from './sculpt-union.js';
import { createHandGeometry, createFootGeometry } from './character-extremities.js';

// Revision 6 is a new sculpt from the white-background, hands-on-belly reference.
// Neutral proportions are authored directly; the subdued walk is layered afterwards.
let skinTemplate=null;
export function createNailong(){
  const root=new THREE.Group();root.name='Nailong';
  root.userData={character:'奶龙',modelVersion:6,forward:'+Z',units:'metres',reference:'hands-on-belly still'};
  const rig=new THREE.Group();rig.name='MotionRig';root.add(rig);
  const bones=[];
  function bone(parent,name,x,y,z){const b=new THREE.Bone();b.name=name;b.position.set(x,y,z);parent.add(b);bones.push(b);return b;}
  const rootBone=bone(rig,'OrganicRoot',0,0,0);
  const spine=bone(rootBone,'Spine',0,1.0,0),head=bone(spine,'Head',0,.54,0);
  const arms=[];
  for(const [side,key] of [[-1,'L'],[1,'R']]){
    const shoulder=bone(spine,'Arm'+key,side*.275,.410,-.020);
    const elbow=bone(shoulder,'Elbow'+key,side*.285,-.310,.175);
    const wrist=bone(elbow,'Wrist'+key,-side*.280,-.045,.440);
    arms.push({side,shoulder,elbow,wrist,index:side<0?3:6});
  }
  const legY=.610,legX=.245,kneeDrop=.265,ankleDrop=.225,legRigs=[];
  for(const [side,key] of [[-1,'L'],[1,'R']]){
    const leg=bone(rootBone,'Leg'+key,side*legX,legY,0);
    const knee=bone(leg,'Knee'+key,0,-kneeDrop,0),ankle=bone(knee,'Ankle'+key,0,-ankleDrop,0);
    legRigs.push({side,leg,knee,ankle,index:side<0?9:12});
  }
  const leftArm=arms[0].shoulder,rightArm=arms[1].shoulder,leftLeg=legRigs[0].leg,rightLeg=legRigs[1].leg;
  const yellow=new THREE.Color('#f4bd34'),cream=new THREE.Color('#efd39a'),olive=new THREE.Color('#5b5234');
  const skinMaterial=new THREE.MeshPhysicalMaterial({name:'Soft golden skin',color:0xffffff,vertexColors:true,roughness:.58,metalness:0,clearcoat:.025,clearcoatRoughness:.6});
  const faceSkin=new THREE.MeshPhysicalMaterial({name:'Golden eyelid skin',color:yellow,roughness:.58});
  function profileSampler(points) {
    const dimensions = points[0].length - 1;
    const slopes = Array.from({ length: dimensions }, (_, dimension) => {
      const d = points.slice(1).map((p, i) => (p[dimension + 1] - points[i][dimension + 1]) / (p[0] - points[i][0]));
      return points.map((p, i) => {
        if (i === 0) return d[0];
        if (i === points.length - 1) return d.at(-1);
        if (d[i - 1] * d[i] <= 0) return 0;
        const before = p[0] - points[i - 1][0], after = points[i + 1][0] - p[0];
        return 3 * (before + after) / ((2 * after + before) / d[i - 1] + (after + 2 * before) / d[i]);
      });
    });
    return y => {
      let i = 0;
      while (i < points.length - 2 && y > points[i + 1][0]) i++;
      const a = points[i], b = points[i + 1], span = b[0] - a[0];
      const t = THREE.MathUtils.clamp((y - a[0]) / span, 0, 1), t2 = t * t, t3 = t2 * t;
      return slopes.map((s, d) => (2 * t3 - 3 * t2 + 1) * a[d + 1] + (t3 - 2 * t2 + t) * span * s[i] + (-2 * t3 + 3 * t2) * b[d + 1] + (t3 - t2) * span * s[i + 1]);
    };
  }
  // Cubic C2 silhouette interpolation prevents horizontal curvature bands.
  function sculptProfile(points) {
    const count=points.length,dimension=points[0].length-1;
    const seconds=Array.from({length:dimension},(_,dim)=>{
      const a=[],b=[],c=[],d=[];
      for(let i=0;i<count;i++){
        if(i===0||i===count-1){a[i]=c[i]=d[i]=0;b[i]=1;continue;}
        const h=points[i][0]-points[i-1][0],k=points[i+1][0]-points[i][0];
        a[i]=h;b[i]=2*(h+k);c[i]=k;
        d[i]=6*((points[i+1][dim+1]-points[i][dim+1])/k-(points[i][dim+1]-points[i-1][dim+1])/h);
      }
      for(let i=1;i<count;i++){const m=a[i]/b[i-1];b[i]-=m*c[i-1];d[i]-=m*d[i-1];}
      const result=Array(count);result[count-1]=d[count-1]/b[count-1];
      for(let i=count-2;i>=0;i--)result[i]=(d[i]-c[i]*result[i+1])/b[i];
      return result;
    });
    return y=>{
      let i=0;while(i<count-2&&y>points[i+1][0])i++;
      const h=points[i+1][0]-points[i][0],a=(points[i+1][0]-y)/h,b=(y-points[i][0])/h;
      return seconds.map((m,dim)=>a*points[i][dim+1]+b*points[i+1][dim+1]+((a*a*a-a)*m[i]+(b*b*b-b)*m[i+1])*h*h/6);
    };
  }

  const shapeRows=[
    [.560,.001,.116,.114],[.620,.240,.335,-.155],
    [.760,.416,.555,-.294],[.970,.492,.636,-.346],
    [1.140,.475,.622,-.326],[1.300,.405,.515,-.280],
    [1.435,.323,.350,-.240],[1.545,.268,.235,-.207],
    [1.620,.244,.229,-.188],[1.710,.229,.254,-.178],
    [1.795,.222,.272,-.166],[1.867,.213,.279,-.140],
    [1.940,.161,.218,-.089],[1.986,.073,.124,-.010],
    [2.000,.0001,.060,.0598]
  ];
  const sampleBody=sculptProfile(shapeRows.map(([y,w,f,b])=>[y,w*w,((f-b)/2)**2,(f+b)/2]));
  function profile(y){const [w,d,c]=sampleBody(THREE.MathUtils.clamp(y,.56,2));return [Math.sqrt(Math.max(w,1e-8)),Math.sqrt(Math.max(d,1e-8)),c+.085*THREE.MathUtils.smoothstep(y,1.435,1.80)];}
  function muzzle(x,y){
    // A local soft lip wedge, rather than pushing the whole face forward.
    return .028*Math.exp(-Math.pow(x/.105,2)-Math.pow((y-1.784)/.034,2))+
      .006*Math.exp(-Math.pow(x/.095,2)-Math.pow((y-1.752)/.038,2));
  }
  function frontSurface(x,y){const [w,d,c]=profile(y);return c+d*Math.sqrt(Math.max(0,1-(x/w)**2))+muzzle(x,y);}
  function bellyUV(x,y,z){
    const yy=THREE.MathUtils.clamp(y,.5601,1.9999),[w,d,c]=profile(yy);
    return [(Math.atan2(x/w,(z-c)/d)/(Math.PI*2)+1)%1,(yy-.56)/1.44];
  }
  function ellipseDistance(x,y,z,rx,rz,center,lo,hi){
    rx=Math.max(rx,1e-5);rz=Math.max(rz,1e-5);
    const zz=z-center,k0=Math.hypot(x/rx,zz/rz),k1=Math.hypot(x/(rx*rx),zz/(rz*rz));
    const r=k1>1e-9?k0*(k0-1)/k1:-Math.min(rx,rz),cap=Math.max(lo-y,y-hi);
    return Math.hypot(Math.max(r,0),Math.max(cap,0))+Math.min(Math.max(r,cap),0);
  }
  const profileCache=new Map();
  const fields=[{kind:'body',distance(x,y,z){
    const yy=THREE.MathUtils.clamp(y,.5601,1.9999);let p=profileCache.get(yy);if(!p){p=profile(yy);profileCache.set(yy,p);}
    let distance=ellipseDistance(x,y,z-(z>p[2]?muzzle(x,yy):0),p[0],p[1],p[2],.56,2);
    return distance;
  }}];
  // Reconstructed folded arms have a genuine elbow and a forward-facing forearm.
  function armField(side,index){
    const landmarks=[
      [side*.275,1.410,-.020,.118],[side*.421,1.333,.012,.115],
      [side*.535,1.195,.072,.111],[side*.560,1.100,.155,.108],
      [side*.465,1.052,.398,.088],[side*.280,1.055,.595,.058]
    ];
    const curve=new THREE.CatmullRomCurve3(landmarks.map(p=>new THREE.Vector3(...p.slice(0,3))),false,'catmullrom',.35);
    const radiusAt=profileSampler(landmarks.map((p,i)=>[i/(landmarks.length-1),p[3]]));
    const q=new THREE.Vector3(),qm=new THREE.Vector3(),qp=new THREE.Vector3();
    const segments=[],steps=20;
    for(let i=0;i<steps;i++){
      const a=curve.getPoint(i/steps),b=curve.getPoint((i+1)/steps),d=b.clone().sub(a);
      const f=i/steps*(landmarks.length-1),j=Math.min(landmarks.length-2,Math.floor(f));
      const f2=(i+1)/steps*(landmarks.length-1),j2=Math.min(landmarks.length-2,Math.floor(f2));
      const r=THREE.MathUtils.lerp(landmarks[j][3],landmarks[j+1][3],f-j),r2=THREE.MathUtils.lerp(landmarks[j2][3],landmarks[j2+1][3],f2-j2);
      segments.push({a,d,len:d.lengthSq(),r,dr:r2-r,i});
    }
    function nearest(x,y,z){
      let best=Infinity,tbest=0,bestSq=0,bestRadius=0;
      for(const s of segments){
        const px=x-s.a.x,py=y-s.a.y,pz=z-s.a.z,t=THREE.MathUtils.clamp((px*s.d.x+py*s.d.y+pz*s.d.z)/s.len,0,1);
        const dx=px-t*s.d.x,dy=py-t*s.d.y,dz=pz-t*s.d.z,radius=s.r+s.dr*t,dsq=dx*dx+dy*dy+dz*dz,rank=dsq-radius*radius;
        if(rank<best){best=rank;bestSq=dsq;bestRadius=radius;tbest=(s.i+t)/steps;}
      }
      let t=tbest;
      for(let iteration=0;iteration<4;iteration++){
        if(t<.0001||t>.9999)break;
        const e=Math.min(.0007,t,1-t);curve.getPoint(t,q);curve.getPoint(t-e,qm);curve.getPoint(t+e,qp);
        const dx=(qp.x-qm.x)/(2*e),dy=(qp.y-qm.y)/(2*e),dz=(qp.z-qm.z)/(2*e);
        const ddx=(qp.x-2*q.x+qm.x)/(e*e),ddy=(qp.y-2*q.y+qm.y)/(e*e),ddz=(qp.z-2*q.z+qm.z)/(e*e);
        const ax=q.x-x,ay=q.y-y,az=q.z-z,den=dx*dx+dy*dy+dz*dz+ax*ddx+ay*ddy+az*ddz;
        if(Math.abs(den)<1e-8)break;
        const delta=THREE.MathUtils.clamp((ax*dx+ay*dy+az*dz)/den,-.05,.05),next=THREE.MathUtils.clamp(t-delta,0,1);
        t=next;if(Math.abs(delta)<1e-7)break;
      }
      curve.getPoint(t,q);return [Math.hypot(x-q.x,y-q.y,z-q.z)-radiusAt(t)[0],t];
    }
    return {kind:'arm',side,index,nearest,distance(x,y,z){
      if(y<.89||y>1.61||x*side<.13||x*side>.72||z<-.18||z>.73)return .10+Math.max(0,.89-y,y-1.61,.13-x*side,x*side-.72,-.18-z,z-.73);
      return nearest(x,y,z)[0];
    }};
  }
  fields.push(armField(-1,3),armField(1,6));
  const sampleLeg=profileSampler([[.035,.028,.045],[.070,.042,.056],[.100,.046,.059],[.180,.055,.070],[.315,.090,.102],[.450,.129,.137],[.605,.160,.165],[.690,.128,.140],[.795,.001,.001]]);
  for(const item of legRigs){
    const cache=new Map();
    fields.push({kind:'leg',...item,distance(x,y,z){
      if(y<-.025||y>.87||Math.abs(x-item.side*legX)>.25||Math.abs(z)>.24)return .10+Math.max(0,-.025-y,y-.87,Math.abs(x-item.side*legX)-.25,Math.abs(z)-.24);
      const yy=THREE.MathUtils.clamp(y,.035,.795);let row=cache.get(yy);if(!row){row=sampleLeg(yy);cache.set(yy,row);}
      return ellipseDistance(x-item.side*legX,y,z,row[0],row[1],0,.035,.795);
    }});
  }
  function attributesFor(g,weightFunction,colorFunction,uvFunction){
    const p=g.attributes.position,si=[],sw=[],color=[],uv=[],tint=new THREE.Color();
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      const ws=weightFunction(i,x,y,z),strong=ws.map((w,j)=>({w,j})).filter(e=>e.w>1e-8).sort((a,b)=>b.w-a.w).slice(0,4);
      while(strong.length<4)strong.push({w:0,j:0});const total=strong.reduce((a,b)=>a+b.w,0)||1;
      si.push(...strong.map(a=>a.j));sw.push(...strong.map(a=>a.w/total));
      const dark=colorFunction(i,x,y,z);tint.copy(yellow).lerp(olive,dark);
      color.push(tint.r,tint.g,tint.b);uv.push(...uvFunction(i,x,y,z));
    }
    g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));
    g.setAttribute('color',new THREE.Float32BufferAttribute(color,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    delete g.userData.sourceWeights;
  }
  function splitSeam(g){
    const attrs=Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,{values:Array.from(a.array),size:a.itemSize,type:a.array.constructor}]));
    const indices=Array.from(g.index.array),uv=attrs.uv.values,dupes=new Map();
    for(let i=0;i<indices.length;i+=3){
      const tri=indices.slice(i,i+3),u=tri.map(n=>uv[n*2]);
      if(Math.max(...u)-Math.min(...u)<.5)continue;
      for(let j=0;j<3;j++)if(u[j]<.5){
        const original=tri[j];let copy=dupes.get(original);
        if(copy===undefined){
          copy=attrs.position.values.length/3;dupes.set(original,copy);
          for(const [key,a] of Object.entries(attrs)){
            const values=a.values.slice(original*a.size,(original+1)*a.size);if(key==='uv')values[0]+=1;a.values.push(...values);
          }
        }
        indices[i+j]=copy;
      }
    }
    for(const [k,a]of Object.entries(attrs))g.setAttribute(k,new THREE.BufferAttribute(new a.type(a.values),a.size));g.setIndex(indices);
  }
  function merge(parts){
    const names=['position','normal','color','uv','skinIndex','skinWeight'],g=new THREE.BufferGeometry();
    for(const name of names){
      const a=parts[0].attributes[name],data=new a.array.constructor(parts.reduce((s,p)=>s+p.attributes[name].array.length,0));let offset=0;
      for(const part of parts){data.set(part.attributes[name].array,offset);offset+=part.attributes[name].array.length;}
      g.setAttribute(name,new THREE.BufferAttribute(data,a.itemSize));
    }
    const indices=[];let offset=0;
    for(const part of parts){for(const i of part.index.array)indices.push(i+offset);offset+=part.attributes.position.count;part.dispose();}
    g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();return g;
  }
  if(!skinTemplate){
    const body=createSoftUnionGeometry({fields,bounds:{min:[-.74,.00,-.40],max:[.74,2.035,.77]},step:.014,smoothness:.025});
    const sourceWeights=body.userData.sourceWeights,bodyDark=new Float32Array(body.attributes.position.count);
    attributesFor(body,(i,x,y,z)=>{
      const weights=Array(15).fill(0);let dark=0;
      for(let f=0;f<fields.length;f++){
        const w=sourceWeights[i*fields.length+f];if(w<1e-6)continue;const field=fields[f];
        if(field.kind==='body'){
          const h=THREE.MathUtils.smoothstep(y,1.43,1.705);weights[1]+=w*(1-h);weights[2]+=w*h;
        }else if(field.kind==='arm'){
          const t=field.nearest(x,y,z)[1],elbow=THREE.MathUtils.smoothstep(t,.45,.68),wrist=THREE.MathUtils.smoothstep(t,.90,1);
          weights[field.index]+=w*(1-elbow);weights[field.index+1]+=w*(elbow-wrist);weights[field.index+2]+=w*wrist;
          dark+=w*THREE.MathUtils.smoothstep(t,.89,.99);
        }else{
          const k=1-THREE.MathUtils.smoothstep(y,.330,.460),a=1-THREE.MathUtils.smoothstep(y,.150,.245);
          weights[field.index]+=w*(1-k);weights[field.index+1]+=w*(k-a);weights[field.index+2]+=w*a;
          dark+=w*(1-THREE.MathUtils.smoothstep(y,.08,.20));
        }
      }
      bodyDark[i]=dark;return weights;
    },i=>bodyDark[i],(i,x,y,z)=>bellyUV(x,y,z));
    // The bib is intrinsic skin color, smoothly confined to the torso.
    // Continuous UVs avoid interpolation across an unrelated yellow atlas texel.
    const bodyColor=body.attributes.color,bp=body.attributes.position,paint=new THREE.Color();
    for(let i=0;i<bp.count;i++){
      const x=bp.getX(i),y=bp.getY(i),z=bp.getZ(i),dy=(y-1.105)/.335;
      const shape=(x/(.385*(1-.24*dy)))**2+(dy<0?Math.pow(dy,4):dy*dy);
      const patch=z>profile(y)[2]?1-THREE.MathUtils.smoothstep(shape,.94,1.06):0;
      const onTorso=sourceWeights[i*fields.length];
      paint.copy(yellow).lerp(cream,patch*onTorso).lerp(olive,bodyDark[i]);
      bodyColor.setXYZ(i,paint.r,paint.g,paint.b);
    }
    splitSeam(body);
    const parts=[body];
    for(const a of arms){
      const hand=createHandGeometry();hand.scale(-a.side*1.08,1.08,1);hand.rotateY(a.side*.45);
      if(a.side>0){const ix=hand.index.array;for(let i=0;i<ix.length;i+=3){const q=ix[i];ix[i]=ix[i+1];ix[i+1]=q;}}
      hand.translate(a.side*.280,1.055,.595);
      attributesFor(hand,()=>{const w=Array(15).fill(0);w[a.index+2]=1;return w;},()=>1,()=>[.5,.5]);parts.push(hand);
    }
    for(const l of legRigs){
      const foot=createFootGeometry();foot.translate(l.side*legX,0,0);
      attributesFor(foot,()=>{const w=Array(15).fill(0);w[l.index+2]=1;return w;},(i,x,y)=>1-THREE.MathUtils.smoothstep(y,.08,.20),()=>[.5,.5]);parts.push(foot);
    }
    skinTemplate=merge(parts);
  }
  const organicMesh=new THREE.SkinnedMesh(skinTemplate.clone(),skinMaterial);organicMesh.name='Reference sculpt body hands and three-toed feet';organicMesh.castShadow=organicMesh.receiveShadow=true;
  rig.remove(rootBone);organicMesh.add(rootBone);rig.add(organicMesh);root.updateMatrixWorld(true);organicMesh.bind(new THREE.Skeleton(bones));
  // Volumetric green lenses follow the rounded face. A curved cap gives
  // each eye depth while preserving a smooth, circular edge on the skin.
  const face=new THREE.Group();face.name='Face';face.position.y=-1.54;head.add(face);
  const eyeGreen=new THREE.MeshPhysicalMaterial({name:'Jade green eyes',color:'#79ac60',roughness:.36,clearcoat:.12});
  const pupilMaterial=new THREE.MeshPhysicalMaterial({name:'Black circular pupils',color:'#090c07',roughness:.28,clearcoat:.18});
  const highlightMaterial=new THREE.MeshBasicMaterial({color:'#f9f3d4',toneMapped:false});
  const sphere=new THREE.SphereGeometry(1,32,24),lids=[];
  for(const side of [-1,1]){
    const cx=side*.126,cy=1.876;
    const outward=new THREE.Vector3(side*Math.tan(.35),.035,1).normalize();
    const group=new THREE.Group();group.name=(side<0?'Left':'Right')+'Eye';
    group.position.set(cx,cy,frontSurface(cx,cy)).addScaledVector(outward,-.012);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),outward);face.add(group);
    const eye=new THREE.Mesh(sphere,eyeGreen);eye.name='Round green eye';eye.scale.set(.061,.061,.038);group.add(eye);
    const pupil=new THREE.Mesh(sphere,pupilMaterial);pupil.name='Slightly lowered round pupil';
    pupil.scale.set(.0295,.0305,.006);pupil.position.set(-side*.007,-.008,.037);group.add(pupil);
    const shine=new THREE.Mesh(sphere,highlightMaterial);shine.scale.set(.0023,.0028,.0008);
    shine.position.set(-.009,.007,.043);group.add(shine);
    const p=[],idx=[],cols=64,rows=16;
    for(let i=0;i<=cols;i++)for(let j=0;j<=rows;j++)p.push(0,0,0);
    for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){const k=i*(rows+1)+j,l=k+rows+1;idx.push(k,l,k+1,l,l+1,k+1);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setIndex(idx);
    const lid=new THREE.Mesh(geo,faceSkin);lid.name='Fine relaxed upper eyelid';group.add(lid);
    const deform=blink=>{
      const a=geo.attributes.position;
      for(let i=0;i<=cols;i++){
        const x=-.999+1.998*i/cols,e=Math.sqrt(1-x*x),bottom=Math.min(e,Math.max(-e,THREE.MathUtils.lerp(.88,-1.02,blink)));
        for(let j=0;j<=rows;j++){
          const y=THREE.MathUtils.lerp(bottom,e,j/rows),z=Math.sqrt(Math.max(0,1-x*x-y*y));
          a.setXYZ(i*(rows+1)+j,x*.061,y*.061,z*.038+.001);
        }
      }
      a.needsUpdate=true;geo.computeVertexNormals();
    };deform(0);lids.push(deform);
  }
  const mouthMaterial=new THREE.MeshStandardMaterial({name:'Small dark mouth opening',color:'#51371c',roughness:.85});
  const mv=[],mi=[];
  for(let i=0;i<=64;i++){
    const u=-1+i/32,x=u*.077,center=1.785-.0025*u*u,half=.001+.0028*(1-u*u);
    for(const y of [center-half,center+half])mv.push(x,y,frontSurface(x,y)+.001);
    if(i<64){const j=i*2;mi.push(j,j+2,j+1,j+2,j+3,j+1);}
  }
  const mg=new THREE.BufferGeometry();mg.setAttribute('position',new THREE.Float32BufferAttribute(mv,3));mg.setIndex(mi);mg.computeVertexNormals();
  const mouth=new THREE.Mesh(mg,mouthMaterial);mouth.name='Thin mouth with soft lip volume';face.add(mouth);
  const tail=new THREE.Group();tail.name='Tail';rig.add(tail);
  const soleSamples={left:[],right:[]},contactSoles={left:[],right:[]},pos=organicMesh.geometry.attributes.position;
  const sw=organicMesh.geometry.attributes.skinWeight,si=organicMesh.geometry.attributes.skinIndex;
  for(let i=0;i<pos.count;i++)if(pos.getY(i)<.135){
    const side=pos.getX(i)<0?-1:1,key=side<0?'left':'right',first=side<0?9:12;soleSamples[key].push(i);
    let k=0,a=0;for(let c=0;c<4;c++){const b=si.array[i*4+c],w=sw.array[i*4+c];if(b===first+1)k+=w;if(b===first+2)a+=w;}
    contactSoles[key].push({x:pos.getX(i)-side*legX,y:pos.getY(i)-legY,z:pos.getZ(i),k,a});
  }
  // Animation authoring needs only a lower-envelope sample, not every dense
  // toe vertex. The public soleSamples retain the complete mesh for QA.
  for(const key of ['left','right']){
    const bins=new Map();
    for(const v of contactSoles[key]){
      const id=Math.round(v.x/.012)+':'+Math.round(v.z/.012),previous=bins.get(id);
      if(!previous||v.y<previous.y)bins.set(id,v);
    }
    contactSoles[key]=[...bins.values()];
  }
  function deformed(v,knee,ankle){
    const c=Math.cos(knee),s=Math.sin(knee),ca=Math.cos(ankle),sa=Math.sin(ankle),total=kneeDrop+ankleDrop;
    const ky=(v.y+kneeDrop)*c-v.z*s-kneeDrop,kz=(v.y+kneeDrop)*s+v.z*c;
    const ay=(v.y+total)*ca-v.z*sa-ankleDrop,az=(v.y+total)*sa+v.z*ca;
    const fy=ay*c-az*s-kneeDrop,fz=ay*s+az*c;
    return [v.y*(1-v.k-v.a)+ky*v.k+fy*v.a,v.z*(1-v.k-v.a)+kz*v.k+fz*v.a];
  }
  const period=1.10,stance=.58,travel=.51,referenceSpeed=travel/(stance*period);
  function legPhase(phase,moving){
    const p=(phase%1+1)%1;
    if(!moving)return {hip:0,knee:.035,pitch:0,z:.140,lift:0};
    if(p<stance){
      const u=p/stance;
      return {hip:THREE.MathUtils.lerp(-.370,.340,u),knee:.035,
        pitch:0,z:.140+travel*(.5-u),lift:0};
    }
    const u=(p-stance)/(1-stance),smooth=THREE.MathUtils.smootherstep(u,0,1);
    const m=-travel*(1-stance)/stance;
    const u2=u*u,u3=u2*u;
    const z=(2*u3-3*u2+1)*(-travel/2)+(u3-2*u2+u)*m+(-2*u3+3*u2)*(travel/2)+(u3-u2)*m;
    return {hip:THREE.MathUtils.lerp(.340,-.370,smooth),knee:.035+.245*Math.sin(Math.PI*u),
      pitch:-.10*Math.sin(Math.PI*u),z:.140+z,lift:.052*Math.pow(Math.sin(Math.PI*u),1.35)};
  }
  function placeLeg(data,side,rigY,roll){
    const ankle=data.pitch-data.hip-data.knee,c=Math.cos(data.hip),s=Math.sin(data.hip);
    const cr=Math.cos(roll),sr=Math.sin(roll);
    let min=Infinity;
    for(const v of contactSoles[side<0?'left':'right']){
      const [y,z]=deformed(v,data.knee,ankle);
      const yy=y*c-z*s;
      const x=v.x;
      min=Math.min(min,(yy+legY)*cr+(x+side*legX)*sr+rigY);
    }
    const [ay,az]=deformed({y:-.575,z:.140,k:0,a:1},data.knee,ankle);
    const anchorZ=ay*s+az*c;
    return {hip:data.hip,knee:data.knee,ankle,y:legY+(data.lift-min)/cr,z:data.z-anchorZ};
  }
  function samplePose(time,moving=0){
    const phase=time/period,angle=phase*Math.PI*2,breathe=Math.sin(time*1.45);
    const rigY=moving?.0065*(1-Math.cos(angle*2)):(breathe+1)*.0022;
    const roll=moving?.013*Math.sin(angle):.0015*Math.sin(time*.725);
    return {rigY,roll,
      spineX:moving?.028+.008*Math.sin(angle-.45):.003*breathe,
      headX:moving?.145+.010*Math.sin(angle-.52):.006+.003*breathe,
      headY:moving?.010*Math.sin(angle-.3):.008*Math.sin(time*.725),
      leftArm:moving?.040*Math.cos(angle-.38):.002*breathe,
      rightArm:moving?-.040*Math.cos(angle-.38):-.002*breathe,
      left:placeLeg(legPhase(phase,moving),-1,rigY,roll),
      right:placeLeg(legPhase(phase+.5,moving),1,rigY,roll)};
  }
  function createClip(name,duration,moving){
    const times=[],channels=new Map(),euler=new THREE.Euler(),quaternion=new THREE.Quaternion();
    function add(name,values){if(!channels.has(name))channels.set(name,[]);channels.get(name).push(...values);}
    function rotation(name,x,y,z){quaternion.setFromEuler(euler.set(x,y,z));add(name+'.quaternion',quaternion.toArray());}
    const sampleTimes=new Set(Array.from({length:161},(_,i)=>i/160*duration));
    if(moving)for(const p of [0,.08,.5,.58,1])sampleTimes.add(p*duration);
    for(const t of [...sampleTimes].sort((a,b)=>a-b)){
      times.push(t);const pose=samplePose(t,moving);
      add('MotionRig.position',[0,pose.rigY,0]);rotation('MotionRig',0,0,pose.roll);
      rotation('Spine',pose.spineX,0,0);rotation('Head',pose.headX,pose.headY,-.004);
      rotation('ArmL',pose.leftArm,0,0);rotation('ArmR',pose.rightArm,0,0);
      for(const [key,side,p] of [['L',-1,pose.left],['R',1,pose.right]]){
        rotation('Leg'+key,p.hip,0,0);rotation('Knee'+key,p.knee,0,0);rotation('Ankle'+key,p.ankle,0,0);
        add('Leg'+key+'.position',[side*legX,p.y,p.z]);
      }
    }
    for(const [key,values] of channels){const size=key.endsWith('.quaternion')?4:3;values.splice(values.length-size,size,...values.slice(0,size));}
    return new THREE.AnimationClip(name,duration,[...channels].map(([name,values])=>
      name.endsWith('.quaternion')?new THREE.QuaternionKeyframeTrack(name,times,values):new THREE.VectorKeyframeTrack(name,times,values)));
  }
  const animations=[createClip('Idle',4*Math.PI/1.45,0),createClip('Walk',period,1)];
  root.animations=animations;
  const mixer=new THREE.AnimationMixer(root),idleAction=mixer.clipAction(animations[0]),walkAction=mixer.clipAction(animations[1]);
  idleAction.play();walkAction.play().setEffectiveWeight(0);
  let blend=0,localTime=0,wasBlinking=false;
  const gait={period,stance,travel,referenceSpeed,phase:0,contacts:[true,true],stepEvents:[]};
  function update(dt,options={}){
    dt=THREE.MathUtils.clamp(Number.isFinite(dt)?dt:0,0,.1);localTime+=dt;
    const moving=!!options.moving;
    blend=THREE.MathUtils.damp(blend,moving?1:0,12,dt);
    idleAction.setEffectiveWeight(1-blend);walkAction.setEffectiveWeight(blend);
    const speed=Number.isFinite(options.speed)?Math.max(0,options.speed):referenceSpeed;
    walkAction.setEffectiveTimeScale(moving?THREE.MathUtils.clamp(speed/referenceSpeed,0,1.85):0);
    const before=walkAction.time/period;mixer.update(dt);
    const after=walkAction.time/period;gait.phase=after;
    gait.contacts=[after<stance,((after+.5)%1)<stance];gait.stepEvents.length=0;
    if(moving&&blend>.5){
      if(after<before)gait.stepEvents.push('left');
      if(before<.5&&after>=.5)gait.stepEvents.push('right');
    }
    const t=Number.isFinite(options.time)?options.time:localTime;
    const blink=Math.exp(-Math.pow((t%6.8-5.72)/.095,2));
    if(blink>.001||wasBlinking)for(const deform of lids)deform(blink);
    wasBlinking=blink>.001;
  }

  function dispose(){
    mixer.stopAllAction();mixer.uncacheRoot(root);
    const gs=new Set(),ms=new Set();
    root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)ms.add(m);});
    for(const g of gs)g.dispose();for(const m of ms)m.dispose();
  }
  update(0);
  return {root,update,animations,mixer,dispose,gait,organicMesh,soleSamples,height:2.0,radius:.65,joints:{rig,spine,head,leftArm,rightArm,leftLeg,rightLeg,leftKnee:legRigs[0].knee,rightKnee:legRigs[1].knee,leftAnkle:legRigs[0].ankle,rightAnkle:legRigs[1].ankle,tail}};
}
