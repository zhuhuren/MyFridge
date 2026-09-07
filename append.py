with open('app.js', 'a', encoding='utf-8') as f:
    f.write('''\n
// =======================
// Grocery List
// =======================
async function renderGroceryList() {
  const container = document.getElementById('grocery-list');
  const emptyState = document.getElementById('grocery-empty');
  container.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';

  try {
    const res = await window.fetch(API_BASE_URL + '/api/grocery');
    if (!res.ok) throw new Error('Failed to fetch grocery list');
    const items = await res.json();
    
    container.innerHTML = '';
    if (items.length === 0) {
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        if (item.is_purchased) {
          card.style.opacity = '0.6';
          card.style.textDecoration = 'line-through';
        }
        
        const cat = CATEGORIES.find(c => c.name === item.category) || CATEGORIES[CATEGORIES.length - 1];
        
        card.innerHTML = 
          <div style="display: flex; align-items: center; gap: 12px; cursor: pointer; flex: 1;" onclick="toggleGroceryItem()">
            <div style="font-size: 24px;"></div>
            <div>
              <div class="item-name"></div>
              <div class="item-category" style="background-color: 20; color: "> </div>
            </div>
          </div>
          <button class="btn btn-outline" style="border:none; color: var(--danger);" onclick="deleteGroceryItem()">???</button>
        ;
        container.appendChild(card);
      });
    }
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Error loading list.</p></div>';
  }
}

async function addGroceryItem(name) {
  try {
    const res = await window.fetch(API_BASE_URL + '/api/grocery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error('Failed to add');
    renderGroceryList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleGroceryItem(id) {
  try {
    const res = await window.fetch(API_BASE_URL + '/api/grocery/' + id, { method: 'PUT' });
    if (!res.ok) throw new Error('Failed to update');
    renderGroceryList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteGroceryItem(id) {
  try {
    const res = await window.fetch(API_BASE_URL + '/api/grocery/' + id, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    renderGroceryList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('btn-add-grocery').addEventListener('click', () => {
  const input = document.getElementById('grocery-input');
  const name = input.value.trim();
  if (name) {
    addGroceryItem(name);
    input.value = '';
  }
});

document.getElementById('grocery-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('btn-add-grocery').click();
  }
});
''')
