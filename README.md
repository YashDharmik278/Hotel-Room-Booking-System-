# Hotel Room Booking System (Aim 1)

A full-stack Hotel Room Booking System web application built with **HTML, CSS, JavaScript (Vanilla ES6+)** on the client side, **Node.js with Express.js** as the backend REST server, and **SQLite** for relational database persistence.

---

## 🎯 Aim & Objectives

### Aim
To design and develop a Hotel Room Booking System web application that enables users to add, search, book, and cancel room records, using HTML, CSS, and JavaScript on the client side, Node.js with Express.js as the backend server for handling requests and business logic, and SQLite as the database for persistent storage of room and booking information — demonstrating the practical implementation of full-stack web development and CRUD operations.

### Key Objectives Achieved
1. **Frontend Interface**: Interactive single-page application (SPA) displaying Room details (Room No, Type, Price, Capacity, Availability Status) and Booking records (Guest Name, Contact, Check-in/Check-out dates, Total Price, Status).
2. **RESTful API**: Clean Express.js routing handling:
   - `GET /api/rooms` — List all rooms with real-time occupancy.
   - `POST /api/rooms` — Add a new room record with validation and unique constraint check.
   - `PUT /api/rooms/:id` — Update room pricing, capacity, and maintenance status.
   - `DELETE /api/rooms/:id` — Delete room (protected against active bookings).
   - `GET /api/rooms/search` — Search rooms available for a specified date range and room type.
   - `GET /api/bookings` — View all bookings with guest and room info.
   - `POST /api/bookings` — Book a room with mathematical date overlap validation.
   - `DELETE /api/bookings/:id` — Cancel an active booking or permanently delete it.
   - `GET /api/stats` — Dashboard statistics (total rooms, available rooms, confirmed bookings, total revenue).
3. **Database Schema**: Relational schema in SQLite (`hotel.db`) with foreign key constraints and `ON DELETE CASCADE` between `rooms` and `bookings`.
4. **Double-Booking & Date Overlap Prevention**: Implements standard interval intersection logic `(check_in_date < Requested_Check_Out AND check_out_date > Requested_Check_In)` ensuring no room is double-booked. Back-to-back bookings (same-day turnaround) are supported.
5. **Asynchronous Communication (AJAX/Fetch)**: Dynamic UI state updates without full-page reloads, featuring real-time price calculation, filter bars, and modal forms.
6. **Edge Case Validation & Test Suite**: Automated test suite with 33 comprehensive tests covering double-booking conflicts (409), checkout <= checkin (400), duplicate room numbers (409), cancelling non-existent bookings (404), and live in-browser HTTP inspector.

---

## 🗄️ Database Schema (SQLite)

### 1. `rooms` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique Room ID |
| `room_number` | TEXT | UNIQUE, NOT NULL | Room number (e.g., 101, 202) |
| `room_type` | TEXT | NOT NULL | Single, Double, Deluxe, Suite, etc. |
| `price_per_night` | REAL | NOT NULL | Rate per night in ₹ |
| `capacity` | INTEGER | NOT NULL DEFAULT 2 | Max number of guests |
| `status` | TEXT | NOT NULL DEFAULT 'Available' | 'Available' or 'Maintenance' |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp |

### 2. `bookings` Table
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique Booking ID |
| `room_id` | INTEGER | NOT NULL, FOREIGN KEY | References `rooms(id)` |
| `guest_name` | TEXT | NOT NULL | Full name of the guest |
| `guest_email` | TEXT | NULLABLE | Email address |
| `guest_phone` | TEXT | NULLABLE | Contact telephone |
| `check_in_date` | DATE | NOT NULL | Format: YYYY-MM-DD |
| `check_out_date` | DATE | NOT NULL | Format: YYYY-MM-DD |
| `total_price` | REAL | NOT NULL | Nights * Room Price |
| `booking_status` | TEXT | NOT NULL DEFAULT 'Confirmed' | 'Confirmed' or 'Cancelled' |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18.x, v20.x, or v22.x)
- npm

### Installation & Starting Server
1. Clone or navigate to the project directory:
   ```bash
   cd c:\Users\yashd\MDM_TA
   ```
2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm start
   ```
4. Open your web browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 🧪 Running the Automated Test Suite

Run the full end-to-end API test suite:
```bash
npm test
```
This runs `node test-suite.js` which verifies all 33 test scenarios and edge cases including:
- Room creation, listing, updating, and deletion
- Duplicate room detection (HTTP 409)
- Overlapping double-booking prevention (HTTP 409)
- Checkout <= Checkin rejection (HTTP 400)
- Cancelling non-existent booking (HTTP 404)
- Back-to-back turnarounds
- Re-booking previously cancelled date ranges

---

## 💻 Tech Stack
- **Frontend**: HTML5, CSS3 (Modern Flexbox & CSS Grid, Custom Properties), Vanilla JavaScript (ES6+, Fetch API, Async/Await), Font Awesome 6
- **Backend**: Node.js, Express.js 5.x, CORS
- **Database**: SQLite 3 with Promise wrappers and foreign key enforcement

