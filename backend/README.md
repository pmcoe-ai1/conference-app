# Conference Survey Application

A full-stack web application for collecting attendee demographics and feedback through surveys at multi-day conferences (1-5 days). Supports 50-200 attendees with real-time statistics and Presenter Mode.

## Features

### Attendee Features
- **Frictionless Day 1 Access**: Scan QR code and enter only email to participate
- **Progressive Security**: Password automatically sent 24 hours after first login
- **Mobile-Optimized Surveys**: Complete surveys easily on any device
- **Multiple Question Types**: Rating, single/multi choice, numeric range, text

### Admin Features
- **Conference Management**: Create and manage conferences with unique QR codes
- **Survey Builder**: Create multiple surveys with drag-and-drop question ordering
- **Real-Time Statistics**: Live-updating charts as responses arrive
- **Presenter Mode**: Full-screen display for projecting results
- **Data Export**: CSV and PDF export for offline analysis
- **Attendee Tracking**: Monitor who has responded, identify non-responders

## Tech Stack

- **Frontend**: React.js 18+ with TailwindCSS
- **Backend**: Node.js 20 LTS, Express.js REST API
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Real-time**: Socket.io for WebSocket connections
- **Cache/Queue**: Redis with Bull for background jobs
- **Email**: AWS SES (with development fallback)

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis (optional, for background jobs)

### Installation

1. **Clone and install dependencies**
```bash
cd conference-app
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. **Setup database**
```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:push

# Seed sample data
npm run db:seed
```

4. **Start the server**
```bash
# Development
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3001`

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/attendee/first-login` | First-time email-only login |
| POST | `/api/auth/attendee/login` | Return login with password |
| POST | `/api/auth/attendee/forgot-password` | Request password reset |
| POST | `/api/auth/attendee/reset-password` | Reset password with token |
| POST | `/api/auth/admin/login` | Admin login |
| POST | `/api/auth/admin/register` | Admin registration |

### Conferences
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conferences` | List admin's conferences |
| POST | `/api/conferences` | Create conference |
| GET | `/api/conferences/:id` | Get conference details |
| PUT | `/api/conferences/:id` | Update conference |
| DELETE | `/api/conferences/:id` | Archive conference |
| GET | `/api/conferences/:id/qr-code/png` | Download QR as PNG |
| GET | `/api/conferences/:id/qr-code/svg` | Download QR as SVG |
| GET | `/api/conferences/by-code/:code` | Get conference by URL code (public) |

### Surveys
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/surveys/conference/:id` | List surveys for conference |
| GET | `/api/surveys/active` | Get active survey (attendee) |
| POST | `/api/surveys` | Create survey |
| GET | `/api/surveys/:id` | Get survey with questions |
| PUT | `/api/surveys/:id` | Update survey |
| PUT | `/api/surveys/:id/activate` | Activate survey |
| PUT | `/api/surveys/:id/deactivate` | Deactivate survey |

### Questions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/questions/survey/:id` | List questions for survey |
| POST | `/api/questions` | Create question |
| PUT | `/api/questions/:id` | Update question |
| PUT | `/api/questions/reorder` | Reorder questions |
| DELETE | `/api/questions/:id` | Delete question |

### Responses
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/responses/survey/:id` | Submit survey responses |
| GET | `/api/responses/survey/:id` | Get all responses (admin) |
| GET | `/api/responses/attendee/:id` | Get attendee responses |

### Statistics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/statistics/survey/:id` | Get survey statistics |
| GET | `/api/statistics/question/:id` | Get question statistics |
| GET | `/api/statistics/conference/:id/summary` | Conference summary |

### Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/export/survey/:id/csv` | Export responses as CSV |
| GET | `/api/export/survey/:id/pdf` | Export statistics as PDF |
| GET | `/api/export/conference/:id/attendees` | Export attendee list |

### Attendees
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attendees/conference/:id` | List attendees |
| GET | `/api/attendees/:id` | Get attendee details |
| PUT | `/api/attendees/:id/unlock` | Unlock locked account |
| GET | `/api/attendees/conference/:id/non-responders` | Get non-responders |

## WebSocket Events

### Client → Server
- `join_conference` - Join conference room for updates
- `leave_conference` - Leave conference room
- `request_stats` - Request current statistics

### Server → Client
- `new_response` - New survey response received
- `stats_update` - Statistics updated
- `survey_activated` - Survey was activated
- `survey_deactivated` - Survey was deactivated
- `attendee_joined` - New attendee registered

## Database Schema

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   admins    │────<│ conferences │────<│  attendees  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           │                   │
                    ┌──────┴──────┐     ┌──────┴──────┐
                    │   surveys   │     │  password   │
                    └─────────────┘     │   _queue    │
                           │            └─────────────┘
                           │
                    ┌──────┴──────┐
                    │  questions  │
                    └─────────────┘
                           │
                           │
                    ┌──────┴──────┐
                    │  responses  │
                    └─────────────┘
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | - | PostgreSQL connection string |
| REDIS_URL | - | Redis connection (optional) |
| JWT_SECRET | - | Secret for JWT signing |
| JWT_EXPIRY_HOURS | 24 | Token expiration |
| PORT | 3001 | Server port |
| FRONTEND_URL | - | Frontend URL for CORS |
| PASSWORD_DELAY_HOURS | 24 | Hours before password email |
| LOCKOUT_ATTEMPTS | 5 | Failed logins before lockout |
| LOCKOUT_DURATION_MINS | 30 | Lockout duration |

## Security

- **Authentication**: JWT tokens with 24-hour expiry
- **Passwords**: bcrypt hashing with cost factor 12
- **Account Lockout**: 5 failed attempts = 30-minute lock
- **Data Isolation**: Conference-level data separation
- **Transport**: HTTPS/TLS recommended for production

## License

Proprietary - PM Centre of Excellence
