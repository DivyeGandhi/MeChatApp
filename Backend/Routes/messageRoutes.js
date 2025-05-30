const express = require('express');
const { protect } = require('../Middleware/authMiddleware');
const { sendMessage, allMessages } = require('../Controllers/messageControllers');

const router = express.Router();

// Define message routes here
router.route('/').post(protect, sendMessage);
router.route('/:chatId').get(protect, allMessages);

module.exports = router;
