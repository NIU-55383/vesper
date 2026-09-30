import * as THREE from 'three';
/** A real, isolated light volume; no screenshot or background-image substitute. */
export function createOpening(scene, origin) {
 const group=new THREE.Group();group.name='Opening · a single breath of light';scene.add(group);
 group.position.set(origin.x,0,origin.z);
 const beamMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,uniforms:{time:{value:0},fade:{value:1},origin:{value:new THREE.Vector3(origin.x,0,origin.z)}},vertexShader:`varying vec3 vWorld;void main(){vec4 wp=modelMatrix*vec4(position,1.);vWorld=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,fragmentShader:`varying vec3 vWorld;uniform vec3 origin;uniform float time;uniform float fade;void main(){vec3 eye=cameraPosition-origin;vec3 hit=vWorld-origin;vec3 ray=normalize(hit-eye);float end=length(hit-eye);float start=max(0.,end-8.);float stepSize=(end-start)/28.;float sum=0.;for(int i=0;i<28;i++){vec3 p=eye+ray*(start+(float(i)+.5)*stepSize);float h=13.2-p.y;float radius=max(.015,h*.246);float radial=length(p.xz)/radius;float density=exp(-radial*radial*3.2)*(1.-smoothstep(.72,1.,radial))*smoothstep(.8,4.,p.y)*(1.-smoothstep(13.1,13.3,p.y));float mist=.86+.10*sin(p.y*3.1+p.x*1.7-time*.24)+.04*sin(p.y*11.+p.z*5.+time*.3);sum+=density*mist*stepSize*(1.+1.2*smoothstep(7.,13.,p.y));}gl_FragColor=vec4(.60,.71,.76,min(.42,sum*.105)*fade);}`});
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(.065,4.5,18.2,96,56,true),beamMaterial);beam.name='Opening · vertical light volume';beam.position.y=4.1;group.add(beam);
 const light=new THREE.SpotLight('#e4eff4',95,24,.255,.85,1.55);light.position.set(0,13.2,0);light.target.position.set(0,1.4,0);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.bias=-.0001;group.add(light,light.target);
 const bounce=new THREE.PointLight('#c6c4d2',5.0,9,1.5);bounce.position.set(.4,4.2,4.0);group.add(bounce);
 const geo=new THREE.BufferGeometry(),positions=[],seeds=[];
 let seed=924;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<160;i++){const y=rand()*11.9+.7,r=(13.2-y)*.21*Math.sqrt(rand()),a=rand()*Math.PI*2;positions.push(Math.cos(a)*r,y,Math.sin(a)*r);seeds.push(rand()*6.28);}
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 const dustMaterial=new THREE.PointsMaterial({color:'#c3d0d6',size:.009,transparent:true,opacity:.12,depthWrite:false,blending:THREE.AdditiveBlending});
 const dust=new THREE.Points(geo,dustMaterial);dust.name='Opening · original drifting dust';group.add(dust);
 return {group,update(time,fade=1){group.visible=true;beam.visible=fade>.001;dust.visible=fade>.001;beamMaterial.uniforms.time.value=time;beamMaterial.uniforms.fade.value=fade;light.intensity=95*fade;bounce.intensity=5*fade;dustMaterial.opacity=.12*fade;dust.rotation.y=Math.sin(time*.03)*.04;},camera(camera,look,aspect){camera.position.set(origin.x+1.4,5.7,origin.z+(aspect<.8?23:20));look.set(origin.x,5.7,origin.z);camera.lookAt(look);},dispose(){geo.dispose();beam.geometry.dispose();beamMaterial.dispose();dustMaterial.dispose();group.removeFromParent();}};
}