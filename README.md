# MeChat - Real-time Chat Application

A full-stack real-time chat application built with React, Node.js, Express, and Socket.io.

## Features

- Real-time messaging
- User authentication
- One-on-one and group chats
- Typing indicators
- Message notifications
- Responsive design

## Tech Stack

- Frontend: React.js, Tailwind CSS
- Backend: Node.js, Express
- Database: MongoDB
- Real-time: Socket.io
- Authentication: JWT

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Git

### Installation

1. Clone the repository:

```bash
git clone https://github.com/DivyeGandhi/MeChat.git
cd MeChat
```

2. Install backend dependencies:

```bash
cd backend
npm install
```

3. Install frontend dependencies:

```bash
cd ../frontend
npm install
```

4. Create environment variables:

   - Backend (.env):
     ```
     PORT=5000
     MONGODB_URI=your_mongodb_uri
     JWT_SECRET=your_jwt_secret
     ```
   - Frontend (.env):
     ```
     REACT_APP_API_URL=http://localhost:5000
     ```

5. Start the development servers:
   - Backend:
     ```bash
     cd backend
     npm start
     ```
   - Frontend:
     ```bash
     cd frontend
     npm start
     ```

## Deployment

This application is configured for deployment on Render. The `render.yaml` file contains the necessary configuration for both frontend and backend services.

### Environment Variables for Production

- Backend:

  - `NODE_ENV`: production
  - `PORT`: 5000
  - `JWT_SECRET`: your_secret_key
  - `MONGODB_URI`: your_mongodb_uri

- Frontend:
  - `REACT_APP_API_URL`: https://mechat-backend.onrender.com

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
