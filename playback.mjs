import {validatePlayback} from './osc.mjs';

export const DEFAULT_DURATIONS=[18,8,null,13,38];
// The relay sends the existing /ac/scene messages; TouchDesigner needs no changes.
export class Playback {
 constructor(values=DEFAULT_DURATIONS){this.durations=validatePlayback({durations:values}).durations;this.automatic=true;this.reset();}
 reset(){this.scene=null;this.view=0;this.started=null;this.requested=null;this.sequence=null;}
 observe(state,now,reconnected=false){
  const changed=this.scene!==state.sceneIndex;
  const confirmed=this.requested?.scene===state.sceneIndex;
  if(confirmed||(!this.requested&&(changed||reconnected||(!this.view&&state.view))))this.started=now;
  if(confirmed)this.requested=null;
  this.scene=state.sceneIndex;this.view=state.view;
 }
 action(name,now){if(!['play','animation','reset'].includes(name))throw Error('Unknown action');this.sequence=name;this.automatic=name!=='reset';this.started=now;this.requested=name==='reset'?null:{scene:name==='play'?0:3,at:now};}
 mode(value,now){this.sequence=null;if(![0,1].includes(value)||!Number.isInteger(value))throw Error('播放模式需為 0（手動）或 1（自動）');this.automatic=Boolean(value);this.started=now;this.requested=value?{scene:0,at:now}:null;}
 configure(values,now){this.durations=validatePlayback({durations:values}).durations;this.started=now;}
 command(scene,now){if(scene!==this.scene||this.requested)this.requested={scene,at:now};}
 due(now,connected){
  if(!connected||!this.automatic||!this.view||this.scene===null||this.requested||this.scene===2)return null;
  if(now>=this.started+this.durations[this.scene]*1000){if(this.scene===4){this.action('reset',now);return -1;}const scene=this.scene+1;this.command(scene,now);return scene;}
  return null;
 }
 snapshot(now,connected){
  const duration=this.scene===null?null:this.durations[this.scene];
  const paused=!connected?'disconnected':!this.view?'NO_VIEW':null;
  return {sequence:this.sequence,automatic:this.automatic,durations:this.durations.slice(),
   remaining:this.automatic&&duration!==null?paused?duration:Math.max(0,duration-(now-this.started)/1000):null,
   waitingHand:this.automatic&&this.scene===2,awaitingScene:this.requested?.scene??null,paused,source:'relay'};
 }
}
