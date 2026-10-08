const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const roomsRouter = require('./routes/rooms');
const bookingsRouter = require('./routes/bookings');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Serve client-side static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/rooms', roomsRouter);
app.use('/api/bookings', bookingsRouter);

// GET /api/stats - Dashboard summary metrics
app.use('/api/stats', async (req, res) => {
  try {
    const totalRooms = await db.getPromise('SELECT COUNT(*) AS count FROM rooms');
    const confirmedBookings = await db.getPromise("SELECT COUNT(*) AS count FROM bookings WHERE booking_status = 'Confirmed'");
    const cancelledBookings = await db.getPromise("SELECT COUNT(*) AS count FROM bookings WHERE booking_status = 'Cancelled'");
    const totalRevenue = await db.getPromise("SELECT COALESCE(SUM(total_price), 0) AS total FROM bookings WHERE booking_status = 'Confirmed'");
    
    // Active bookings today
    const currentlyOccupied = await db.getPromise(`
      SELECT COUNT(DISTINCT room_id) AS count FROM bookings
      WHERE booking_status = 'Confirmed'
        AND date('now') >= check_in_date AND date('now') < check_out_date
    `);

    res.json({
      success: true,
      stats: {
        totalRooms: totalRooms.count,
        occupiedRoomsToday: currentlyOccupied.count,
        availableRoomsToday: Math.max(0, totalRooms.count - currentlyOccupied.count),
        confirmedBookings: confirmedBookings.count,
        cancelledBookings: cancelledBookings.count,
        totalRevenue: totalRevenue.total
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve stats', error: err.message });
  }
});

// Fallback for SPA routing & 404 API routes
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'An internal server error occurred',
    error: process.env.NODE_ENV === 'production' ? null : err.message
  });
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` Hotel Room Booking System Server Running!     `);
  console.log(` URL: http://localhost:${PORT}                  `);
  console.log(` Database: SQLite (hotel.db)                   `);
  console.log(`===============================================`);
});

module.exports = app;
