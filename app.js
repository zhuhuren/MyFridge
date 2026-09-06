const API_BASE_URL = 'https://myfridge-api.zhuqingmo.workers.dev';

const CATEGORIES = [
  { name: 'Dairy', emoji: '🥛', color: '#42A5F5' },
  { name: 'Meat & Fish', emoji: '🥩', color: '#EF5350' },
  { name: 'Produce', emoji: '🥬', color: '#66BB6A' },
  { name: 'Dish', emoji: '🍲', color: '#8D6E63' },
  { name: 'Bakery & Grains', emoji: '🍞', color: '#FFA726' },
  { name: 'Frozen', emoji: '🧊', color: '#26C6DA' },
  { name: 'Canned & Jarred', emoji: '🥫', color: '#FF7043' },
  { name: 'Beverages', emoji: '🥤', color: '#AB47BC' },
  { name: 'Snacks', emoji: '🍪', color: '#EC407A' },
  { name: 'Condiments', emoji: '🧂', color: '#FFEE58' },
  { name: 'Other', emoji: '📦', color: '#BDBDBD' }
];

let state = {
  currentView: 'inventory',
  currentLocation: 'fridge',
  currentCategory: 'All',
  currentSort: 'expiry_asc',
  searchQuery: '',
  items: [],
  editingItem: null,
  html5Qrcode: null
};

// =======================
// API Service
// =======================
async function fetchItems(location, category, search, sort) {
  try {
    const params = new URLSearchParams();
    if (location) params.set('location', location);
    if (category && category !== 'All') params.set('category', category);
    if (search) params.set('search', search);
    if (sort) params.set('sort', sort);
    const response = await fetch(`${API_BASE_URL}/api/items?${params.toString()}`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Error fetching items:', error);
    showToast('Failed to fetch items', 'error');
    return [];
  }
}

async function fetchItem(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/items/${id}`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Error fetching item:', error);
    return null;
  }
}

async function createItem(data) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Error creating item:', error);
    throw error;
  }
}

async function updateItem(id, data) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Error updating item:', error);
    throw error;
  }
}

async function logItemActivity(id, reason, amount) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/items/${id}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: reason, amount })
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Error logging item:', error);
    throw error;
  }
}

async function lookupBarcode(barcode) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/lookup/${barcode}`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Error looking up barcode:', error);
    return { found: false };
  }
}

async function fetchStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stats`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Error fetching stats:', error);
    return null;
  }
}

async function fetchExpiring() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/expiring`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Error fetching expiring items:', error);
    return [];
  }
}

// =======================
// Scanner Module
// =======================
function initScanner() {
  if (!state.html5Qrcode) {
    state.html5Qrcode = new Html5Qrcode("scanner-container");
  }
}

async function startScanning() {
  const modal = document.getElementById('modal-scanner');
  modal.style.display = 'flex';
  initScanner();

  try {
    await state.html5Qrcode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      onScanSuccess,
      (errorMessage) => { /* Ignore regular scan failures */ }
    );
  } catch (err) {
    console.error('Error starting scanner:', err);
    showToast('Could not start camera. Try "Take Photo" instead.', 'error');
  }
}

async function stopScanning() {
  if (state.html5Qrcode && state.html5Qrcode.isScanning) {
    try {
      await state.html5Qrcode.stop();
    } catch (err) {
      console.error('Error stopping scanner:', err);
    }
  }
  document.getElementById('modal-scanner').style.display = 'none';
}

async function onScanSuccess(decodedText) {
  await stopScanning();
  showToast('Barcode scanned! Looking up product...');

  const productInfo = await lookupBarcode(decodedText);
  if (productInfo && productInfo.found) {
    showToast(`Found: ${productInfo.name}`);
    openItemForm(null, productInfo);
  } else {
    showToast('Product not in database. Enter details manually.');
    openItemForm(null, { name: '', category: 'Other', image_url: null });
  }
}

async function handlePhotoFallback(event) {
  const file = event.target.files[0];
  if (!file) return;

  initScanner();
  try {
    const decodedText = await Html5Qrcode.scanFile(file, true);
    await stopScanning();
    showToast('Barcode scanned! Looking up product...');
    const productInfo = await lookupBarcode(decodedText);
    if (productInfo && productInfo.found) {
      showToast(`Found: ${productInfo.name}`);
      openItemForm(null, productInfo);
    } else {
      showToast('Product not in database. Enter details manually.');
      openItemForm(null, { name: '', category: 'Other', image_url: null });
    }
  } catch (err) {
    console.error('Error scanning file:', err);
    showToast('Could not read barcode from image. Enter manually.', 'error');
    await stopScanning();
    openItemForm();
  }
  event.target.value = '';
}

// =======================
// UI Helpers
// =======================
function getCategoryColor(categoryName) {
  const cat = CATEGORIES.find(c => c.name === categoryName);
  return cat ? cat.color : '#BDBDBD';
}

function getExpiryStatus(expiryDateStr) {
  if (!expiryDateStr) return { status: 'none', daysLeft: null, text: 'No expiry set' };

  const expiry = new Date(expiryDateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = expiry - today;
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { status: 'expired', daysLeft, text: `Expired ${Math.abs(daysLeft)}d ago` };
  if (daysLeft === 0) return { status: 'urgent', daysLeft, text: 'Expires today!' };
  if (daysLeft <= 3) return { status: 'urgent', daysLeft, text: `${daysLeft} day${daysLeft > 1 ? 's' : ''} left` };
  if (daysLeft <= 7) return { status: 'warning', daysLeft, text: `${daysLeft} days left` };
  return { status: 'fresh', daysLeft, text: `${daysLeft} days left` };
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}

function formatDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  // Example: "Sep 5, 2026, 7:35 PM"
  return d.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// =======================
// Render Functions
// =======================
function renderCategoryChips() {
  const container = document.getElementById('category-chips');
  container.innerHTML = '';

  const allChip = document.createElement('div');
  allChip.className = `chip ${state.currentCategory === 'All' ? 'active' : ''}`;
  allChip.textContent = 'All';
  allChip.onclick = () => {
    state.currentCategory = 'All';
    renderCategoryChips();
    renderInventory();
  };
  container.appendChild(allChip);

  CATEGORIES.forEach(cat => {
    const chip = document.createElement('div');
    chip.className = `chip ${state.currentCategory === cat.name ? 'active' : ''}`;
    chip.textContent = `${cat.emoji} ${cat.name}`;
    chip.onclick = () => {
      state.currentCategory = cat.name;
      renderCategoryChips();
      renderInventory();
    };
    container.appendChild(chip);
  });
}

function createItemCard(item) {
  const expiryInfo = getExpiryStatus(item.expiry_date);
  const catColor = getCategoryColor(item.category || 'Other');
  const safeName = escapeHtml(item.name);

  const card = document.createElement('div');
  card.className = `item-card ${expiryInfo.status}`;
  card.dataset.id = item.id;

  const displayUnit = item.unit || 'pcs';
  const addedText = formatDateTime(item.date_added);

  card.innerHTML = `
    <div class="item-info">
      <div class="item-header">
        <span class="item-name">${safeName}</span>
        <span class="item-category-pill" style="background-color: ${catColor}">${escapeHtml(item.category || 'Other')}</span>
      </div>
      <div class="item-details">
        <span class="item-qty">Qty: ${item.quantity} ${displayUnit} · ${item.location}</span>
        <span class="item-expiry-text ${expiryInfo.status}">${expiryInfo.text}</span>
      </div>
      <div style="font-size: 11px; color: var(--text-light); margin-top: 6px;">
        Added: ${addedText}
      </div>
    </div>
    <div class="item-actions">
      <button class="icon-btn edit" title="Edit">✏️</button>
      <button class="icon-btn delete" title="Log Activity">📝</button>
    </div>
  `;

  // Edit button
  card.querySelector('.icon-btn.edit').addEventListener('click', (e) => {
    e.stopPropagation();
    openItemForm(item.id);
  });

  // Log Activity button
  card.querySelector('.icon-btn.delete').addEventListener('click', (e) => {
    e.stopPropagation();
    openLogModal(item.id, item.name, item.quantity, item.unit);
  });

  return card;
}

async function renderInventory() {
  const listContainer = document.getElementById('inventory-list');
  const emptyState = document.getElementById('inventory-empty');

  listContainer.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';

  state.items = await fetchItems(state.currentLocation, state.currentCategory, state.searchQuery, state.currentSort);

  listContainer.innerHTML = '';

  if (state.items.length === 0) {
    emptyState.style.display = 'block';
  } else {
    emptyState.style.display = 'none';
    state.items.forEach(item => {
      listContainer.appendChild(createItemCard(item));
    });
  }

  document.getElementById('header-location').textContent =
    state.currentLocation.charAt(0).toUpperCase() + state.currentLocation.slice(1);
}

async function renderExpiring() {
  const items = await fetchExpiring();

  const expired = [];
  const next3 = [];
  const next7 = [];

  items.forEach(item => {
    const info = getExpiryStatus(item.expiry_date);
    if (info.status === 'expired') expired.push(item);
    else if (info.daysLeft >= 0 && info.daysLeft <= 3) next3.push(item);
    else if (info.daysLeft > 3 && info.daysLeft <= 7) next7.push(item);
  });

  const expiredSection = document.getElementById('expiring-expired');
  const next3Section = document.getElementById('expiring-next-3');
  const next7Section = document.getElementById('expiring-next-7');
  const emptyState = document.getElementById('expiring-empty');

  [expiredSection, next3Section, next7Section].forEach(s => {
    s.querySelector('.items-list').innerHTML = '';
  });

  expired.forEach(item => expiredSection.querySelector('.items-list').appendChild(createItemCard(item)));
  next3.forEach(item => next3Section.querySelector('.items-list').appendChild(createItemCard(item)));
  next7.forEach(item => next7Section.querySelector('.items-list').appendChild(createItemCard(item)));

  expiredSection.style.display = expired.length ? 'block' : 'none';
  next3Section.style.display = next3.length ? 'block' : 'none';
  next7Section.style.display = next7.length ? 'block' : 'none';

  emptyState.style.display = (expired.length === 0 && next3.length === 0 && next7.length === 0) ? 'block' : 'none';
}

async function renderStats() {
  const stats = await fetchStats();
  if (!stats) return;

  const totalCostConsumed = stats.total_cost_consumed || 0;
  const totalCostWasted = stats.total_cost_wasted || 0;
  const totalPctConsumed = stats.total_pct_consumed || 0;
  const totalPctWasted = stats.total_pct_wasted || 0;

  // Always use percentage for the Waste % so items without a cost (like Dishes) are counted!
  let wastePercent = 0;
  let consumePercent = 0;
  const totalPct = totalPctConsumed + totalPctWasted;
  
  if (totalPct > 0) {
    wastePercent = Math.round((totalPctWasted / totalPct) * 100);
    consumePercent = Math.round((totalPctConsumed / totalPct) * 100);
  }

  document.getElementById('stat-consumed').textContent = '$' + totalCostConsumed.toFixed(2);
  document.getElementById('stat-wasted').textContent = '$' + totalCostWasted.toFixed(2);
  document.getElementById('stat-pct-consumed').textContent = consumePercent + '%';
  document.getElementById('stat-pct-wasted').textContent = wastePercent + '%';

  const chart = document.getElementById('stats-chart');
  chart.innerHTML = '';

  const months = stats.by_month || [];
  if (months.length > 0) {
    // Always use percentages for chart heights so $0 items are tracked visually
    const maxVal = Math.max(...months.map(m => Math.max(m.consumed_pct, m.wasted_pct, 1)));

    months.forEach(month => {
      let cVal = month.consumed_pct;
      let wVal = month.wasted_pct;

      const consumedHeight = (cVal / maxVal) * 100;
      const wastedHeight = (wVal / maxVal) * 100;
      
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const monthIdx = parseInt(month.month.split('-')[1], 10) - 1;
      const label = monthNames[monthIdx] || month.month;

      const col = document.createElement('div');
      col.className = 'chart-column';
      col.innerHTML = `
        <div class="chart-bar-group">
          <div class="chart-bar consumed" style="height: ${consumedHeight}%" title="Consumed % Volume"></div>
          <div class="chart-bar wasted" style="height: ${wastedHeight}%" title="Wasted % Volume"></div>
        </div>
        <div class="chart-label">${label}</div>
      `;
      chart.appendChild(col);
    });
  } else {
    chart.innerHTML = '<div class="empty-state"><p>No data yet</p></div>';
  }
}

function switchView(viewName) {
  state.currentView = viewName;

  document.getElementById('view-inventory').style.display = viewName === 'inventory' ? 'block' : 'none';
  document.getElementById('view-expiring').style.display = viewName === 'expiring' ? 'block' : 'none';
  document.getElementById('view-stats').style.display = viewName === 'stats' ? 'block' : 'none';

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  if (viewName === 'inventory') {
    document.getElementById('header-location').textContent =
      state.currentLocation.charAt(0).toUpperCase() + state.currentLocation.slice(1);
    renderInventory();
  } else if (viewName === 'expiring') {
    document.getElementById('header-location').textContent = 'Expiring Soon';
    renderExpiring();
  } else if (viewName === 'stats') {
    document.getElementById('header-location').textContent = 'Statistics';
    renderStats();
  }
}

// =======================
// Modal Helpers
// =======================
async function openItemForm(itemId = null, prefillData = null) {
  const modal = document.getElementById('modal-item-form');
  const title = document.getElementById('item-form-title');
  const catSelect = document.getElementById('item-category');

  catSelect.innerHTML = CATEGORIES.map(c => `<option value="${c.name}">${c.emoji} ${c.name}</option>`).join('');
  const previewDiv = document.getElementById('item-image-preview');

  if (itemId) {
    title.textContent = 'Edit Item';
    const item = state.items.find(i => i.id == itemId) || await fetchItem(itemId);
    if (!item) {
      showToast('Item not found', 'error');
      return;
    }
    state.editingItem = item;

    document.getElementById('item-name').value = item.name;
    document.getElementById('item-category').value = item.category || 'Other';
    document.getElementById('item-quantity').value = item.quantity || 1;
    document.getElementById('item-unit').value = item.unit || 'pcs';
    document.getElementById('item-unit-cost').value = item.unit_cost !== null ? item.unit_cost : '';
    document.getElementById('item-expiry').value = item.expiry_date || '';

    const addedDisplay = document.getElementById('item-added-display');
    const addedTime = document.getElementById('item-added-time');
    if (addedDisplay && addedTime && item.date_added) {
      addedTime.textContent = formatDateTime(item.date_added);
      addedDisplay.style.display = 'block';
    }

    document.querySelectorAll('#form-location .segment').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === item.location);
    });

    const deleteBtn = document.getElementById('btn-delete-mistake');
    if (deleteBtn) {
      deleteBtn.style.display = 'block';
    }

    if (item.image_url) {
      previewDiv.querySelector('img').src = item.image_url;
      previewDiv.style.display = 'block';
      document.getElementById('btn-set-photo').style.display = 'none';
    } else {
      previewDiv.style.display = 'none';
      document.getElementById('btn-set-photo').style.display = 'block';
    }

  } else {
    title.textContent = 'Add Item';
    state.editingItem = null;

    document.getElementById('item-name').value = prefillData ? (prefillData.name || '') : '';
    document.getElementById('item-category').value = (prefillData && prefillData.category) ? prefillData.category : 'Other';
    document.getElementById('item-quantity').value = '1';
    document.getElementById('item-unit').value = 'pcs';
    document.getElementById('item-unit-cost').value = '';
    document.getElementById('item-expiry').value = '';

    const addedDisplay = document.getElementById('item-added-display');
    if (addedDisplay) {
      addedDisplay.style.display = 'none';
    }

    document.querySelectorAll('#form-location .segment').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === state.currentLocation);
    });

    const deleteBtn = document.getElementById('btn-delete-mistake');
    if (deleteBtn) {
      deleteBtn.style.display = 'none';
    }

    if (prefillData && prefillData.image_url) {
      previewDiv.querySelector('img').src = prefillData.image_url;
      previewDiv.style.display = 'block';
      document.getElementById('btn-set-photo').style.display = 'none';
    } else {
      previewDiv.style.display = 'none';
      document.getElementById('btn-set-photo').style.display = 'block';
    }
  }

  modal.style.display = 'flex';
}

function closeItemForm() {
  document.getElementById('modal-item-form').style.display = 'none';
  state.editingItem = null;
}

function openLogModal(itemId, itemName, currentQty, unit) {
  const modal = document.getElementById('modal-log');
  document.getElementById('log-item-name').textContent = itemName;
  
  const amountInput = document.getElementById('log-amount');
  amountInput.value = currentQty;
  amountInput.max = currentQty;
  
  document.getElementById('log-unit-label').textContent = unit || 'pcs';
  
  modal.dataset.itemId = itemId;
  modal.style.display = 'flex';
}

function closeLogModal() {
  document.getElementById('modal-log').style.display = 'none';
}

// =======================
// Event Setup
// =======================
function setupEvents() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.querySelectorAll('#inventory-locations .segment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#inventory-locations .segment').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.currentLocation = e.target.dataset.loc;
      renderInventory();
    });
  });

  let searchTimeout;
  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value;
      renderInventory();
    }, 300);
  });

  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.currentSort = e.target.value;
    renderInventory();
  });

  document.getElementById('fab-add').addEventListener('click', () => {
    startScanning();
  });

  document.getElementById('close-scanner').addEventListener('click', stopScanning);

  document.getElementById('manual-entry-btn').addEventListener('click', () => {
    stopScanning();
    openItemForm();
  });

  document.getElementById('scanner-file').addEventListener('change', handlePhotoFallback);
  
  // Custom Photo Upload handlers
  const handlePhotoUpload = () => {
    document.getElementById('item-image-file').click();
  };
  
  document.getElementById('btn-set-photo').addEventListener('click', handlePhotoUpload);
  document.getElementById('btn-change-photo').addEventListener('click', handlePhotoUpload);
  
  document.getElementById('item-image-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 250;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Export base64 (jpeg, 0.7 quality)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        
        // Display preview
        const previewDiv = document.getElementById('item-image-preview');
        previewDiv.querySelector('img').src = dataUrl;
        previewDiv.style.display = 'block';
        document.getElementById('btn-set-photo').style.display = 'none';
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  });

  document.getElementById('close-item-form').addEventListener('click', closeItemForm);

  document.querySelectorAll('#form-location .segment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('#form-location .segment').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
    });
  });

  document.getElementById('item-category').addEventListener('change', (e) => {
    if (e.target.value === 'Dish') {
      document.getElementById('item-quantity').value = 100;
      document.getElementById('item-unit').value = '%';
      document.getElementById('item-unit-cost').value = '';
    }
  });

  document.getElementById('save-item-btn').addEventListener('click', async () => {
    const nameInput = document.getElementById('item-name');
    if (!nameInput.value.trim()) {
      showToast('Name is required', 'error');
      return;
    }

    const activeLocBtn = document.querySelector('#form-location .segment.active');
    
    let uCost = document.getElementById('item-unit-cost').value;
    uCost = uCost ? parseFloat(uCost) : null;

    const itemData = {
      name: nameInput.value.trim(),
      location: activeLocBtn ? activeLocBtn.dataset.val : 'fridge',
      category: document.getElementById('item-category').value,
      quantity: parseFloat(document.getElementById('item-quantity').value || 1),
      unit: document.getElementById('item-unit').value,
      unit_cost: uCost,
      expiry_date: document.getElementById('item-expiry').value || null
    };

    // Include EXACT local time in ISO format to satisfy user request
    if (!state.editingItem) {
      itemData.date_added = new Date().toISOString(); 
    }

    const previewImg = document.querySelector('#item-image-preview img');
    if (previewImg && previewImg.src && document.getElementById('item-image-preview').style.display !== 'none') {
      itemData.image_url = previewImg.src;
    }

    try {
      if (state.editingItem) {
        await updateItem(state.editingItem.id, itemData);
        showToast('Item updated!');
      } else {
        await createItem(itemData);
        showToast('Item added!');
      }
      closeItemForm();
      if (state.currentView === 'inventory') renderInventory();
      if (state.currentView === 'expiring') renderExpiring();
    } catch (err) {
      showToast('Failed to save item', 'error');
    }
  });

  const deleteBtn = document.getElementById('btn-delete-mistake');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!state.editingItem) return;
      if (confirm('Are you sure you want to delete this item? It will not be logged in your stats.')) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/items/${state.editingItem.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'mistake' })
          });
          if (!response.ok) throw new Error('Failed to delete');
          showToast('Item deleted completely.');
          closeItemForm();
          if (state.currentView === 'inventory') renderInventory();
          if (state.currentView === 'expiring') renderExpiring();
        } catch (err) {
          showToast('Failed to delete item', 'error');
        }
      }
    });
  }

  // Log Modal
  document.getElementById('btn-cancel-log').addEventListener('click', closeLogModal);

  const handleLog = async (reason) => {
    const modal = document.getElementById('modal-log');
    const id = modal.dataset.itemId;
    const amount = parseFloat(document.getElementById('log-amount').value);
    
    if (!amount || amount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    try {
      await logItemActivity(id, reason, amount);
      showToast(`Logged ${amount} as ${reason}`);
      closeLogModal();
      if (state.currentView === 'inventory') renderInventory();
      if (state.currentView === 'expiring') renderExpiring();
      if (state.currentView === 'stats') renderStats();
    } catch (err) {
      showToast('Failed to log activity', 'error');
    }
  };

  document.getElementById('btn-consumed').addEventListener('click', () => handleLog('consumed'));
  document.getElementById('btn-wasted').addEventListener('click', () => handleLog('wasted'));
}

// =======================
// Initialization
// =======================
document.addEventListener('DOMContentLoaded', () => {
  renderCategoryChips();
  setupEvents();
  renderInventory();
});
