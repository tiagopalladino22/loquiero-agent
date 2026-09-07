#!/usr/bin/env node
const url = (process.env.LOQUIERO_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key = process.env.LOQUIERO_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const arg = JSON.parse(process.argv[2] || '{}');
const sku = String(arg.sku || arg.codigo || '').trim();
const wa = arg.wa ? String(arg.wa).trim() : null;
const estado = arg.estado || 'vendido comprobante';
function out(o){ process.stdout.write(JSON.stringify(o)+'\n'); }
async function main() {
  if (!url || !key) return out({ok:false, reason:'config'});
  if (!sku) return out({ok:false, reason:'sin_sku'});
  async function patchEstado(est) {
    const params = new URLSearchParams();
    params.set('sku', `eq.${sku}`);
    if (wa) params.set('reservado_por', `eq.${wa}`);
    const res = await fetch(`${url}/rest/v1/productos?${params}`, {
      method:'PATCH',
      headers:{ apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', Prefer:'return=representation' },
      body: JSON.stringify({ estado: est, updated_at: new Date().toISOString() })
    });
    let json=null; try { json=await res.json(); } catch {}
    return {res, json, estado: est};
  }
  try {
    let r = await patchEstado(estado);
    if (!r.res.ok && estado !== 'vendido') r = await patchEstado('vendido');
    if (!r.res.ok) return out({ok:false, reason:'update_error', status:r.res.status, error:r.json});
    if (!Array.isArray(r.json) || r.json.length === 0) return out({ok:false, reason:'no_match'});
    return out({ok:true, estado:r.json[0].estado, requested_estado: estado, producto:r.json[0]});
  } catch(e) { return out({ok:false, reason:'network', error:String(e.message||e)}); }
}
await main();
