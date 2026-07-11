const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

// Fail fast on missing config rather than silently falling back to a
// hardcoded secret at the point of use (a real security risk for JWTs).
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variable(s): ${missingEnvVars.join(', ')}. Check your .env file.`);
  process.exit(1);
}

const connectDB = require('./config/db');
const errorHandler = require('./middlewares/error.middleware');
const AppError = require('./utils/appError');
const socketService = require('./services/socket.service');

const authRoutes = require('./routes/auth.routes');
const doctorRoutes = require('./routes/doctor.routes');
const slotRoutes = require('./routes/slot.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const departmentRoutes = require('./routes/department.routes');

connectDB();

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// FRONTEND_URL may hold a comma-separated list (e.g. production + a stable
// git-branch alias). Vercel also mints a unique preview URL per deployment
// (adam-care-<hash>-<team>.vercel.app), which can't be enumerated in advance,
// so those are matched by pattern instead.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const vercelPreviewPattern = /^https:\/\/adam-care(-[a-z0-9-]+)?\.vercel\.app$/;

function isOriginAllowed(origin) {
  if (!origin) return true; // non-browser requests (curl, server-to-server) send no Origin header
  return allowedOrigins.includes(origin) || vercelPreviewPattern.test(origin);
}

const corsOriginHandler = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    callback(null, true);
  } else {
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  }
};

app.use(cors({
  origin: corsOriginHandler,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/slots', slotRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/departments', departmentRoutes);

// Catch-all for unhandled routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// WebSocket setup
const io = socketio(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ['GET', 'POST']
  }
});
socketService.init(io);

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});
