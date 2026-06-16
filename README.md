# Senior Kiosk

> A senior-friendly kiosk ordering experience designed to make menu selection simpler, clearer, and less stressful.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react)
![Express](https://img.shields.io/badge/Express-Backend-111111?style=for-the-badge&logo=express)
![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-Voice%20%26%20AI-412991?style=for-the-badge&logo=openai&logoColor=white)

---

## Overview

**Senior Kiosk** is a voice-assisted kiosk web application built for older adults who may feel overwhelmed by conventional self-order systems.

The project focuses on:

- larger and clearer touch targets
- simpler step-by-step ordering flows
- voice guidance and voice-based order support
- quick recommendation flows that reduce decision fatigue

Instead of treating accessibility as an extra feature, this project places it at the center of the user experience.

---

## Project Snapshot

| Item | Detail |
|---|---|
| Project Type | Senior-friendly kiosk ordering web app |
| Core Goal | Reduce friction for older adults using digital kiosks |
| Frontend | Next.js 15, React 19 |
| Backend | Express |
| Database | MySQL |
| AI / Voice | OpenAI API, Web Speech API, TTS |

---

## Screenshots

Add your kiosk screenshots here.

### Main Screen

```md
![Main Screen](./docs/images/main-screen.png)
```

### Quick Recommendation Flow

```md
![Quick Recommendation](./docs/images/quick-recommendation.png)
```

### Menu Screen

```md
![Menu Screen](./docs/images/menu-screen.png)
```

### Order Flow / Voice Interaction

```md
![Voice Flow](./docs/images/voice-flow.png)
```

Tip:
- Create a `docs/images/` folder
- Drop your screenshots there
- Replace the example filenames above with your actual image files

---

## Why This Project

Many kiosk interfaces are designed for speed, but not for comfort.

For senior users, common problems include:

- too many choices on one screen
- small text and dense layouts
- unfamiliar digital flows
- difficulty understanding where to tap next
- anxiety when making mistakes in public

This project responds to those issues with a more guided and forgiving interface.

---

## Key Features

### 1. Voice-First Ordering Support
- voice-based menu exploration
- AI-assisted order interpretation
- spoken guidance during the ordering process

### 2. Senior-Friendly UI Design
- large buttons and touch-friendly layout
- simplified screen hierarchy
- reduced visual clutter

### 3. Quick Menu Recommendation
- fast-entry recommendation flow from the main screen
- simple dine-in / takeout selection before recommendation
- 2x2 burger recommendation cards for easier comparison

### 4. QR Entry Support
- kiosk mode for in-store use
- QR-based mobile entry flow

### 5. Full Order Flow Structure
- menu browsing
- option selection
- cart handling
- phone / points step
- payment-ready flow

---

## User Flow

```text
Home
 -> Dine-in / Takeout
 -> Quick Recommendation or Full Menu
 -> Menu Option Selection
 -> Phone / Points
 -> Payment
```

---

## Tech Stack

| Area | Stack |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS 4 |
| Backend | Node.js, Express |
| Database | MySQL, mysql2/promise |
| Voice | Web Speech API, OpenAI TTS |
| AI | OpenAI API |
| Tooling | npm, concurrently, ESLint |

---

## Architecture

```text
Next.js UI
   -> API Proxy (/api/voice-order)
Express Server
   -> OpenAI (order interpretation / TTS)
   -> MySQL (menu / cart / order-related data)
```

---

## Folder Structure

```text
src/
  app/
    (home)/         # main entry screen
    menu/           # menu list / quick recommendation / voice order
    menu-option/    # option selection
    points/         # phone number / points flow
    payment/        # payment screen
    qr-order/       # QR entry flow
  components/       # shared UI components

server/
  routes/           # Express routes
  db/               # schema and seed SQL

public/             # static assets
```

---

## API Overview

Base Express port: `3001`

- `POST /api/voice-order`
  voice/text-based order interpretation
- `GET /api/menu`
  fetch menu list
- `POST /api/cart`
  store cart state
- `GET /api/cart/:sessionId`
  fetch cart state
- `POST /api/tts`
  generate speech output
- `GET /health`
  health check

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Environment File

Create `.env.local` or `.env` in the project root.

```env
EXPRESS_PORT=3001
EXPRESS_API_URL=http://localhost:3001

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=senior_kiosk

OPENAI_API_KEY=sk-...
OPENAI_TTS_VOICE=nova
OPENAI_TTS_SPEED=0.95
```

### 3. Set Up Database

```bash
mysql -u root -p
```

```sql
CREATE DATABASE senior_kiosk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Apply schema and menu seed data:

```bash
mysql -u root -p senior_kiosk < server/db/schema.sql
mysql -u root -p senior_kiosk < server/db/add_drinks_sides_menu.sql
```

### 4. Run the Project

Run frontend and backend together:

```bash
npm run dev:all
```

Or run them separately:

```bash
npm run dev
npm run server
```

---

## Local Access

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:3001](http://localhost:3001)
- Health Check: [http://localhost:3001/health](http://localhost:3001/health)

For tablet testing on the same Wi-Fi, use your PC's local IP:

```text
http://192.168.0.28:3000
```

---

## Portfolio Highlights

This project is useful in a portfolio because it shows:

- accessibility-driven UX thinking
- full-stack integration across frontend, backend, DB, and AI APIs
- real-world kiosk scenario design
- recommendation and voice interaction in a service flow
- practical problem-solving for a specific user group

---

## Future Improvements

- real user testing with older adults
- refined recommendation logic
- stronger payment integration
- personalized order history features
- admin dashboard for menu and order management

---

## Related Docs

- [README_SETUP.md](./README_SETUP.md)
- [DEVELOPMENT.md](./DEVELOPMENT.md)
- [TTS_SETUP.md](./TTS_SETUP.md)

---

## License

This project was created for learning and portfolio purposes.
