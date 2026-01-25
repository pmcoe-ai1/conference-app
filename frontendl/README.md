# Conference Survey Frontend

React frontend for the Conference Survey Application.

## Features

- **Attendee Interface**: QR code landing, email registration, survey completion
- **Admin Dashboard**: Conference management, survey builder, real-time statistics
- **Presenter Mode**: Full-screen statistics display for projectors
- **Real-time Updates**: WebSocket-powered live statistics

## Tech Stack

- React 18 with Vite
- React Router 6 for routing
- TailwindCSS for styling
- Recharts for charts
- Socket.io Client for real-time
- Axios for API calls

## Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

Create a `.env` file:

```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

## Project Structure

```
src/
├── components/
│   └── ui/           # Reusable UI components
├── context/
│   ├── AuthContext   # Authentication state
│   └── ToastContext  # Toast notifications
├── pages/
│   ├── admin/        # Admin dashboard pages
│   └── attendee/     # Attendee-facing pages
├── services/
│   ├── api.js        # API client
│   └── socket.js     # WebSocket service
├── App.jsx           # Main app with routing
└── main.jsx          # Entry point
```

## Pages

### Attendee
- `/c/:code` - Conference landing/login
- `/c/:code/survey` - Take active survey

### Admin
- `/admin/login` - Admin login
- `/admin` - Dashboard home
- `/admin/surveys` - Survey management
- `/admin/statistics` - Real-time analytics
- `/admin/attendees` - Attendee management
- `/admin/presenter` - Presenter mode

## Demo Credentials

- **Admin**: admin@pmcoe.com / admin123
- **Attendee**: john.smith@company.com / test1234
