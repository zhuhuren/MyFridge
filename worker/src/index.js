const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});

const errorResponse = (message, status = 500) => jsonResponse({ error: message }, status);

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      if (path === '/api/items' && request.method === 'GET') {
        return await handleGetItems(request, env.DB, url);
      }
      if (path === '/api/items' && request.method === 'POST') {
        return await handlePostItem(request, env.DB);
      }
      // NEW partial logging endpoint
      if (path.match(/^\/api\/items\/\d+\/log$/) && request.method === 'POST') {
        const id = path.split('/')[3];
        return await handleLogItem(request, env.DB, id);
      }
      if (path.startsWith('/api/items/') && request.method === 'GET') {
        const id = path.split('/')[3];
        if (id) return await handleGetItem(env.DB, id);
      }
      if (path.startsWith('/api/items/') && request.method === 'PUT') {
        const id = path.split('/')[3];
        if (id) return await handlePutItem(request, env.DB, id);
      }
      if (path.startsWith('/api/items/') && request.method === 'DELETE') {
        const id = path.split('/')[3];
        if (id) return await handleDeleteItem(request, env.DB, id);
      }
      if (path.startsWith('/api/lookup/') && request.method === 'GET') {
        const barcode = path.split('/')[3];
        if (barcode) return await handleLookup(barcode);
      }
      if (path === '/api/stats' && request.method === 'GET') {
        return await handleStats(env.DB);
      }
      if (path === '/api/expiring' && request.method === 'GET') {
        return await handleExpiring(env.DB);
      }
      
      return errorResponse('Not found', 404);
    } catch (e) {
      console.error(e);
      return errorResponse(e.message, 500);
    }
  }
};

async function handleGetItems(request, db, url) {
  const location = url.searchParams.get('location');
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search');
  const sort = url.searchParams.get('sort') || 'date_added_desc';

  let query = 'SELECT * FROM items WHERE 1=1';
  const params = [];

  if (location) {
    query += ' AND location = ?';
    params.push(location);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  if (search) {
    query += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }

  const sortMap = {
    'expiry_asc': 'expiry_date ASC',
    'expiry_desc': 'expiry_date DESC',
    'name_asc': 'name ASC',
    'name_desc': 'name DESC',
    'date_added_desc': 'date_added DESC',
    'category_asc': 'category ASC'
  };
  
  const orderBy = sortMap[sort] || sortMap['date_added_desc'];
  query += ` ORDER BY ${orderBy}`;

  const { results } = await db.prepare(query).bind(...params).all();
  return jsonResponse(results);
}

async function handleGetItem(db, id) {
  const item = await db.prepare('SELECT * FROM items WHERE id = ?').bind(id).first();
  if (!item) return errorResponse('Item not found', 404);
  return jsonResponse(item);
}

async function handlePostItem(request, db) {
  const body = await request.json();
  const { name, barcode, category = 'Other', location = 'fridge', quantity = 1, unit = 'pcs', unit_cost = null, date_added, expiry_date, image_url } = body;
  if (!name) return errorResponse('Name is required', 400);

  // Use the exact date_added passed by frontend (which will now include local time), or fallback to current UTC time.
  const final_date_added = date_added || new Date().toISOString();

  const result = await db.prepare(
    'INSERT INTO items (name, barcode, category, location, quantity, initial_quantity, unit, unit_cost, date_added, expiry_date, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *'
  ).bind(name, barcode || null, category, location, quantity, quantity, unit, unit_cost, final_date_added, expiry_date || null, image_url || null).first();
  
  return jsonResponse(result, 201);
}

async function handlePutItem(request, db, id) {
  const body = await request.json();
  
  const currentItem = await db.prepare('SELECT * FROM items WHERE id = ?').bind(id).first();
  if (!currentItem) return errorResponse('Item not found', 404);

  const updates = [];
  const params = [];

  ['name', 'category', 'location', 'quantity', 'unit', 'unit_cost', 'expiry_date', 'image_url'].forEach(field => {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(body[field]);
    }
  });

  if (updates.length === 0) return jsonResponse(currentItem);

  params.push(id);
  const result = await db.prepare(
    `UPDATE items SET ${updates.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...params).first();

  return jsonResponse(result);
}

async function handleLogItem(request, db, id) {
  const body = await request.json();
  const { action, amount } = body;
  
  if (!action || !['consumed', 'wasted'].includes(action)) {
    return errorResponse('Valid action (consumed/wasted) is required', 400);
  }
  if (!amount || amount <= 0) {
    return errorResponse('Amount must be greater than 0', 400);
  }

  const item = await db.prepare('SELECT * FROM items WHERE id = ?').bind(id).first();
  if (!item) return errorResponse('Item not found', 404);

  const costValue = item.unit_cost !== null ? (amount * item.unit_cost) : null;
  const percentage = item.initial_quantity > 0 ? (amount / item.initial_quantity) * 100 : 0;
  const newQuantity = item.quantity - amount;

  // Insert log
  await db.prepare(
    'INSERT INTO item_log (item_name, category, location, reason, logged_quantity, unit, cost_value, percentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(item.name, item.category, item.location, action, amount, item.unit, costValue, percentage).run();

  if (newQuantity <= 0.001) {
    // Delete item if fully consumed/wasted
    await db.prepare('DELETE FROM items WHERE id = ?').bind(id).run();
    return jsonResponse({ deleted: true });
  } else {
    // Update quantity
    const updated = await db.prepare('UPDATE items SET quantity = ? WHERE id = ? RETURNING *').bind(newQuantity, id).first();
    return jsonResponse({ deleted: false, item: updated });
  }
}

// Fallback legacy DELETE and Mistake Deletion
async function handleDeleteItem(request, db, id) {
  const body = await request.json();
  const reason = body.reason || 'consumed';
  
  const item = await db.prepare('SELECT * FROM items WHERE id = ?').bind(id).first();
  if (!item) return errorResponse('Item not found', 404);

  if (reason === 'mistake') {
    // If it's a mistake, just delete it completely without logging to stats
    await db.prepare('DELETE FROM items WHERE id = ?').bind(id).run();
    return jsonResponse({ success: true, mistake: true });
  }

  const costValue = item.unit_cost !== null ? (item.quantity * item.unit_cost) : null;
  const percentage = item.initial_quantity > 0 ? (item.quantity / item.initial_quantity) * 100 : 100;

  await db.batch([
    db.prepare('INSERT INTO item_log (item_name, category, location, reason, logged_quantity, unit, cost_value, percentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(item.name, item.category, item.location, reason, item.quantity, item.unit, costValue, percentage),
    db.prepare('DELETE FROM items WHERE id = ?').bind(id)
  ]);

  return jsonResponse({ success: true });
}

async function handleLookup(barcode) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;
  
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MyFridge/1.0 (https://github.com/myfridge)' }
    });
    
    if (!res.ok) return jsonResponse({ found: false });
    
    const data = await res.json();
    if (!data || data.status !== 1) return jsonResponse({ found: false });
    
    const p = data.product;
    const rawCategories = p.categories_tags || [];
    
    let category = 'Other';
    const catStr = rawCategories.join(' ').toLowerCase();
    if (catStr.includes('dairy') || catStr.includes('milk') || catStr.includes('cheese')) category = 'Dairy';
    else if (catStr.includes('meat') || catStr.includes('fish') || catStr.includes('poultry')) category = 'Meat & Fish';
    else if (catStr.includes('fruit') || catStr.includes('vegetable')) category = 'Produce';
    else if (catStr.includes('bread') || catStr.includes('cereal') || catStr.includes('bakery')) category = 'Bakery & Grains';
    else if (catStr.includes('frozen')) category = 'Frozen';
    else if (catStr.includes('canned')) category = 'Canned & Jarred';
    else if (catStr.includes('beverage') || catStr.includes('drink')) category = 'Beverages';
    else if (catStr.includes('snack') || catStr.includes('sweet') || catStr.includes('candy')) category = 'Snacks';
    else if (catStr.includes('condiment') || catStr.includes('sauce') || catStr.includes('spice')) category = 'Condiments';
    
    return jsonResponse({
      found: true,
      name: p.product_name || p.product_name_en || 'Unknown',
      category: category,
      image_url: p.image_url || p.image_front_url || null
    });
  } catch (err) {
    return jsonResponse({ found: false });
  }
}

async function handleStats(db) {
  const summary = await db.prepare(
    `SELECT reason, SUM(cost_value) as total_cost, SUM(percentage) as total_pct FROM item_log GROUP BY reason`
  ).all();
  
  let total_cost_consumed = 0;
  let total_cost_wasted = 0;
  let total_pct_consumed = 0;
  let total_pct_wasted = 0;
  
  for (const row of summary.results) {
    if (row.reason === 'consumed') {
      total_cost_consumed = row.total_cost || 0;
      total_pct_consumed = row.total_pct || 0;
    }
    if (row.reason === 'wasted') {
      total_cost_wasted = row.total_cost || 0;
      total_pct_wasted = row.total_pct || 0;
    }
  }

  const monthsData = await db.prepare(`
    SELECT strftime('%Y-%m', removed_at) as month, reason, SUM(cost_value) as sum_cost, SUM(percentage) as sum_pct 
    FROM item_log 
    WHERE removed_at >= datetime('now', '-6 months')
    GROUP BY month, reason
    ORDER BY month ASC
  `).all();

  const monthMap = {};
  for (const row of monthsData.results) {
    if (!monthMap[row.month]) monthMap[row.month] = { month: row.month, consumed_cost: 0, wasted_cost: 0, consumed_pct: 0, wasted_pct: 0 };
    if (row.reason === 'consumed') {
      monthMap[row.month].consumed_cost = row.sum_cost || 0;
      monthMap[row.month].consumed_pct = row.sum_pct || 0;
    }
    if (row.reason === 'wasted') {
      monthMap[row.month].wasted_cost = row.sum_cost || 0;
      monthMap[row.month].wasted_pct = row.sum_pct || 0;
    }
  }

  return jsonResponse({
    total_cost_consumed,
    total_cost_wasted,
    total_pct_consumed,
    total_pct_wasted,
    by_month: Object.values(monthMap)
  });
}

async function handleExpiring(db) {
  const query = `
    SELECT * FROM items 
    WHERE expiry_date IS NOT NULL 
    AND expiry_date <= date('now', '+7 days')
    ORDER BY expiry_date ASC
  `;
  
  const { results } = await db.prepare(query).all();
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const processed = results.map(item => {
    const exp = new Date(item.expiry_date);
    const diffTime = exp - today;
    const days_remaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { ...item, days_remaining };
  });

  return jsonResponse(processed);
}
