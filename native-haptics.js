// Capacitor injects this bridge only inside the native iOS shell. Browsers
// gracefully fall back to navigator.vibrate in game.js.
const nativeHaptics=()=>globalThis.Capacitor?.isNativePlatform?.()
  ? globalThis.Capacitor?.Plugins?.Haptics
  : null;

export function playNativeHaptic(pattern){
  const haptics=nativeHaptics();
  if(!haptics)return false;
  const values=Array.isArray(pattern)?pattern:[pattern];
  const strength=Math.max(0,...values.filter(Number.isFinite));
  try{
    if(values.length>1)haptics.notification({type:strength>=40?'ERROR':'WARNING'}).catch(()=>{});
    else if(strength<=6)haptics.selectionStart().then(()=>haptics.selectionChanged()).then(()=>haptics.selectionEnd()).catch(()=>{});
    else haptics.impact({style:strength>=25?'HEAVY':strength>=10?'MEDIUM':'LIGHT'}).catch(()=>{});
  }catch{return false;}
  return true;
}
