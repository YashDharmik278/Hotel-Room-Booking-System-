const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'hotel.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Helper functions for Promise-based queries
db.runPromise = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

db.getPromise = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

db.allPromise = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize schema and seed data
async function initDatabase() {
  try {
    await db.runPromise('PRAGMA foreign_keys = ON;');

    // 1. Rooms Table
    await db.runPromise(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_number TEXT UNIQUE NOT NULL,
        room_type TEXT NOT NULL,
        price_per_night REAL NOT NULL,
        capacity INTEGER NOT NULL DEFAULT 2,
        status TEXT NOT NULL DEFAULT 'Available',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Bookings Table
    await db.runPromise(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL,
        guest_name TEXT NOT NULL,
        guest_email TEXT,
        guest_phone TEXT,
        check_in_date DATE NOT NULL,
        check_out_date DATE NOT NULL,
        total_price REAL NOT NULL,
        booking_status TEXT NOT NULL DEFAULT 'Confirmed',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      )
    `);

    // Check if rooms are populated
    const countRow = await db.getPromise('SELECT COUNT(*) AS count FROM rooms');
    if (countRow && countRow.count === 0) {
      console.log('Seeding initial room records...');
      const seedRooms = [
        ['101', 'Single', 1500, 1],
        ['102', 'Double', 2500, 2],
        ['201', 'Deluxe', 4200, 2],
        ['202', 'Deluxe', 4200, 3],
        ['301', 'Suite', 7500, 4],
        ['302', 'Executive Suite', 9500, 4]
      ];

      for (const [roomNo, type, price, cap] of seedRooms) {
        await db.runPromise(
          'INSERT INTO rooms (room_number, room_type, price_per_night, capacity) VALUES (?, ?, ?, ?)',
          [roomNo, type, price, cap]
        );
      }
      console.log('Sample rooms seeded successfully.');
    }

    // Check if sample bookings exist
    const bookingCountRow = await db.getPromise('SELECT COUNT(*) AS count FROM bookings');
    if (bookingCountRow && bookingCountRow.count === 0) {
      const room102 = await db.getPromise("SELECT id, price_per_night FROM rooms WHERE room_number = '102'");
      if (room102) {
        const today = new Date();
        const twoDaysLater = new Date();
        twoDaysLater.setDate(today.getDate() + 2);
        const inStr = today.toISOString().split('T')[0];
        const outStr = twoDaysLater.toISOString().split('T')[0];
        await db.runPromise(`
          INSERT INTO bookings (room_id, guest_name, guest_email, guest_phone, check_in_date, check_out_date, total_price, booking_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'Confirmed')
        `, [room102.id, 'John Doe', 'john.doe@example.com', '+91 9876543210', inStr, outStr, room102.price_per_night * 2]);
        console.log('Sample booking seeded for Room 102.');
      }
    }
  } catch (err) {
    console.error('Error during database initialization:', err);
  }
}

initDatabase();

module.exports = db;
