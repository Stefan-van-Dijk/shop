export const createLibraryId = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(9)))).replaceAll('+','-').replaceAll('/','_');

export function openSourceBarcodes(product) {
 return [...new Set((product.packages || []).filter(pack =>
  typeof pack.barcode === 'string' && pack.source === 'https://world.openfoodfacts.org/product/'+pack.barcode
 ).map(pack => pack.barcode))];
}

export function barcodePreferences(product, manual, enabled) {
 const open = openSourceBarcodes(product);
 const disabled = open.filter(code => !enabled.includes(code));
 return {
  barcodes: [...new Set([...manual.filter(code => !open.includes(code)), ...enabled])],
  disabledBarcodes: disabled
 };
}

export function categoryProductIds(categories, rootId, products) {
 const byId = new Map(categories.map(category => [category.id, category]));
 const visited = new Set(), ids = new Set(), pending = [rootId];
 while (pending.length) {
  const id = pending.pop(), category = byId.get(id);
  if (!category || visited.has(id)) continue;
  visited.add(id);
  for (const entry of category.entries) {
   if (entry.type === 'category') pending.push(entry.id);
   if (entry.type === 'product') ids.add(entry.id);
  }
 }
 for (const product of products) if (visited.has(product.categoryId)) ids.add(product.id);
 return ids;
}

export function reachesCategory(categories, from, target) {
 const byId = new Map(categories.map(category => [category.id, category]));
 const seen = new Set(), pending = [from];
 while (pending.length) {
  const id = pending.pop();
  if (id === target) return true;
  if (seen.has(id)) continue;
  seen.add(id);
  for (const entry of byId.get(id)?.entries || []) if (entry.type === 'category') pending.push(entry.id);
 }
 return false;
}

export function displayCentralProduct(product, library) {
 const central = library.get(product.centralId);
 if (!central) return product;
 const manual = product.barcodes.filter(code => code !== product.centralBarcode);
 const enabled = central.barcode && product.barcodes.includes(product.centralBarcode) && !product.disabledBarcodes?.includes(central.barcode);
 return {
  ...product,
  name: product.centralName === product.name ? (central.name || central.id) : product.name,
  barcodes: [...new Set([...manual, ...(enabled ? [central.barcode] : [])])]
 };
}
