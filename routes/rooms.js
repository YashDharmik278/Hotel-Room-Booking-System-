const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/rooms - List all rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await db.allPromise(`
      SELECT r.*,
        (SELECT COUNT(*) FROM bookings b 
         WHERE b.room_id = r.id AND b.booking_status = 'Confirmed' AND date('now') >= b.check_in_date AND date('now') < b.check_out_date
        ) AS is_currently_occupied
      FROM rooms r
      ORDER BY r.room_number ASC
    `);
    res.json({ success: true, data: rooms });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve rooms', error: err.message });
  }
});

// GET /api/rooms/search - Search available rooms by date range and optional room type
router.get('/search', async (req, res) => {
  const { check_in, check_out, room_type } = req.query;

  if (!check_in || !check_out) {
    return res.status(400).json({
      success: false,
      message: 'Both check_in and check_out dates are required for search (format: YYYY-MM-DD).'
    });
  }

  const checkInDate = new Date(check_in);
  const checkOutDate = new Date(check_out);

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  if (checkInDate >= checkOutDate) {
    return res.status(400).json({
      success: false,
      message: 'Check-out date must be strictly after check-in date.'
    });
  }

  try {
    let sql = `
      SELECT r.* FROM rooms r
      WHERE r.status = 'Available'
        AND r.id NOT IN (
          SELECT b.room_id FROM bookings b
          WHERE b.booking_status = 'Confirmed'
            AND (b.check_in_date < ? AND b.check_out_date > ?)
        )
    `;
    const params = [check_out, check_in];

    if (room_type && room_type !== 'All') {
      sql += ' AND r.room_type = ?';
      params.push(room_type);
    }

    sql += ' ORDER BY r.price_per_night ASC';

    const availableRooms = await db.allPromise(sql, params);

    // Calculate nights
    const diffTime = Math.abs(checkOutDate - checkInDate);
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const enriched = availableRooms.map(room => ({
      ...room,
      nights,
      estimated_total: nights * room.price_per_night
    }));

    res.json({
      success: true,
      count: enriched.length,
      search_criteria: { check_in, check_out, room_type: room_type || 'All', nights },
      data: enriched
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Search failed', error: err.message });
  }
});

// GET /api/rooms/:id - Get a specific room
router.get('/:id', async (req, res) => {
  try {
    const room = await db.getPromise('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }
    res.json({ success: true, data: room });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch room', error: err.message });
  }
});

// POST /api/rooms - Add a new room
router.post('/', async (req, res) => {
  const { room_number, room_type, price_per_night, capacity, status } = req.body;

  if (!room_number || !room_type || price_per_night === undefined) {
    return res.status(400).json({
      success: false,
      message: 'room_number, room_type, and price_per_night are required.'
    });
  }

  const price = parseFloat(price_per_night);
  if (isNaN(price) || price <= 0) {
    return res.status(400).json({
      success: false,
      message: 'price_per_night must be a positive number.'
    });
  }

  const roomCap = capacity ? parseInt(capacity, 10) : 2;
  if (isNaN(roomCap) || roomCap <= 0) {
    return res.status(400).json({
      success: false,
      message: 'capacity must be a positive integer.'
    });
  }

  const roomStatus = status || 'Available';

  try {
    // Check if room number already exists
    const existing = await db.getPromise('SELECT id FROM rooms WHERE room_number = ?', [room_number.trim()]);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Room number "${room_number}" already exists. Please choose a unique room number.`
      });
    }

    const result = await db.runPromise(
      'INSERT INTO rooms (room_number, room_type, price_per_night, capacity, status) VALUES (?, ?, ?, ?, ?)',
      [room_number.trim(), room_type.trim(), price, roomCap, roomStatus]
    );

    const newRoom = await db.getPromise('SELECT * FROM rooms WHERE id = ?', [result.lastID]);
    res.status(201).json({
      success: true,
      message: 'Room added successfully.',
      data: newRoom
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to add room', error: err.message });
  }
});

// PUT /api/rooms/:id - Update room details
router.put('/:id', async (req, res) => {
  const { room_number, room_type, price_per_night, capacity, status } = req.body;

  try {
    const existing = await db.getPromise('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    const updatedRoomNumber = room_number ? room_number.trim() : existing.room_number;
    const updatedType = room_type ? room_type.trim() : existing.room_type;
    const updatedPrice = price_per_night !== undefined ? parseFloat(price_per_night) : existing.price_per_night;
    const updatedCapacity = capacity !== undefined ? parseInt(capacity, 10) : existing.capacity;
    const updatedStatus = status || existing.status;

    if (isNaN(updatedPrice) || updatedPrice <= 0) {
      return res.status(400).json({ success: false, message: 'price_per_night must be positive.' });
    }

    // Check conflict if changing room number
    if (updatedRoomNumber !== existing.room_number) {
      const duplicate = await db.getPromise('SELECT id FROM rooms WHERE room_number = ? AND id != ?', [updatedRoomNumber, req.params.id]);
      if (duplicate) {
        return res.status(409).json({ success: false, message: `Room number "${updatedRoomNumber}" is already in use.` });
      }
    }

    await db.runPromise(
      'UPDATE rooms SET room_number = ?, room_type = ?, price_per_night = ?, capacity = ?, status = ? WHERE id = ?',
      [updatedRoomNumber, updatedType, updatedPrice, updatedCapacity, updatedStatus, req.params.id]
    );

    const updated = await db.getPromise('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Room updated successfully.', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update room', error: err.message });
  }
});

// DELETE /api/rooms/:id - Delete a room
router.delete('/:id', async (req, res) => {
  try {
    const room = await db.getPromise('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    // Check for active bookings
    const activeBookings = await db.getPromise(`
      SELECT COUNT(*) AS count FROM bookings 
      WHERE room_id = ? AND booking_status = 'Confirmed' AND check_out_date >= date('now')
    `, [req.params.id]);

    if (activeBookings && activeBookings.count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete room with active/upcoming confirmed bookings. Please cancel bookings first.'
      });
    }

    await db.runPromise('DELETE FROM rooms WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: `Room ${room.room_number} deleted successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete room', error: err.message });
  }
});

module.exports = router;
