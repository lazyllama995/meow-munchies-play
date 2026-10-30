// All times use the active game clock, so menus and background tabs do not
// make a player appear stuck. A level gets at most two short nudges.
export class EarlyLevelHelp {
  start(enabled, now) {
    this.active=enabled;
    this.lastAction=now;
    this.failures=0;
    this.pending=null;
    this.shown=0;
    this.visibleUntil=0;
    this.nextAt=now;
  }
  interacted(now) {
    if(!this.active)return;
    this.lastAction=now;
    this.visibleUntil=0;
    this.pending=null;
  }
  failedAttempt(now) {
    if(!this.active)return;
    this.interacted(now);
    this.failures++;
  }
  moved(now, {unhelpful=false}={}) {
    if(!this.active)return;
    this.interacted(now);
    this.failures=0;
    this.pending=unhelpful?'order':null;
  }
  requestedHint(now) {
    if(!this.active)return;
    this.interacted(now);
    this.failures=0;
    this.pending=null;
    this.nextAt=Math.max(this.nextAt,now+14);
  }
  tick(now, {blocked=false}={}) {
    if(!this.active||blocked||this.shown>=2||now<this.nextAt||this.visible(now))return null;
    const reason=this.pending||(this.failures>=2?'mistakes':now-this.lastAction>=9?'idle':null);
    if(!reason)return null;
    this.pending=null;
    this.failures=0;
    this.shown++;
    this.visibleUntil=now+4.5;
    this.nextAt=now+16;
    return reason;
  }
  visible(now) { return this.active&&now<this.visibleUntil; }
}
