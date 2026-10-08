// The album collection lives in the desktop client (`/api/items`).
export async function collectionRequest(path = '/api/items', { method = 'GET', body, signal } = {}) {
  const response = await fetch(path, { method, signal, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error) throw new Error(result.error || '操作失败，请稍后重试。');
  return result;
}
export const listItems = () => collectionRequest().then((result) => result.items || []);
export const addItem = (item) => collectionRequest('/api/items', { method: 'POST', body: item });
export const updateItem = (id, patch) => collectionRequest('/api/items?id=' + encodeURIComponent(id), { method: 'PATCH', body: patch });
export const removeItem = (id) => collectionRequest('/api/items?id=' + encodeURIComponent(id), { method: 'DELETE' });
export const importItems = (items) => collectionRequest('/api/items/import', { method: 'POST', body: { items } });
