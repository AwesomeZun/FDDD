import * as T from 'three';
export type SpaceMode='vector'|'depth'|'quiet';
export function makeEnvironment(mode:SpaceMode){const root=new T.Group();if(mode==='quiet')return root;
 const grid=new T.GridHelper(70,70,mode==='vector'?0x32677b:0x23515e,0x152f3a);grid.position.y=-1.5;(grid.material as T.Material).transparent=true;(grid.material as T.Material).opacity=.62;root.add(grid);
 if(mode==='vector'){
  const wall=new T.GridHelper(70,35,0x2c4e61,0x152a35);wall.rotation.x=Math.PI/2;wall.position.set(0,15,-14);(wall.material as T.Material).transparent=true;(wall.material as T.Material).opacity=.34;root.add(wall);
  const side=new T.GridHelper(50,25,0x25474f,0x162b33);side.rotation.z=Math.PI/2;side.position.set(-18,12,0);(side.material as T.Material).transparent=true;(side.material as T.Material).opacity=.25;root.add(side);
  const axisMat=new T.LineBasicMaterial({color:0x508da1,transparent:true,opacity:.5});
  for(const points of [[[ -28,-1.48,0],[28,-1.48,0]],[[0,-1.48,-28],[0,-1.48,28]],[[0,-1.48,0],[0,10,0]]])root.add(new T.Line(new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p as[number,number,number]))),axisMat));
 }else{
  for(let k=0;k<9;k++){const z=-3-k*3.8,w=6.1+k*.32,points=[[-w,-1.5,z],[-w,4.2,z],[w,4.2,z],[w,-1.5,z]].map(p=>new T.Vector3(...p as[number,number,number]));root.add(new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0x528998,transparent:true,opacity:.55-k*.045})));}
 }
 const coords=[];let seed=1209;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<180;i++)coords.push((random()-.5)*55,random()*18-1,-random()*55+8);
 root.add(new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(coords,3)),new T.PointsMaterial({color:0x87b2bb,size:.035,transparent:true,opacity:.6,sizeAttenuation:true})));return root;
}
