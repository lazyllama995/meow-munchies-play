import { gameplayScene, GAMEPLAY_SCENES } from './gameplay-scene-data.js';

const storybookScene={chapter:'storybook',background:'assets/storybook-background-v1.webp',foreground:'assets/storybook-foreground-v1.webp',ambient:[]};
function inStorybookStyle(scene) {
  if(!scene)return storybookScene;
  const restyle=path=>path.replace('/gameplay/','/gameplay/storybook/');
  return {...scene,chapter:`storybook-${scene.chapter}`,background:restyle(scene.background),foreground:restyle(scene.foreground),
    ambient:scene.ambient.map(item=>({...item,src:restyle(item.src)}))};
}

export function createGameplayScenes(game, foreground, ambient) {
  let token=0, shown=null, idle=0;
  const cache=new Map();
  function preload(scene) {
    if(cache.has(scene.chapter))return cache.get(scene.chapter);
    const request=Promise.all([scene.background,scene.foreground,...scene.ambient.map(item=>item.src)].map(src=>{
      const image=new Image();image.decoding='async';image.src=src;
      return image.decode().then(()=>image);
    }));
    cache.set(scene.chapter,request);
    // Only the current chapter and one neighbour are retained by this controller.
    while(cache.size>2)cache.delete(cache.keys().next().value);
    request.catch(()=>cache.delete(scene.chapter));
    return request;
  }
  function sprite(item) {
    const pin=document.createElement('div');pin.className='chapter-ambient';
    pin.dataset.asset=item.name;
    Object.assign(pin.style,{left:item.x+'%',top:item.y+'%',width:item.width+'%',
      transform:`translate(${-item.pivot[0]*100}%,${-item.pivot[1]*100}%)`});
    const image=new Image();image.src=item.src;image.alt='';image.draggable=false;
    image.className=item.motion==='rotate'?'chapter-rotor':'chapter-balloon';
    image.style.transformOrigin=`${item.pivot[0]*100}% ${item.pivot[1]*100}%`;
    pin.append(image);return pin;
  }
  return {
    async show(levelIndex,campaign,storybook=false) {
      const original=gameplayScene(levelIndex,campaign);
      const scene=storybook?inStorybookStyle(original):original, key=scene?.chapter??0;
      const request=++token;clearTimeout(idle);
      if(shown===key)return;
      if(!scene) {
        shown=key;delete game.dataset.scene;game.classList.remove('chapter-scene');ambient.replaceChildren();
        game.style.backgroundImage="url('assets/glow-background-v1.webp')";
        foreground.src='assets/glow-foreground-v1.webp';return;
      }
      try {
        await preload(scene);if(request!==token)return;
        shown=key;game.classList.add('chapter-scene');
        game.style.backgroundImage=`url('${scene.background}')`;foreground.src=scene.foreground;
        ambient.replaceChildren(...scene.ambient.map(sprite));
        if(original)game.dataset.scene=String(original.chapter);else delete game.dataset.scene;
        idle=setTimeout(()=>{if(request===token&&original)preload(storybook?inStorybookStyle(original):original).catch(()=>{});},800);
      } catch(error) { console.warn('Chapter scenery unavailable',error); }
    },
  };
}
