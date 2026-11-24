(() => {
  const figure = document.querySelector('.intersection');
  const canvas = figure.querySelector('canvas');
  const pen = canvas.getContext('2d');
  if (!pen) return;
  const button = figure.querySelector('[data-playback]');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const halfCycle = 16;
  const cycle = 2 * halfCycle;
  const colors = [
    ['#e99966','#b76e48'], ['#83b6b4','#518887'], ['#edcd83','#bd9958'],
    ['#a7accc','#737e9c'], ['#db968d','#a86761'], ['#9dbc91','#708e6b']
  ];
  let time = 1.8;
  let paused = preference.matches;
  let visible = true;
  let frame = 0;
  let last = null;

  let yaw = 0;
  let tilt = 1;
  let zoom = 1;
  let cosine = 1, sine = 0;
  const maxZoom = 3;

  function depth(x,y) {
    return cosine*(x+y) + sine*(x-y);
  }
  function project(x, y, z = 0) {
    const across = cosine*(x-y) - sine*(x+y);
    return [500+across*39, 245+depth(x,y)*16.8*tilt-z*36];
  }
  function polygon(points, color) {
    pen.beginPath();
    points.forEach((p,i) => i ? pen.lineTo(...project(...p)) : pen.moveTo(...project(...p)));
    pen.closePath();
    pen.fillStyle = color;
    pen.fill();
  }
  function patch(x,y,w,h,color,z=0) {
    polygon([[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z]],color);
  }
  const paving = '#d9d5c4';
  function ground() {
    polygon([[-6,-6,-.24],[6,-6,-.24],[6,6,-.24],[-6,6,-.24]],'#b8b4a2');
    patch(-6,-6,12,12,paving);
    patch(-6,-1.55,12,3.1,'#626c68');
    patch(-1.55,-6,3.1,12,'#626c68');
    for (const sign of [-1,1]) {
      for(let i=2.5;i<6;i+=.8) {
        const edge=sign>0 ? i : -i-.43;
        patch(edge,-.033,.43,.066,'#e7d3a1');
        patch(-.033,edge,.066,.43,'#e7d3a1');
      }
      for(let i=-1.38;i<1.4;i+=.36) {
        patch(sign*1.88-.16,i,.32,.18,'#ebe8d9');
        patch(i,sign*1.88-.16,.18,.32,'#ebe8d9');
      }
      const stop=sign*2.28;
      patch(stop,sign<0 ? .05 : -1.49,.08,1.44,'#ece9d9');
      patch(sign<0 ? -1.49 : .05,stop,1.44,.08,'#ece9d9');
    }
    for(const x of [-5.72,2.15]) for(const y of [-5.72,2.15])
      patch(x,y,3.57,3.57,'#bccba7');
  }
  function ellipse(x,y,z,rx,ry,color) {
    pen.beginPath();
    pen.ellipse(...project(x,y,z),rx,ry,0,0,Math.PI*2);
    pen.fillStyle=color;
    pen.fill();
  }
  function tree(x,y) {
    ellipse(x+.13,y+.06,0,17,6,'#9cab8c');
    const [px,py]=project(x,y);
    pen.fillStyle='#796f59'; pen.fillRect(px-2,py-28,4,28);
    ellipse(x,y,.88,14,19,'#68866c');
    ellipse(x-.06,y,.99,11,15,'#88a184');
  }
  function light(x,y,age) {
    const [px,py]=project(x,y);
    pen.fillStyle='#48564d'; pen.fillRect(px-2,py-40,4,40);
    pen.fillStyle='#283b34'; pen.fillRect(px-7,py-62,14,28);
    const lamps=[age>=9.2,age>=8 && age<9.2,age<8];
    ['#ff7865','#ffcf65','#82eb9d'].forEach((color,i)=>{
      pen.beginPath(); pen.arc(px,py-56+i*8,3,0,Math.PI*2);
      pen.fillStyle=lamps[i] ? color : '#516059'; pen.fill();
    });
  }
  function rotate(x,y,approach) {
    return [[x,y],[-y,x],[-x,-y],[y,-x]][approach];
  }

  function pose(age,route,approach) {
    const following=route==='right';
    const left=route==='left';
    const lane=left ? .39 : 1.13;
    const truck=approach===0 && route==='straight';
    const queueOffset=approach===0 && following ? .65 : 0;
    const stop=(following ? -4.12 : -2.91)-queueOffset-(truck ? .32 : 0);
    // Refill each queue during clearance so it is waiting when cross traffic starts.
    const lead=cycle-(left ? 9.1 : following ? 10.4 : 8.3)-approach*.14;
    const t=(age+lead)%cycle;
    const greenTime=t-lead;
    // Left-turning drivers wait until the opposing through car has cleared.
    const release=(left ? 3.45 : following ? 1.08 : .16)+approach*.09;
    let x=stop,y=lane,angle=0;
    if(t<2.25) {
      x=stop-(stop+6.1)*(1-t/2.25)**1.6;
    } else if(greenTime>release) {
      const moving=greenTime-release;
      const distance=2.45*(moving-.36*(1-Math.exp(-moving/.36)));
      const bend=left ? -1.91 : -1.84;
      x=stop+distance;
      if(route!=='straight' && x>bend) {
        const sign=left ? -1 : 1;
        const radius=left ? 2.3 : .71;
        const curved=x-bend;
        const turn=Math.min(curved/radius,Math.PI/2);
        angle=sign*turn;
        x=bend+radius*Math.sin(turn);
        y=lane+sign*(radius*(1-Math.cos(turn))+Math.max(0,curved-radius*Math.PI/2));
      }
    }
    const edge=Math.max(Math.abs(x),Math.abs(y));
    if(edge>=6.1) return null;
    const opacity=Math.min(1,(6.1-edge)/.65,t/.25);
    [x,y]=rotate(x,y,approach);
    return {x,y,angle:angle+approach*Math.PI/2,opacity,truck};
  }

  function vehicle(position,body) {
    const {x,y,angle,opacity,truck}=position;
    return {depth:depth(x,y),draw(){
      pen.save();pen.globalAlpha=opacity;
      const point=(u,v,z)=>[x+u*Math.cos(angle)-v*Math.sin(angle),y+u*Math.sin(angle)+v*Math.cos(angle),z];
      const slab=(length,width,z,h,colors,offset=0)=>{
        const corners=[[offset-length,-width],[offset+length,-width],[offset+length,width],[offset-length,width]];
        const faces=corners.map((a,i)=>[a,corners[(i+1)%4]]);
        function faceDepth([a,b]) {
          const [ax,ay]=point(...a,z), [bx,by]=point(...b,z);
          return depth(ax+bx,ay+by);
        }
        faces.sort((a,b)=>faceDepth(a)-faceDepth(b));
        for(const [a,b] of faces) polygon([point(...a,z),point(...b,z),point(...b,z+h),point(...a,z+h)],colors[1]);
        polygon(corners.map(c=>point(...c,z+h)),colors[0]);
      };
      if(truck){
        slab(.82,.245,.05,.14,['#586362','#384646']);
        const cab=()=>{
          slab(.21,.23,.19,.22,body,.60);
          slab(.16,.21,.41,.17,[body[0],'#40585b'],.57);
        };
        const cargo=()=>slab(.57,.25,.19,.55,['#f6e8c6','#cbba98'],-.22);
        if(depth(Math.cos(angle),Math.sin(angle))>0){cargo();cab()} else {cab();cargo()}
      } else {
        slab(.51,.215,.04,.18,body);
        slab(.27,.18,.22,.14,[body[0],'#415a5d']);
      }
      for(const side of [-1,1]){
        const v=side*.14, nose=truck ? .80 : .50, z=truck ? .414 : .225;
        polygon([point(nose-.08,v-.035,z),point(nose,v-.035,z),point(nose,v+.035,z),point(nose-.08,v+.035,z)],'#fff2c5');
      }
      pen.restore();
    }};
  }
  // Each route starts at a sidewalk edge and ends on the opposite sidewalk.
  const walkers = [
    {arm:0, direction:1, phase:0, arrival:.3, delay:.12, coat:'#ac543f', skin:'#ad7658'},
    {arm:1, direction:-1, phase:0, arrival:2.8, delay:.45, coat:'#507995', skin:'#e0b595'},
    {arm:2, direction:1, phase:0, arrival:1.5, delay:.22, coat:'#d9a339', skin:'#885e48'},
    {arm:3, direction:-1, phase:0, arrival:3.4, delay:.68, coat:'#57735c', skin:'#bd896b'},
    {arm:0, direction:-1, phase:1, arrival:2.4, delay:.35, coat:'#77668e', skin:'#b78362'},
    {arm:1, direction:1, phase:1, arrival:.8, delay:.02, coat:'#a25854', skin:'#875e49'},
    {arm:2, direction:-1, phase:1, arrival:3.1, delay:.60, coat:'#46877e', skin:'#e2b99c'},
    {arm:3, direction:1, phase:1, arrival:1.4, delay:.27, coat:'#b1814c', skin:'#a07052'}
  ];

  function walkingPosition(walker,clock) {
    const age=(clock+walker.phase*halfCycle)%cycle;
    const walkStart=9.7+walker.delay;
    const edge=6, curb=2.04;
    const approach=Math.min(1,Math.max(0,(age-walker.arrival)/4.5));
    const cross=Math.min(1,Math.max(0,(age-walkStart)/4.4));
    const depart=Math.min(1,Math.max(0,(age-walkStart-4.4)/4.5));
    if(approach===0 || depart===1) return null;
    const distance=(edge-curb)*(approach+depart)+2*curb*cross;
    const along=walker.direction*(distance-edge);
    const [x,y]=rotate(1.88+walker.direction*.11,along,walker.arm);
    const waiting=approach===1 && cross===0;
    const swing=waiting ? 0 : Math.sin(distance*11);
    return {x,y,stride:swing*walker.direction,opacity:Math.min(1,(edge-Math.abs(along))/.55)};
  }

  function pedestrian(walker, position) {
    const {x,y,stride,opacity}=position;
    return {depth:depth(x,y), draw(){
      const [px,py] = project(x,y);
      function limb(ax,ay,bx,by,color,width) {
        pen.strokeStyle=color; pen.lineWidth=width; pen.lineCap='round';
        pen.beginPath(); pen.moveTo(px+ax,py+ay); pen.lineTo(px+bx,py+by); pen.stroke();
      }
      pen.save();
      pen.globalAlpha=opacity;
      ellipse(x+.03,y+.03,0,6,2,'#47534e55');
      limb(-1,-8,-2+stride*3,-1-stride,'#374446',2.6);
      limb(1,-8,2-stride*3,-1+stride,'#374446',2.6);
      limb(0,-14,0,-8,walker.coat,5.6);
      limb(0,-13,2+stride*2,-9,walker.coat,2.2);
      pen.fillStyle=walker.skin;
      pen.beginPath(); pen.arc(px,py-17,2.8,0,Math.PI*2); pen.fill();
      pen.restore();
    }};
  }
  function draw() {
    pen.clearRect(0,0,canvas.width,canvas.height);
    pen.save();
    pen.translate(500,245);
    pen.scale(1.14*zoom,1.14*zoom);
    pen.translate(-500,-245);
    ground();
    const objects=[];
    for(const walker of walkers){
      const position=walkingPosition(walker,time);
      if(position) objects.push(pedestrian(walker,position));
    }
    for(const [x,y] of [[-4,-4],[3.5,-4.8],[4.8,-4],[-4.9,3.7],[4.2,4.1]])
      objects.push({depth:depth(x,y),draw:()=>tree(x,y)});
    for(let approach=0;approach<4;approach++){
      const age=(time+(approach%2)*halfCycle)%cycle;
      const [x,y]=rotate(-2.42,1.83,approach);
      objects.push({depth:depth(x,y),draw:()=>light(x,y,age)});
      ['straight','right','left'].forEach((route,index)=>{
        const position=pose(age,route,approach);
        if(position) objects.push(vehicle(position,colors[(approach*2+index)%colors.length]));
      });
    }
    objects.sort((a,b)=>a.depth-b.depth).forEach(o=>o.draw());
    pen.restore();
  }
  function tick(now) {
    time=(time+(last===null ? 0 : Math.min((now-last)/1000,.1)))%cycle;
    last=now;draw();frame=requestAnimationFrame(tick);
  }
  function sync(){
    cancelAnimationFrame(frame);last=null;
    const label=paused ? 'Play traffic animation' : 'Pause traffic animation';
    button.title=label;button.setAttribute('aria-label',label);
    button.textContent=paused ? '▶' : 'Ⅱ';
    if(!paused && visible && !document.hidden) frame=requestAnimationFrame(tick);
  }
  const zoomIn = figure.querySelector('[data-camera="in"]');
  const zoomOut = figure.querySelector('[data-camera="out"]');
  const reset = figure.querySelector('[data-camera="reset"]');

  function updateView(angle, pitch, magnification) {
    yaw = angle % (2*Math.PI);
    cosine = Math.cos(yaw);
    sine = Math.sin(yaw);
    tilt = Math.max(.65, Math.min(1.4,pitch));
    zoom = Math.max(1, Math.min(maxZoom,magnification));
    zoomOut.disabled = zoom === 1;
    zoomIn.disabled = zoom === maxZoom;
    draw();
  }
  zoomIn.addEventListener('click',()=>updateView(yaw,tilt,zoom*1.25));
  zoomOut.addEventListener('click',()=>updateView(yaw,tilt,zoom/1.25));
  reset.addEventListener('click',()=>updateView(0,1,1));

  let drag = null;
  canvas.addEventListener('pointerdown',event=>{
    if (drag || (event.button!==0 && event.button!==2)) return;
    drag = {id:event.pointerId, x:event.clientX, y:event.clientY, yaw, tilt, zoom, zooming:event.button===2};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if (drag?.id!==event.pointerId) return;
    if (drag.zooming) {
      updateView(drag.yaw,drag.tilt,drag.zoom*Math.exp((drag.y-event.clientY)*.012));
      return;
    }
    const angle = drag.yaw + (event.clientX-drag.x)*Math.PI*2/canvas.clientWidth;
    const pitch = drag.tilt + (event.clientY-drag.y)/canvas.clientHeight;
    updateView(angle,pitch,zoom);
  });
  function endDrag(event) {
    if (drag?.id===event.pointerId) drag=null;
  }
  for (const type of ['pointerup','pointercancel','lostpointercapture']) {
    canvas.addEventListener(type,endDrag);
  }
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('wheel',event=>{
    if (!event.deltaY) return;
    event.preventDefault();
    const unit = event.deltaMode===1 ? 16 : event.deltaMode===2 ? canvas.clientHeight : 1;
    const delta = Math.max(-160,Math.min(160,event.deltaY*unit));
    updateView(yaw,tilt,zoom*Math.exp(-delta*.003));
  },{passive:false});
  canvas.addEventListener('keydown',event=>{
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    switch(event.key) {
      case 'ArrowLeft': updateView(yaw-.15,tilt,zoom); break;
      case 'ArrowRight': updateView(yaw+.15,tilt,zoom); break;
      case 'ArrowUp': updateView(yaw,tilt+.08,zoom); break;
      case 'ArrowDown': updateView(yaw,tilt-.08,zoom); break;
      case '+': case '=': updateView(yaw,tilt,zoom*1.25); break;
      case '-': updateView(yaw,tilt,zoom/1.25); break;
      case 'Home': updateView(0,1,1); break;
      default: return;
    }
    event.preventDefault();
  });
  figure.hidden=false;
  draw();
  button.addEventListener('click',()=>{paused=!paused;sync()});
  preference.addEventListener('change',()=>{paused=preference.matches;sync()});
  document.addEventListener('visibilitychange',sync);
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync()}).observe(figure);
  sync();
})();
