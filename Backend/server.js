const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const userRoutes = require('./Routes/userRoutes');
const chatRoutes = require('./Routes/chatRoutes');
const messageRoutes = require('./Routes/messageRoutes');
const { notFound, errorHandler } = require('./Middleware/errorMiddleware');
const cors = require('cors');

dotenv.config();
connectDB();

const app = express();

// CORS configuration
const allowedOrigins = [
    'http://localhost:3000',
    'https://mechat-frontend.onrender.com'
];

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

app.use(express.json()); // to accept json data

app.get('/', (req, res) => {
    res.send("API is Running Successfully");
});

app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/message', messageRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, console.log(`Server Started on PORT ${PORT}`));

const io = require('socket.io')(server, {
    pingTimeout: 60000,
    pingInterval: 30000,
    cors: {
        origin: "http://localhost:3000",
        credentials: true
    }
});

io.on("connection", (socket) => {
    console.log("Connected to socket.io");

    socket.on("setup", (userData) => {
        if (!userData?._id) {
            console.log("Invalid user data for setup");
            return;
        }
        socket.join(userData._id);
        console.log("User Joined Personal Room:", userData._id);
        socket.emit("connected");
    });

    socket.on("join chat", (room) => {
        if (!room) {
            console.log("No room provided for join chat");
            return;
        }
        socket.join(room);
        console.log("User Joined Chat Room:", room);
    });

    socket.on("typing", (room) => {
        if (!room) return;
        console.log("Typing in room:", room);
        socket.in(room).emit("typing");
    });

    socket.on("stop typing", (room) => {
        if (!room) return;
        console.log("Stopped typing in room:", room);
        socket.in(room).emit("stop typing");
    });

    socket.on("new message", (newMessageReceived) => {
        console.log("New message received:", newMessageReceived._id);
        
        var chat = newMessageReceived.chat;
        if (!chat?.users) {
            console.log("Chat users not defined");
            return;
        }

        chat.users.forEach((user) => {
            if (user._id === newMessageReceived.sender._id) {
                console.log("Skipping sender:", user._id);
                return;
            }

            console.log("Sending message to user:", user._id);
            // Emit to user's personal room
            socket.in(user._id).emit("message received", newMessageReceived);
        });

        // Also emit to the chat room
        console.log("Broadcasting to chat room:", chat._id);
        socket.in(chat._id).emit("message received", newMessageReceived);
    });

    socket.on("leave chat", (room) => {
        if (!room) {
            console.log("No room provided for leave chat");
            return;
        }
        socket.leave(room);
        console.log("User Left Chat Room:", room);
    });

    socket.on("disconnect", () => {
        console.log("User Disconnected:", socket.id);
    });
});

// Handle server termination
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});