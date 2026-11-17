// Coalesce overlapping requests, but run once more when an edit arrives in flight.
export function createSyncQueue(sync){
 let current=null,again=false;
 return {
  get current(){return current;},
  request(){
   again=true;
   if(!current)current=(async()=>{do{again=false;await sync();}while(again);})().finally(()=>{current=null;});
   return current;
  }
 };
}
export async function flushBeforeReturn({sync,hasPending,leave}){
 await sync();
 if(hasPending())throw Error('Je wijzigingen zijn nog niet online opgeslagen. Controleer de verbinding en probeer teruggaan opnieuw.');
 leave();
}
