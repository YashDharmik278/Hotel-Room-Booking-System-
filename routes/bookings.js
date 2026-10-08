const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/bookings - List all bookings with room details
router.get('/', async (req, res) => {
  try {
    const { status, room_id } = req.query;
    let sql = `
      SELECT b.*, r.room_number, r.room_type, r.price_per_night
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND b.booking_status = ?';
      params.push(status);
    }
    if (room_id) {
      sql += ' AND b.room_id = ?';
      params.push(room_id);
    }

    sql += ' ORDER BY b.check_in_date DESC, b.created_at DESC';

    const bookings = await db.allPromise(sql, params);
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve bookings', error: err.message });
  }
});

// GET /api/bookings/:id - Get specific booking
router.get('/:id', async (req, res) => {
  try {
    const booking = await db.getPromise(`
      SELECT b.*, r.room_number, r.room_type, r.price_per_night
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE b.id = ?
    `, [req.params.id]);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve booking', error: err.message });
  }
});

// POST /api/bookings - Book a room for a guest with overlap validation
router.post('/', async (req, res) => {
  const { room_id, guest_name, guest_email, guest_phone, check_in_date, check_out_date } = req.body;

  // 1. Check required fields
  if (!room_id || !guest_name || !check_in_date || !check_out_date) {
    return res.status(400).json({
      success: false,
      message: 'room_id, guest_name, check_in_date, and check_out_date are required fields.'
    });
  }

  // 2. Validate dates
  const checkIn = new Date(check_in_date);
  const checkOut = new Date(check_out_date);

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format. Please use YYYY-MM-DD.'
    });
  }

  if (checkIn >= checkOut) {
    return res.status(400).json({
      success: false,
      message: 'Check-out date must be strictly after check-in date.'
    });
  }

  try {
    // 3. Verify room existence and active status
    const room = await db.getPromise('SELECT * FROM rooms WHERE id = ?', [room_id]);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: `Room with ID ${room_id} does not exist.`
      });
    }

    if (room.status !== 'Available') {
      return res.status(400).json({
        success: false,
        message: `Room ${room.room_number} is currently marked as '${room.status}' and cannot be booked.`
      });
    }

    // 4. Input validation: Ensure room cannot be double-booked for overlapping dates!
    // An overlap occurs when: (Existing Check-In < Requested Check-Out) AND (Existing Check-Out > Requested Check-In)
    const overlappingBookings = await db.allPromise(`
      SELECT id, guest_name, check_in_date, check_out_date
      FROM bookings
      WHERE room_id = ?
        AND booking_status = 'Confirmed'
        AND check_in_date < ?
        AND check_out_date > ?
    `, [room_id, check_out_date, check_in_date]);

    if (overlappingBookings.length > 0) {
      const conflict = overlappingBookings[0];
      return res.status(409).json({
        success: false,
        message: `Conflict: Room ${room.room_number} is already booked from ${conflict.check_in_date} to ${conflict.check_out_date} by ${conflict.guest_name}.`,
        conflictBooking: conflict
      });
    }

    // 5. Calculate total nights and total price
    const diffTime = Math.abs(checkOut - checkIn);
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const totalPrice = nights * room.price_per_night;

    // 6. Insert new booking
    const result = await db.runPromise(`
      INSERT INTO bookings (room_id, guest_name, guest_email, guest_phone, check_in_date, check_out_date, total_price, booking_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Confirmed')
    `, [
      room_id,
      guest_name.trim(),
      guest_email ? guest_email.trim() : null,
      guest_phone ? guest_phone.trim() : null,
      check_in_date,
      check_out_date,
      totalPrice
    ]);

    const createdBooking = await db.getPromise(`
      SELECT b.*, r.room_number, r.room_type, r.price_per_night
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE b.id = ?
    `, [result.lastID]);

    res.status(201).json({
      success: true,
      message: `Room ${room.room_number} booked successfully for ${guest_name}!`,
      data: createdBooking
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create booking', error: err.message });
  }
});

// DELETE /api/bookings/:id - Cancel/delete a booking
router.delete('/:id', async (req, res) => {
  const { permanent } = req.query;

  try {
    const booking = await db.getPromise(`
      SELECT b.*, r.room_number 
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE b.id = ?
    `, [req.params.id]);

    // Edge case: cancelling a non-existent booking
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: `Booking ID #${req.params.id} does not exist.`
      });
    }

    // Edge case: cancelling already cancelled booking
    if (booking.booking_status === 'Cancelled' && permanent !== 'true') {
      return res.status(400).json({
        success: false,
        message: `Booking ID #${req.params.id} is already cancelled.`
      });
    }

    if (permanent === 'true') {
      await db.runPromise('DELETE FROM bookings WHERE id = ?', [req.params.id]);
      return res.json({
        success: true,
        message: `Booking #${req.params.id} for Room ${booking.room_number} has been permanently deleted.`
      });
    } else {
      await db.runPromise("UPDATE bookings SET booking_status = 'Cancelled' WHERE id = ?", [req.params.id]);
      return res.json({
        success: true,
        message: `Booking #${req.params.id} for Room ${booking.room_number} has been successfully cancelled.`
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to cancel booking', error: err.message });
  }
});

module.exports = router;
