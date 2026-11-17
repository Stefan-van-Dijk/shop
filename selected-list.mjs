import {snapshot,installSnapshot} from './sharon.mjs?v=20261117-session';
import {validate} from './core.mjs?v=20261115-list-lifecycle';

// Opening a link always reads the selected server list, even if it is cached.
// A pending local edit is never silently replaced by that authoritative read.
export async function fetchSelectedList(state,api,id){
 if(typeof id!=='string'||!id.trim())throw Error('Deze lijstlink is ongeldig.');
 const response=await api.read(id),payload=response.list?.payload;
 if(payload?.list?.id!==id)throw Error('De server antwoordde voor een andere lijst.');
 validate({schemaVersion:1,...payload,recipes:[],lists:[payload.list]});
 const existing=state.lists.find(list=>list.id===id);
 const local=existing&&JSON.stringify(snapshot(state,existing));
 const changed=existing&&(!existing.cloud||existing.cloud.pending||existing.cloud.conflict||local!==existing.cloud.base);
 if(changed&&local!==JSON.stringify(payload))throw Error('Deze lijst heeft lokale wijzigingen. Open het Sharon-lijstenmenu om de online versie op te halen en je wijzigingen als eigen kopie te bewaren.');
 return installSnapshot(state,payload,{revision:response.list.revision,role:response.role,base:JSON.stringify(payload),confirmedAt:Date.now()});
}
