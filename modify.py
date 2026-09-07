import sys

with open('worker/src/index.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add routes
routes_target = "if (path === '/api/report' && request.method === 'GET') return await handleReport(request, env.DB, hhId);"
routes_replacement = """if (path === '/api/report' && request.method === 'GET') return await handleReport(request, env.DB, hhId);
      if (path === '/api/grocery' && request.method === 'GET') return await handleGetGrocery(env.DB, hhId);
      if (path === '/api/grocery' && request.method === 'POST') return await handlePostGrocery(request, env.DB, hhId);
      if (path.startsWith('/api/grocery/') && request.method === 'PUT') return await handlePutGrocery(env.DB, path.split('/')[3], hhId);
      if (path.startsWith('/api/grocery/') && request.method === 'DELETE') return await handleDeleteGrocery(env.DB, path.split('/')[3], hhId);"""
text = text.replace(routes_target, routes_replacement)

# 2. Add auto-add to handleLogItem
log_item_target = "await db.prepare('DELETE FROM items WHERE id = ? AND household_id = ?').bind(id, hhId).run();"
log_item_replacement = """if (body.action === 'consumed') {
      await db.prepare('INSERT INTO grocery_list (household_id, name, category) VALUES (?, ?, ?)').bind(hhId, item.name, item.category).run();
    }
    await db.prepare('DELETE FROM items WHERE id = ? AND household_id = ?').bind(id, hhId).run();"""
text = text.replace(log_item_target, log_item_replacement)

# 3. Add auto-add to handleDeleteItem
delete_item_target = "await db.prepare('DELETE FROM items WHERE id = ? AND household_id = ?').bind(id, hhId).run();"
delete_item_replacement = """if (reason === 'consumed') {
    await db.prepare('INSERT INTO grocery_list (household_id, name, category) VALUES (?, ?, ?)').bind(hhId, item.name, item.category).run();
  }
  await db.prepare('DELETE FROM items WHERE id = ? AND household_id = ?').bind(id, hhId).run();"""
text = text.replace(delete_item_target, delete_item_replacement)

# 4. Add the new functions at the bottom
new_funcs = """
async function handleGetGrocery(db, hhId) {
  const { results } = await db.prepare(SELECT * FROM grocery_list WHERE household_id = ? ORDER BY is_purchased ASC, added_at DESC).bind(hhId).all();
  return jsonResponse(results || []);
}

async function handlePostGrocery(request, db, hhId) {
  const body = await request.json();
  if (!body.name) return errorResponse('Name required', 400);
  const result = await db.prepare(
    'INSERT INTO grocery_list (household_id, name, category) VALUES (?, ?, ?) RETURNING *'
  ).bind(hhId, body.name, body.category || 'Other').first();
  return jsonResponse(result, 201);
}

async function handlePutGrocery(db, id, hhId) {
  const item = await db.prepare('SELECT is_purchased FROM grocery_list WHERE id = ? AND household_id = ?').bind(id, hhId).first();
  if (!item) return errorResponse('Not found', 404);
  const newStatus = item.is_purchased ? 0 : 1;
  const updated = await db.prepare('UPDATE grocery_list SET is_purchased = ? WHERE id = ? AND household_id = ? RETURNING *').bind(newStatus, id, hhId).first();
  return jsonResponse(updated);
}

async function handleDeleteGrocery(db, id, hhId) {
  await db.prepare('DELETE FROM grocery_list WHERE id = ? AND household_id = ?').bind(id, hhId).run();
  return jsonResponse({ success: true });
}
"""
text = text.replace("function jsonResponse(data, status = 200) {", new_funcs + "\\nfunction jsonResponse(data, status = 200) {")

with open('worker/src/index.js', 'w', encoding='utf-8') as f:
    f.write(text)
