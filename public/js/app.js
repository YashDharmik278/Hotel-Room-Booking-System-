/**
 * GrandStay Hotel Room Booking System
 * Client-Side Application Logic (Vanilla JavaScript)
 * Communicates with Express.js REST API via Fetch/AJAX
 */

// API Base URL: works seamlessly whether accessed via http://localhost:3000 or file:///
const API_BASE = (window.location.origin && window.location.origin.startsWith('http')) 
  ? '' 
  : 'http://localhost:3000';

// Application State
let allRooms = [];
let allBookings = [];
let activeModalRoom = null;

// ==========================================
// Initialization
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('[GrandStay] Initializing application. API Base:', API_BASE || 'Current Origin');

  // If opened via file://, display helper notification
  if (window.location.protocol === 'file:') {
    showFileProtocolNotice();
  }

  // Set default search and booking dates
  initDefaultDates();

  // Initial data loading
  loadStats();
  loadRooms();
  loadBookings();

  // Listen for escape key to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeBookingModal();
      closeEditRoomModal();
    }
  });
});

/**
 * Notice if opened via file:/// protocol
 */
function showFileProtocolNotice() {
  const container = document.getElementById('toast-container');
  if (container) {
    showToast(
      'Local File Protocol Detected',
      'Connecting to backend at http://localhost:3000. Ensure "npm start" is running in your terminal.',
      'info'
    );
  }
}

/**
 * Initialize default check-in (today) and check-out (tomorrow)
 */
function initDefaultDates() {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const todayStr = formatDateToInput(today);
  const tomorrowStr = formatDateToInput(tomorrow);

  const searchCheckIn = document.getElementById('searchCheckIn');
  const searchCheckOut = document.getElementById('searchCheckOut');

  if (searchCheckIn && !searchCheckIn.value) {
    searchCheckIn.min = todayStr;
    searchCheckIn.value = todayStr;
  }
  if (searchCheckOut && !searchCheckOut.value) {
    searchCheckOut.min = tomorrowStr;
    searchCheckOut.value = tomorrowStr;
  }

  const modalCheckIn = document.getElementById('modalCheckIn');
  const modalCheckOut = document.getElementById('modalCheckOut');
  if (modalCheckIn && !modalCheckIn.value) modalCheckIn.min = todayStr;
  if (modalCheckOut && !modalCheckOut.value) modalCheckOut.min = tomorrowStr;
}

function formatDateToInput(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCurrency(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2
  });
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return 'N/A';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return dateStr;
}

function calcNights(inDateStr, outDateStr) {
  const dIn = new Date(inDateStr);
  const dOut = new Date(outDateStr);
  const diffTime = dOut - dIn;
  const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : 0;
}

// ==========================================
// Tab Switching Navigation
// ==========================================
function switchTab(tabId) {
  // Update Tab Buttons
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update Tab Panes
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.style.display = 'none';
  });

  const targetPane = document.getElementById(`tab-${tabId}`);
  if (targetPane) {
    targetPane.style.display = 'block';
  }

  // Refresh data on tab switch
  if (tabId === 'inventory') {
    loadRooms();
    loadStats();
  } else if (tabId === 'bookings') {
    loadBookings();
    loadStats();
  } else if (tabId === 'search-book') {
    initDefaultDates();
  }
}

// ==========================================
// Toast Notifications
// ==========================================
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';
  if (type === 'warning') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${icon}" style="font-size: 1.25rem; margin-top: 0.15rem; color: ${
      type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--primary)'
    }"></i>
    <div class="toast-content" style="flex: 1;">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(message)}</p>
    </div>
    <button style="background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #94a3b8; line-height: 1;" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4200);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================
// Dashboard Stats
// ==========================================
async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    const json = await res.json();
    if (json.success && json.stats) {
      const s = json.stats;
      document.getElementById('statTotalRooms').textContent = s.totalRooms;
      document.getElementById('statAvailableRooms').textContent = s.availableRoomsToday;
      document.getElementById('statConfirmedBookings').textContent = s.confirmedBookings;
      document.getElementById('statTotalRevenue').textContent = formatCurrency(s.totalRevenue);
    }
  } catch (err) {
    console.error('[GrandStay] Failed to load stats:', err);
  }
}

// ==========================================
// TAB 1: Room Inventory
// ==========================================
async function loadRooms() {
  const container = document.getElementById('roomsContainer');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/rooms`);
    const json = await res.json();

    if (json.success && Array.isArray(json.data)) {
      allRooms = json.data;
      filterRooms();
    } else {
      container.innerHTML = `<div class="empty-state"><p>Failed to load rooms: ${json.message}</p></div>`;
    }
  } catch (err) {
    console.error('[GrandStay] Failed to fetch rooms:', err);
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; color: var(--danger); margin-bottom: 0.75rem;"></i>
        <h3>Unable to Connect to Server</h3>
        <p>Ensure the Node.js backend is running (<code>npm start</code> on port 3000).</p>
      </div>
    `;
  }
}

function filterRooms() {
  const searchVal = (document.getElementById('roomSearchInput')?.value || '').trim().toLowerCase();
  const typeVal = document.getElementById('roomTypeFilter')?.value || 'All';
  const statusVal = document.getElementById('roomStatusFilter')?.value || 'All';

  const filtered = allRooms.filter(room => {
    const matchesSearch = room.room_number.toLowerCase().includes(searchVal) ||
                          room.room_type.toLowerCase().includes(searchVal);
    const matchesType = typeVal === 'All' || room.room_type === typeVal;
    const matchesStatus = statusVal === 'All' || room.status === statusVal;
    return matchesSearch && matchesType && matchesStatus;
  });

  renderRooms(filtered);
}

function renderRooms(rooms) {
  const container = document.getElementById('roomsContainer');
  if (!container) return;

  if (rooms.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon"><i class="fa-solid fa-bed"></i></div>
        <h3>No Rooms Found</h3>
        <p>No rooms match your filter criteria or no rooms have been added yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = rooms.map(room => {
    const isMaintenance = room.status === 'Maintenance';
    const isOccupiedToday = room.is_currently_occupied > 0;

    let badgeHtml = '';
    if (isMaintenance) {
      badgeHtml = `<span class="badge badge-maintenance"><i class="fa-solid fa-wrench"></i> Under Maintenance</span>`;
    } else if (isOccupiedToday) {
      badgeHtml = `<span class="badge badge-occupied"><i class="fa-solid fa-user-lock"></i> Occupied Today</span>`;
    } else {
      badgeHtml = `<span class="badge badge-available"><i class="fa-solid fa-circle-check"></i> Available</span>`;
    }

    return `
      <div class="room-card">
        <div>
          <div class="room-card-header">
            <div>
              <span class="room-number">Room ${escapeHtml(room.room_number)}</span>
            </div>
            <span class="room-type-tag">${escapeHtml(room.room_type)}</span>
          </div>

          <div style="margin-bottom: 0.75rem;">
            ${badgeHtml}
          </div>

          <div class="room-meta">
            <div class="room-meta-item">
              <i class="fa-solid fa-user-group" style="width: 16px; color: var(--primary);"></i>
              <span>Capacity: ${room.capacity} ${room.capacity === 1 ? 'Guest' : 'Guests'}</span>
            </div>
            <div class="room-meta-item">
              <i class="fa-solid fa-tag" style="width: 16px; color: var(--primary);"></i>
              <span class="room-price">${formatCurrency(room.price_per_night)} <span>/ night</span></span>
            </div>
          </div>
        </div>

        <div class="room-actions">
          ${
            !isMaintenance
              ? `<button class="btn btn-primary btn-sm" style="flex: 1;" onclick="openBookingModalForRoom(${room.id})">
                   <i class="fa-solid fa-calendar-check"></i> Book
                 </button>`
              : `<button class="btn btn-secondary btn-sm" style="flex: 1;" disabled title="Room under maintenance">
                   <i class="fa-solid fa-ban"></i> Unavailable
                 </button>`
          }
          <button class="btn btn-secondary btn-sm" onclick="openEditRoomModal(${room.id})" title="Edit Room Details">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn btn-danger btn-sm" onclick="handleDeleteRoom(${room.id}, '${escapeHtml(room.room_number)}')" title="Delete Room">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// TAB 2: Add Room
// ==========================================
async function handleAddRoom(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('addRoomBtn');
  const roomNumber = document.getElementById('newRoomNumber').value.trim();
  const roomType = document.getElementById('newRoomType').value;
  const price = parseFloat(document.getElementById('newPricePerNight').value);
  const capacity = parseInt(document.getElementById('newCapacity').value, 10);
  const status = document.getElementById('newStatus').value;

  if (!roomNumber || !roomType || isNaN(price) || price <= 0 || isNaN(capacity) || capacity <= 0) {
    showToast('Validation Error', 'Please complete all required fields with valid positive values.', 'error');
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    const res = await fetch(`${API_BASE}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_number: roomNumber,
        room_type: roomType,
        price_per_night: price,
        capacity,
        status
      })
    });

    const json = await res.json();

    if (res.status === 201 && json.success) {
      showToast('Room Added', `Room ${roomNumber} (${roomType}) has been registered!`, 'success');
      document.getElementById('addRoomForm').reset();
      await loadRooms();
      await loadStats();
      switchTab('inventory');
    } else {
      showToast('Add Room Failed', json.message || 'Could not register room.', 'error');
    }
  } catch (err) {
    showToast('Network Error', 'Failed to communicate with the server.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Room';
  }
}

// ==========================================
// Room Edit Modal (PUT)
// ==========================================
function openEditRoomModal(roomId) {
  const room = allRooms.find(r => r.id === roomId);
  if (!room) return;

  const modal = document.getElementById('editRoomModal');
  if (!modal) return;

  document.getElementById('editRoomId').value = room.id;
  document.getElementById('editRoomNumber').value = room.room_number;
  document.getElementById('editRoomType').value = room.room_type;
  document.getElementById('editPricePerNight').value = room.price_per_night;
  document.getElementById('editCapacity').value = room.capacity;
  document.getElementById('editStatus').value = room.status;

  modal.classList.add('active');
}

function closeEditRoomModal() {
  const modal = document.getElementById('editRoomModal');
  if (modal) modal.classList.remove('active');
}

async function handleUpdateRoom(event) {
  event.preventDefault();

  const id = document.getElementById('editRoomId').value;
  const roomNumber = document.getElementById('editRoomNumber').value.trim();
  const roomType = document.getElementById('editRoomType').value;
  const price = parseFloat(document.getElementById('editPricePerNight').value);
  const capacity = parseInt(document.getElementById('editCapacity').value, 10);
  const status = document.getElementById('editStatus').value;

  const submitBtn = document.getElementById('updateRoomBtn');

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

    const res = await fetch(`${API_BASE}/api/rooms/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_number: roomNumber,
        room_type: roomType,
        price_per_night: price,
        capacity,
        status
      })
    });

    const json = await res.json();

    if (json.success) {
      showToast('Room Updated', `Room ${roomNumber} updated successfully.`, 'success');
      closeEditRoomModal();
      await loadRooms();
      await loadStats();
    } else {
      showToast('Update Failed', json.message || 'Could not update room.', 'error');
    }
  } catch (err) {
    showToast('Network Error', 'Failed to communicate with server.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-save"></i> Save Changes';
  }
}

// ==========================================
// Room Delete (DELETE)
// ==========================================
async function handleDeleteRoom(id, roomNumber) {
  const confirmed = confirm(`Are you sure you want to delete Room ${roomNumber}? This cannot be undone.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE}/api/rooms/${id}`, {
      method: 'DELETE'
    });
    const json = await res.json();

    if (json.success) {
      showToast('Room Deleted', json.message, 'success');
      await loadRooms();
      await loadStats();
    } else {
      showToast('Cannot Delete Room', json.message, 'error');
    }
  } catch (err) {
    showToast('Network Error', 'Failed to delete room.', 'error');
  }
}

// ==========================================
// TAB 3: Search Available Rooms
// ==========================================
function updateSearchCheckOutMin() {
  const checkIn = document.getElementById('searchCheckIn').value;
  const checkOutInput = document.getElementById('searchCheckOut');
  if (checkIn && checkOutInput) {
    const d = new Date(checkIn);
    d.setDate(d.getDate() + 1);
    const minStr = formatDateToInput(d);
    checkOutInput.min = minStr;
    if (checkOutInput.value <= checkIn) {
      checkOutInput.value = minStr;
    }
  }
}

async function handleSearchRooms(event) {
  event.preventDefault();

  const checkIn = document.getElementById('searchCheckIn').value;
  const checkOut = document.getElementById('searchCheckOut').value;
  const roomType = document.getElementById('searchRoomType').value;

  if (!checkIn || !checkOut) {
    showToast('Input Required', 'Please select both check-in and check-out dates.', 'warning');
    return;
  }

  if (new Date(checkIn) >= new Date(checkOut)) {
    showToast('Invalid Dates', 'Check-out date must be strictly after check-in date.', 'error');
    return;
  }

  const resultsSection = document.getElementById('searchResultsSection');
  const resultsGrid = document.getElementById('searchResultsGrid');
  const heading = document.getElementById('searchResultsHeading');
  const subtitle = document.getElementById('searchResultsSubtitle');

  resultsSection.style.display = 'block';
  resultsGrid.innerHTML = `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <div class="empty-state-icon"><i class="fa-solid fa-spinner fa-spin"></i></div>
      <p>Searching available rooms...</p>
    </div>
  `;

  try {
    const query = new URLSearchParams({
      check_in: checkIn,
      check_out: checkOut,
      room_type: roomType
    });

    const res = await fetch(`${API_BASE}/api/rooms/search?${query.toString()}`);
    const json = await res.json();

    if (json.success) {
      const nights = json.search_criteria.nights;
      heading.textContent = `Available Rooms (${json.count} Found)`;
      subtitle.textContent = `Stay period: ${formatDateDisplay(checkIn)} to ${formatDateDisplay(checkOut)} (${nights} ${nights === 1 ? 'night' : 'nights'}) • Type: ${roomType}`;

      if (json.data.length === 0) {
        resultsGrid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon"><i class="fa-solid fa-calendar-xmark"></i></div>
            <h3>No Rooms Available</h3>
            <p>All rooms matching "${roomType}" are currently reserved between ${checkIn} and ${checkOut}.</p>
            <p style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--primary);">Try adjusting your date range or selecting "All Types".</p>
          </div>
        `;
        return;
      }

      resultsGrid.innerHTML = json.data.map(room => `
        <div class="room-card" style="border: 2px solid #93c5fd;">
          <div>
            <div class="room-card-header">
              <span class="room-number">Room ${escapeHtml(room.room_number)}</span>
              <span class="room-type-tag">${escapeHtml(room.room_type)}</span>
            </div>

            <div style="margin-bottom: 0.75rem;">
              <span class="badge badge-available"><i class="fa-solid fa-check-circle"></i> Available for Selected Dates</span>
            </div>

            <div class="room-meta">
              <div class="room-meta-item">
                <i class="fa-solid fa-user-group" style="width: 16px; color: var(--primary);"></i>
                <span>Capacity: ${room.capacity} Guests</span>
              </div>
              <div class="room-meta-item">
                <i class="fa-solid fa-tag" style="width: 16px; color: var(--primary);"></i>
                <span>${formatCurrency(room.price_per_night)} / night</span>
              </div>
              <div class="room-meta-item" style="font-weight: 700; color: var(--dark); margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px dashed var(--border);">
                <i class="fa-solid fa-receipt" style="width: 16px; color: var(--success);"></i>
                <span>Total for ${nights} ${nights === 1 ? 'night' : 'nights'}: ${formatCurrency(room.estimated_total)}</span>
              </div>
            </div>
          </div>

          <div class="room-actions">
            <button class="btn btn-primary" style="width: 100%;" onclick="openBookingModalForRoom(${room.id}, '${checkIn}', '${checkOut}')">
              <i class="fa-solid fa-calendar-check"></i> Book for ${formatCurrency(room.estimated_total)}
            </button>
          </div>
        </div>
      `).join('');
    } else {
      resultsGrid.innerHTML = `<div class="empty-state"><p>${json.message}</p></div>`;
    }
  } catch (err) {
    resultsGrid.innerHTML = `<div class="empty-state"><p>Search request failed.</p></div>`;
  }
}

// ==========================================
// TAB 4: Manage Bookings
// ==========================================
async function loadBookings() {
  const tbody = document.getElementById('bookingsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/api/bookings`);
    const json = await res.json();

    if (json.success && Array.isArray(json.data)) {
      allBookings = json.data;
      filterBookings();
    } else {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--danger); padding: 1.5rem;">Failed to load bookings: ${json.message}</td></tr>`;
    }
  } catch (err) {
    console.error('[GrandStay] Failed to load bookings:', err);
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--danger); padding: 1.5rem;">Server connection error.</td></tr>`;
  }
}

function filterBookings() {
  const searchVal = (document.getElementById('bookingSearchInput')?.value || '').trim().toLowerCase();
  const statusVal = document.getElementById('bookingStatusFilter')?.value || 'All';

  const filtered = allBookings.filter(b => {
    const matchesSearch = (b.guest_name && b.guest_name.toLowerCase().includes(searchVal)) ||
                          (b.room_number && b.room_number.toLowerCase().includes(searchVal)) ||
                          String(b.id).includes(searchVal);
    const matchesStatus = statusVal === 'All' || b.booking_status === statusVal;
    return matchesSearch && matchesStatus;
  });

  renderBookings(filtered);
}

function renderBookings(bookings) {
  const tbody = document.getElementById('bookingsTableBody');
  if (!tbody) return;

  if (bookings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"><i class="fa-solid fa-calendar-xmark"></i></div>
          <strong>No Booking Records Found</strong>
          <p style="font-size: 0.8rem; margin-top: 0.25rem;">Make a reservation from the Search & Book tab to see records here.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = bookings.map(b => {
    const nights = calcNights(b.check_in_date, b.check_out_date);
    const isCancelled = b.booking_status === 'Cancelled';
    const statusBadge = isCancelled
      ? `<span class="badge badge-cancelled"><i class="fa-solid fa-xmark"></i> Cancelled</span>`
      : `<span class="badge badge-available"><i class="fa-solid fa-circle-check"></i> Confirmed</span>`;

    return `
      <tr>
        <td style="font-weight: 700; color: var(--secondary);">#${b.id}</td>
        <td>
          <div style="font-weight: 600; color: var(--dark);">${escapeHtml(b.guest_name)}</div>
          <div style="font-size: 0.775rem; color: var(--text-muted);">
            ${b.guest_email ? `<i class="fa-solid fa-envelope"></i> ${escapeHtml(b.guest_email)} ` : ''}
            ${b.guest_phone ? `<i class="fa-solid fa-phone"></i> ${escapeHtml(b.guest_phone)}` : ''}
          </div>
        </td>
        <td>
          <strong>Room ${escapeHtml(b.room_number)}</strong>
          <div style="font-size: 0.75rem; color: var(--primary);">${escapeHtml(b.room_type)}</div>
        </td>
        <td>${formatDateDisplay(b.check_in_date)}</td>
        <td>${formatDateDisplay(b.check_out_date)}</td>
        <td>${nights} ${nights === 1 ? 'nt' : 'nts'}</td>
        <td style="font-weight: 700; color: var(--dark);">${formatCurrency(b.total_price)}</td>
        <td>${statusBadge}</td>
        <td>
          ${
            !isCancelled
              ? `<button class="btn btn-danger btn-sm" onclick="handleCancelBooking(${b.id}, '${escapeHtml(b.room_number)}')">
                   <i class="fa-solid fa-ban"></i> Cancel
                 </button>`
              : `<button class="btn btn-secondary btn-sm" onclick="handleDeleteBookingPermanent(${b.id}, '${escapeHtml(b.room_number)}')">
                   <i class="fa-solid fa-trash-can"></i> Delete
                 </button>`
          }
        </td>
      </tr>
    `;
  }).join('');
}

async function handleCancelBooking(bookingId, roomNumber) {
  const confirmed = confirm(`Are you sure you want to cancel booking #${bookingId} for Room ${roomNumber}?`);
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE}/api/bookings/${bookingId}`, {
      method: 'DELETE'
    });
    const json = await res.json();

    if (json.success) {
      showToast('Booking Cancelled', json.message, 'success');
      await loadBookings();
      await loadStats();
      await loadRooms();
    } else {
      showToast('Cancellation Error', json.message, 'error');
    }
  } catch (err) {
    showToast('Network Error', 'Failed to cancel booking.', 'error');
  }
}

async function handleDeleteBookingPermanent(bookingId, roomNumber) {
  const confirmed = confirm(`Permanently delete booking record #${bookingId}? This removes it entirely from the database.`);
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_BASE}/api/bookings/${bookingId}?permanent=true`, {
      method: 'DELETE'
    });
    const json = await res.json();

    if (json.success) {
      showToast('Record Deleted', json.message, 'success');
      await loadBookings();
      await loadStats();
    } else {
      showToast('Delete Error', json.message, 'error');
    }
  } catch (err) {
    showToast('Network Error', 'Failed to delete booking record.', 'error');
  }
}

// ==========================================
// Booking Modal & Reservation Flow
// ==========================================
function openBookingModalForRoom(roomId, preCheckIn, preCheckOut) {
  const room = allRooms.find(r => r.id === roomId);
  if (!room) return;

  activeModalRoom = room;

  document.getElementById('modalRoomId').value = room.id;
  document.getElementById('modalRoomName').textContent = `Room ${room.room_number} • ${room.room_type}`;
  document.getElementById('modalRoomRate').textContent = `Standard Rate: ${formatCurrency(room.price_per_night)} / night`;

  const modalCheckIn = document.getElementById('modalCheckIn');
  const modalCheckOut = document.getElementById('modalCheckOut');

  if (preCheckIn && preCheckOut) {
    modalCheckIn.value = preCheckIn;
    modalCheckOut.value = preCheckOut;
  } else {
    // Default to today and tomorrow
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    modalCheckIn.value = formatDateToInput(today);
    modalCheckOut.value = formatDateToInput(tomorrow);
  }

  // Set min check-out date
  const inD = new Date(modalCheckIn.value);
  inD.setDate(inD.getDate() + 1);
  modalCheckOut.min = formatDateToInput(inD);

  recalculateModalPrice();

  document.getElementById('bookingModal').classList.add('active');
}

function closeBookingModal() {
  const modal = document.getElementById('bookingModal');
  if (modal) modal.classList.remove('active');
  activeModalRoom = null;
}

function recalculateModalPrice() {
  if (!activeModalRoom) return;

  const inVal = document.getElementById('modalCheckIn').value;
  const outVal = document.getElementById('modalCheckOut').value;
  const summaryEl = document.getElementById('modalPriceSummary');

  if (!inVal || !outVal) {
    summaryEl.textContent = 'Please choose dates';
    return;
  }

  const nights = calcNights(inVal, outVal);
  if (nights <= 0) {
    summaryEl.textContent = 'Check-out must be after check-in';
    summaryEl.style.color = 'var(--danger)';
    return;
  }

  summaryEl.style.color = 'var(--dark)';
  const total = nights * activeModalRoom.price_per_night;
  summaryEl.textContent = `${formatCurrency(total)} (${nights} ${nights === 1 ? 'night' : 'nights'})`;
}

async function handleConfirmBooking(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('confirmBookingBtn');
  const roomId = document.getElementById('modalRoomId').value;
  const guestName = document.getElementById('modalGuestName').value.trim();
  const guestEmail = document.getElementById('modalGuestEmail').value.trim();
  const guestPhone = document.getElementById('modalGuestPhone').value.trim();
  const checkIn = document.getElementById('modalCheckIn').value;
  const checkOut = document.getElementById('modalCheckOut').value;

  if (!roomId || !guestName || !checkIn || !checkOut) {
    showToast('Missing Fields', 'Please fill in all required fields.', 'warning');
    return;
  }

  if (new Date(checkIn) >= new Date(checkOut)) {
    showToast('Invalid Dates', 'Check-out date must be strictly after check-in date.', 'error');
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Confirming...';

    const payload = {
      room_id: parseInt(roomId, 10),
      guest_name: guestName,
      guest_email: guestEmail || null,
      guest_phone: guestPhone || null,
      check_in_date: checkIn,
      check_out_date: checkOut
    };

    const res = await fetch(`${API_BASE}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await res.json();

    // Log to inspector if user is testing
    logToInspector('POST /api/bookings', payload, res.status, json, res.status === 201 ? 'BOOKING CONFIRMED' : 'REJECTED: ' + json.message);

    if (res.status === 201 && json.success) {
      showToast('Booking Confirmed!', json.message, 'success');
      closeBookingModal();
      document.getElementById('bookingModalForm').reset();
      await loadStats();
      await loadBookings();
      await loadRooms();
      switchTab('bookings');
    } else if (res.status === 409) {
      // Overlap conflict
      showToast('Date Overlap Conflict', json.message, 'error');
    } else {
      showToast('Booking Failed', json.message || 'Unable to create booking.', 'error');
    }
  } catch (err) {
    showToast('Network Error', 'Failed to communicate with the server.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Book Now';
  }
}

// ==========================================
// TAB 5: Edge Cases & Testing Suite
// ==========================================
function clearTestInspector() {
  const consoleBox = document.getElementById('testOutputConsole');
  if (consoleBox) {
    consoleBox.textContent = '// Live HTTP Request / Response Inspector cleared.\n// Click an automated test above to inspect raw requests & responses.';
  }
}

function logToInspector(endpoint, requestBody, statusCode, responseBody, assertionSummary) {
  const consoleBox = document.getElementById('testOutputConsole');
  if (!consoleBox) return;

  const timestamp = new Date().toLocaleTimeString();
  const summary = assertionSummary || (statusCode < 400 ? 'SUCCESS' : 'ERROR RESPONSE');
  const logEntry = `
================================================================================
TEST EXECUTION [${timestamp}]: ${endpoint}
--------------------------------------------------------------------------------
HTTP REQUEST:
  Endpoint: ${endpoint}
  Payload:
${JSON.stringify(requestBody, null, 2)}

HTTP RESPONSE:
  Status: ${statusCode}
  Body:
${JSON.stringify(responseBody, null, 2)}
--------------------------------------------------------------------------------
ASSERTION RESULT: ${summary}
================================================================================
`;

  consoleBox.textContent = logEntry + (consoleBox.textContent.startsWith('// Click a test above') ? '' : consoleBox.textContent);
}

async function runEdgeCaseTest(testType) {
  showToast('Test Started', `Running test case: "${testType}"...`, 'info');

  try {
    const testRoom = allRooms.length > 0 ? allRooms[0] : { id: 1, room_number: '101' };

    if (testType === 'double-booking') {
      // Edge Case 1: Overlapping booking test (Expects 409 Conflict)
      // Step A: Create or ensure primary booking
      const bookingA = {
        room_id: testRoom.id,
        guest_name: 'Test Guest A',
        check_in_date: '2026-11-10',
        check_out_date: '2026-11-15'
      };

      const resA = await fetch(`${API_BASE}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingA)
      });
      await resA.json();

      // Step B: Attempt overlapping reservation (2026-11-12 to 2026-11-18)
      const bookingB = {
        room_id: testRoom.id,
        guest_name: 'Test Guest B (Overlapping)',
        check_in_date: '2026-11-12',
        check_out_date: '2026-11-18'
      };

      const resB = await fetch(`${API_BASE}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingB)
      });
      const jsonB = await resB.json();

      const passed = resB.status === 409;
      logToInspector(
        'POST /api/bookings (Double-Booking Overlap)',
        bookingB,
        resB.status,
        jsonB,
        passed
          ? `PASSED! Overlapping reservation for Room ${testRoom.room_number} rejected with HTTP 409 Conflict.`
          : 'FAILED! Overlapping booking was not rejected.'
      );

      if (passed) {
        showToast('Test Passed', 'Double-booking was correctly rejected with HTTP 409 Conflict!', 'success');
      } else {
        showToast('Test Failed', `Unexpected status code: ${resB.status}`, 'error');
      }
    } else if (testType === 'invalid-dates') {
      // Edge Case 2: Checkout <= Checkin (Expects 400 Bad Request)
      const invalidPayload = {
        room_id: testRoom.id,
        guest_name: 'Invalid Date Guest',
        check_in_date: '2026-12-10',
        check_out_date: '2026-12-05' // Checkout before checkin!
      };

      const res = await fetch(`${API_BASE}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload)
      });
      const json = await res.json();

      const passed = res.status === 400;
      logToInspector(
        'POST /api/bookings (Checkout <= Checkin)',
        invalidPayload,
        res.status,
        json,
        passed
          ? 'PASSED! Invalid date range rejected with HTTP 400 Bad Request.'
          : 'FAILED! Expected HTTP 400.'
      );

      if (passed) {
        showToast('Test Passed', 'Invalid date range rejected with HTTP 400 Bad Request!', 'success');
      } else {
        showToast('Test Failed', `Unexpected status code: ${res.status}`, 'error');
      }
    } else if (testType === 'duplicate-room') {
      // Edge Case 3: Duplicate room number (Expects 409 Conflict)
      const duplicatePayload = {
        room_number: testRoom.room_number, // Already existing in DB
        room_type: 'Single',
        price_per_night: 1500,
        capacity: 1,
        status: 'Available'
      };

      const res = await fetch(`${API_BASE}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicatePayload)
      });
      const json = await res.json();

      const passed = res.status === 409;
      logToInspector(
        'POST /api/rooms (Duplicate Room Number)',
        duplicatePayload,
        res.status,
        json,
        passed
          ? `PASSED! Duplicate room "${testRoom.room_number}" rejected with HTTP 409 Conflict.`
          : 'FAILED! Duplicate room was not rejected.'
      );

      if (passed) {
        showToast('Test Passed', 'Duplicate room number rejected with HTTP 409 Conflict!', 'success');
      } else {
        showToast('Test Failed', `Unexpected status code: ${res.status}`, 'error');
      }
    } else if (testType === 'cancel-nonexistent') {
      // Edge Case 4: Cancel non-existent booking (Expects 404 Not Found)
      const nonExistentId = 999999;
      const res = await fetch(`${API_BASE}/api/bookings/${nonExistentId}`, {
        method: 'DELETE'
      });
      const json = await res.json();

      const passed = res.status === 404;
      logToInspector(
        `DELETE /api/bookings/${nonExistentId} (Cancel Non-existent)`,
        { bookingId: nonExistentId },
        res.status,
        json,
        passed
          ? 'PASSED! Non-existent booking deletion returned HTTP 404 Not Found.'
          : 'FAILED! Expected HTTP 404.'
      );

      if (passed) {
        showToast('Test Passed', 'Non-existent booking returned HTTP 404 Not Found!', 'success');
      } else {
        showToast('Test Failed', `Unexpected status code: ${res.status}`, 'error');
      }
    }
  } catch (err) {
    showToast('Test Error', err.message, 'error');
  }
}
