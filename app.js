const API_BASE_URL = 'https://myfridge-api.zhuqingmo.workers.dev';

const CATEGORIES = [
  { name: 'Dairy', emoji: '🥛', color: '#42A5F5' },
  { name: 'Meat & Fish', emoji: '🥩', color: '#EF5350' },
  { name: 'Produce', emoji: '🥬', color: '#66BB6A' },
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

async function deleteItem(id, reason) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/items/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  } catch (error) {
    console.error('Error deleting item:', error);
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
    return { total_consumed: 0, total_wasted: 0, by_month: [] };
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
  // Reset file input so the same file can be selected again
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

function formatDate(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate + 'T00:00:00');
  return date.toLocaleDateString();
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

  card.innerHTML = `
    <div class="item-info">
      <div class="item-header">
        <span class="item-name">${safeName}</span>
        <span class="item-category-pill" style="background-color: ${catColor}">${escapeHtml(item.category || 'Other')}</span>
      </div>
      <div class="item-details">
        <span class="item-qty">Qty: ${item.quantity} · ${item.location}</span>
        <span class="item-expiry-text ${expiryInfo.status}">${expiryInfo.text}</span>
      </div>
    </div>
    <div class="item-actions">
      <button class="icon-btn edit" title="Edit">✏️</button>
      <button class="icon-btn delete" title="Remove">🗑️</button>
    </div>
  `;

  // Edit button
  card.querySelector('.icon-btn.edit').addEventListener('click', (e) => {
    e.stopPropagation();
    openItemForm(item.id);
  });

  // Delete button
  card.querySelector('.icon-btn.delete').addEventListener('click', (e) => {
    e.stopPropagation();
    openRemoveModal(item.id, item.name);
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

  // Clear and populate
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

  const totalConsumed = stats.total_consumed || 0;
  const totalWasted = stats.total_wasted || 0;
  const total = totalConsumed + totalWasted;
  const wastePercent = total > 0 ? Math.round((totalWasted / total) * 100) : 0;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-consumed').textContent = totalConsumed;
  document.getElementById('stat-wasted').textContent = totalWasted;
  document.getElementById('stat-waste-percent').textContent = wastePercent + '%';

  const chart = document.getElementById('stats-chart');
  chart.innerHTML = '';

  const months = stats.by_month || [];
  if (months.length > 0) {
    const maxVal = Math.max(...months.map(m => Math.max(m.consumed, m.wasted, 1)));

    months.forEach(month => {
      const consumedHeight = (month.consumed / maxVal) * 100;
      const wastedHeight = (month.wasted / maxVal) * 100;
      // Format month label: '2026-09' -> 'Sep'
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const monthIdx = parseInt(month.month.split('-')[1], 10) - 1;
      const label = monthNames[monthIdx] || month.month;

      const col = document.createElement('div');
      col.className = 'chart-column';
      col.innerHTML = `
        <div class="chart-bar-group">
          <div class="chart-bar consumed" style="height: ${consumedHeight}%"></div>
          <div class="chart-bar wasted" style="height: ${wastedHeight}%"></div>
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

  // Update header
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

  // Populate categories dropdown
  catSelect.innerHTML = CATEGORIES.map(c => `<option value="${c.name}">${c.emoji} ${c.name}</option>`).join('');

  const previewDiv = document.getElementById('item-image-preview');

  if (itemId) {
    // Edit mode
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
    document.getElementById('item-expiry').value = item.expiry_date || '';

    // Set location segment
    document.querySelectorAll('#form-location .segment').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === item.location);
    });

    // Show image if available
    if (item.image_url) {
      previewDiv.querySelector('img').src = item.image_url;
      previewDiv.style.display = 'block';
    } else {
      previewDiv.style.display = 'none';
    }

  } else {
    // Add mode
    title.textContent = 'Add Item';
    state.editingItem = null;

    document.getElementById('item-name').value = prefillData ? (prefillData.name || '') : '';
    document.getElementById('item-category').value = (prefillData && prefillData.category) ? prefillData.category : 'Other';
    document.getElementById('item-quantity').value = '1';
    document.getElementById('item-expiry').value = '';

    // Set default location to current location
    document.querySelectorAll('#form-location .segment').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === state.currentLocation);
    });

    // Preview image if barcode lookup provided one
    if (prefillData && prefillData.image_url) {
      previewDiv.querySelector('img').src = prefillData.image_url;
      previewDiv.style.display = 'block';
    } else {
      previewDiv.style.display = 'none';
    }
  }

  modal.style.display = 'flex';
}

function closeItemForm() {
  document.getElementById('modal-item-form').style.display = 'none';
  state.editingItem = null;
}

function openRemoveModal(itemId, itemName) {
  const modal = document.getElementById('modal-remove');
  document.getElementById('remove-item-name').textContent = itemName;
  modal.dataset.itemId = itemId;
  modal.style.display = 'flex';
}

function closeRemoveModal() {
  document.getElementById('modal-remove').style.display = 'none';
}

// =======================
// Event Setup
// =======================
function setupEvents() {
  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Inventory Location Tabs
  document.querySelectorAll('#inventory-locations .segment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#inventory-locations .segment').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      state.currentLocation = e.target.dataset.loc;
      renderInventory();
    });
  });

  // Search (debounced)
  let searchTimeout;
  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value;
      renderInventory();
    }, 300);
  });

  // Sort
  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.currentSort = e.target.value;
    renderInventory();
  });

  // FAB — open scanner
  document.getElementById('fab-add').addEventListener('click', () => {
    startScanning();
  });

  // Scanner Modal — close
  document.getElementById('close-scanner').addEventListener('click', stopScanning);

  // Scanner — manual entry
  document.getElementById('manual-entry-btn').addEventListener('click', () => {
    stopScanning();
    openItemForm();
  });

  // Scanner — photo fallback
  document.getElementById('scanner-file').addEventListener('change', handlePhotoFallback);

  // Item Form — close
  document.getElementById('close-item-form').addEventListener('click', closeItemForm);

  // Item Form — location tabs
  document.querySelectorAll('#form-location .segment').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('#form-location .segment').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
    });
  });

  // Item Form — quantity stepper
  document.getElementById('qty-minus').addEventListener('click', (e) => {
    e.preventDefault();
    const input = document.getElementById('item-quantity');
    input.value = Math.max(1, parseInt(input.value || 1) - 1);
  });
  document.getElementById('qty-plus').addEventListener('click', (e) => {
    e.preventDefault();
    const input = document.getElementById('item-quantity');
    input.value = parseInt(input.value || 1) + 1;
  });

  // Item Form — save
  document.getElementById('save-item-btn').addEventListener('click', async () => {
    const nameInput = document.getElementById('item-name');
    if (!nameInput.value.trim()) {
      showToast('Name is required', 'error');
      return;
    }

    const activeLocBtn = document.querySelector('#form-location .segment.active');

    const itemData = {
      name: nameInput.value.trim(),
      location: activeLocBtn ? activeLocBtn.dataset.val : 'fridge',
      category: document.getElementById('item-category').value,
      quantity: parseInt(document.getElementById('item-quantity').value || 1),
      expiry_date: document.getElementById('item-expiry').value || null
    };

    // If we have an image from barcode lookup, include it
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

  // Remove Modal
  document.getElementById('btn-cancel-remove').addEventListener('click', closeRemoveModal);

  const handleRemove = async (reason) => {
    const modal = document.getElementById('modal-remove');
    const id = modal.dataset.itemId;
    try {
      await deleteItem(id, reason);
      showToast(`Item marked as ${reason}`);
      closeRemoveModal();
      if (state.currentView === 'inventory') renderInventory();
      if (state.currentView === 'expiring') renderExpiring();
      if (state.currentView === 'stats') renderStats();
    } catch (err) {
      showToast('Failed to remove item', 'error');
    }
  };

  document.getElementById('btn-consumed').addEventListener('click', () => handleRemove('consumed'));
  document.getElementById('btn-wasted').addEventListener('click', () => handleRemove('wasted'));
}

// =======================
// Initialization
// =======================
document.addEventListener('DOMContentLoaded', () => {
  renderCategoryChips();
  setupEvents();
  renderInventory();
});
