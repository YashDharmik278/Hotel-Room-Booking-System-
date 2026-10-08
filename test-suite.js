/**
 * Automated Test Suite for Hotel Room Booking System
 * Validates all REST API endpoints, CRUD operations, input validations, and edge cases.
 */

const http = require('http');
const app = require('./server');

let server;
let baseUrl;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      headers: {
        'Accept': 'application/json'
      }
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('========================================================');
  console.log(' STARTING HOTEL ROOM BOOKING SYSTEM TEST SUITE');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  try {
    // 1. Check GET /api/rooms
    console.log('--- 1. Room Retrieval & Initial Data ---');
    const roomsRes = await request('GET', '/api/rooms');
    assert(roomsRes.status === 200, 'GET /api/rooms returns 200');
    assert(Array.isArray(roomsRes.data.data), 'GET /api/rooms returns array of rooms');
    assert(roomsRes.data.data.length >= 6, 'Rooms table seeded with initial rooms', `Found: ${roomsRes.data.data.length}`);

    // 2. Add New Room (POST /api/rooms)
    console.log('\n--- 2. Add Room & Validation (POST /api/rooms) ---');
    const uniqueRoomNo = 'TEST-' + Math.floor(Math.random() * 10000);
    const newRoomPayload = {
      room_number: uniqueRoomNo,
      room_type: 'Suite',
      price_per_night: 5500,
      capacity: 3,
      status: 'Available'
    };
    const addRoomRes = await request('POST', '/api/rooms', newRoomPayload);
    assert(addRoomRes.status === 201, 'POST /api/rooms creates room with 201 Created');
    assert(addRoomRes.data.data.room_number === uniqueRoomNo, 'Created room has correct room_number');
    const createdRoomId = addRoomRes.data.data.id;

    // Edge Case: Duplicate Room Number
    const duplicateRes = await request('POST', '/api/rooms', newRoomPayload);
    assert(duplicateRes.status === 409, 'POST /api/rooms rejects duplicate room_number with 409 Conflict');

    // Edge Case: Missing required fields
    const missingFieldRes = await request('POST', '/api/rooms', { room_number: '999' });
    assert(missingFieldRes.status === 400, 'POST /api/rooms rejects missing fields with 400 Bad Request');

    // Edge Case: Negative price
    const negPriceRes = await request('POST', '/api/rooms', {
      room_number: '999X',
      room_type: 'Single',
      price_per_night: -100
    });
    assert(negPriceRes.status === 400, 'POST /api/rooms rejects negative price with 400 Bad Request');

    // 3. Update Room (PUT /api/rooms/:id)
    console.log('\n--- 3. Update Room (PUT /api/rooms/:id) ---');
    const updateRes = await request('PUT', `/api/rooms/${createdRoomId}`, {
      room_number: uniqueRoomNo,
      room_type: 'Executive Suite',
      price_per_night: 6000,
      capacity: 4,
      status: 'Available'
    });
    assert(updateRes.status === 200, 'PUT /api/rooms/:id returns 200 OK');
    assert(updateRes.data.data.price_per_night === 6000, 'Room price updated to 6000');
    assert(updateRes.data.data.room_type === 'Executive Suite', 'Room type updated to Executive Suite');

    // 4. Search Available Rooms (GET /api/rooms/search)
    console.log('\n--- 4. Search Available Rooms (GET /api/rooms/search) ---');
    const searchRes = await request('GET', '/api/rooms/search?check_in=2026-12-01&check_out=2026-12-05');
    assert(searchRes.status === 200, 'GET /api/rooms/search returns 200 OK');
    assert(searchRes.data.count > 0, 'Search finds available rooms');
    assert(searchRes.data.search_criteria.nights === 4, 'Search calculates correct nights (4 nights)');

    // Edge Case: Search with check_out <= check_in
    const badSearchRes = await request('GET', '/api/rooms/search?check_in=2026-12-05&check_out=2026-12-01');
    assert(badSearchRes.status === 400, 'GET /api/rooms/search rejects check_out <= check_in with 400');

    // 5. Booking Flow & Overlap Logic (POST /api/bookings)
    console.log('\n--- 5. Booking Flow & Double-Booking Prevention ---');
    const booking1 = {
      room_id: createdRoomId,
      guest_name: 'Alice Johnson',
      guest_email: 'alice@example.com',
      guest_phone: '9876543210',
      check_in_date: '2026-12-10',
      check_out_date: '2026-12-15'
    };
    const bookRes1 = await request('POST', '/api/bookings', booking1);
    assert(bookRes1.status === 201, 'POST /api/bookings successfully books room with 201 Created');
    assert(bookRes1.data.data.total_price === 5 * 6000, 'Calculates correct total price (5 nights * ₹6000 = ₹30000)');
    const booking1Id = bookRes1.data.data.id;

    // Overlap Edge Cases on the same room:
    // A. Exact same dates (2026-12-10 to 2026-12-15)
    const exactOverlapRes = await request('POST', '/api/bookings', {
      room_id: createdRoomId,
      guest_name: 'Bob Exact',
      check_in_date: '2026-12-10',
      check_out_date: '2026-12-15'
    });
    assert(exactOverlapRes.status === 409, 'Rejects exact overlap booking with 409 Conflict');

    // B. Inside existing dates (2026-12-11 to 2026-12-14)
    const insideOverlapRes = await request('POST', '/api/bookings', {
      room_id: createdRoomId,
      guest_name: 'Charlie Inside',
      check_in_date: '2026-12-11',
      check_out_date: '2026-12-14'
    });
    assert(insideOverlapRes.status === 409, 'Rejects nested inside booking with 409 Conflict');

    // C. Overlapping start (2026-12-08 to 2026-12-12)
    const startOverlapRes = await request('POST', '/api/bookings', {
      room_id: createdRoomId,
      guest_name: 'Dave Start Overlap',
      check_in_date: '2026-12-08',
      check_out_date: '2026-12-12'
    });
    assert(startOverlapRes.status === 409, 'Rejects overlapping start dates with 409 Conflict');

    // D. Overlapping end (2026-12-14 to 2026-12-18)
    const endOverlapRes = await request('POST', '/api/bookings', {
      room_id: createdRoomId,
      guest_name: 'Eve End Overlap',
      check_in_date: '2026-12-14',
      check_out_date: '2026-12-18'
    });
    assert(endOverlapRes.status === 409, 'Rejects overlapping end dates with 409 Conflict');

    // E. Back-to-back booking (Allowed in hotel systems: check-in on the exact day previous guest checks out)
    // Guest leaves on 2026-12-15. New guest arrives on 2026-12-15 to 2026-12-18
    const backToBackRes = await request('POST', '/api/bookings', {
      room_id: createdRoomId,
      guest_name: 'Frank BackToBack',
      check_in_date: '2026-12-15',
      check_out_date: '2026-12-18'
    });
    assert(backToBackRes.status === 201, 'Allows back-to-back check-in on the day previous guest checks out (201 Created)');

    // 6. Non-Existent and Invalid Bookings
    console.log('\n--- 6. Edge Cases: Invalid Bookings & Non-existent Entities ---');
    // Booking non-existent room
    const nonExistentRoomBooking = await request('POST', '/api/bookings', {
      room_id: 999999,
      guest_name: 'Ghost Guest',
      check_in_date: '2026-12-01',
      check_out_date: '2026-12-03'
    });
    assert(nonExistentRoomBooking.status === 404, 'Rejects booking non-existent room with 404 Not Found');

    // Invalid dates (Check-out before Check-in)
    const invalidDateBooking = await request('POST', '/api/bookings', {
      room_id: createdRoomId,
      guest_name: 'Time Traveler',
      check_in_date: '2026-12-25',
      check_out_date: '2026-12-20'
    });
    assert(invalidDateBooking.status === 400, 'Rejects check_out < check_in with 400 Bad Request');

    // 7. Cancellation and Deletion (DELETE /api/bookings/:id)
    console.log('\n--- 7. Booking Cancellation & Deletion (DELETE /api/bookings/:id) ---');
    // Cancel booking 1
    const cancelRes = await request('DELETE', `/api/bookings/${booking1Id}`);
    assert(cancelRes.status === 200, 'DELETE /api/bookings/:id cancels booking with 200 OK');

    // Edge Case: Cancelling already cancelled booking
    const reCancelRes = await request('DELETE', `/api/bookings/${booking1Id}`);
    assert(reCancelRes.status === 400, 'Rejects cancelling already cancelled booking with 400 Bad Request');

    // Edge Case: Cancelling non-existent booking
    const cancelGhostRes = await request('DELETE', '/api/bookings/999999');
    assert(cancelGhostRes.status === 404, 'Rejects cancelling non-existent booking with 404 Not Found');

    // Once cancelled, the room should become available again for those dates (2026-12-10 to 2026-12-15)!
    const rebookCancelledRes = await request('POST', '/api/bookings', {
      room_id: createdRoomId,
      guest_name: 'Grace Rebook After Cancel',
      check_in_date: '2026-12-10',
      check_out_date: '2026-12-15'
    });
    assert(rebookCancelledRes.status === 201, 'Allows booking previously cancelled dates with 201 Created');

    // 8. Delete Room (DELETE /api/rooms/:id)
    console.log('\n--- 8. Delete Room & Foreign Key Protections ---');
    // Attempt to delete room that has active confirmed bookings (Frank BackToBack is in Dec 2026)
    const deleteRoomWithBookingRes = await request('DELETE', `/api/rooms/${createdRoomId}`);
    assert(deleteRoomWithBookingRes.status === 400, 'Prevents deleting room with upcoming confirmed bookings (400 Bad Request)');

    // 9. Stats endpoint (GET /api/stats)
    console.log('\n--- 9. Dashboard Statistics (GET /api/stats) ---');
    const statsRes = await request('GET', '/api/stats');
    assert(statsRes.status === 200, 'GET /api/stats returns 200 OK');
    assert(statsRes.data.stats.totalRooms >= 6, 'Stats reflect total rooms in database');
    assert(statsRes.data.stats.confirmedBookings >= 1, 'Stats reflect confirmed bookings');
    assert(statsRes.data.stats.totalRevenue > 0, 'Stats calculate revenue correctly');

  } catch (err) {
    console.error('Test Suite encountered fatal error:', err);
    failed++;
  } finally {
    console.log('\n========================================================');
    console.log(` TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('========================================================\n');

    // Clean up temporary test data from DB
    try {
      const db = require('./database');
      await db.runPromise("DELETE FROM bookings WHERE room_id IN (SELECT id FROM rooms WHERE room_number LIKE 'TEST-%')");
      await db.runPromise("DELETE FROM rooms WHERE room_number LIKE 'TEST-%'");
    } catch (e) {
      console.error('Failed to clean up test records:', e);
    }

    server.close(() => {
      process.exit(failed > 0 ? 1 : 0);
    });
  }
}

// Start temporary test server
server = app.listen(0, () => {
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  runTests();
});
