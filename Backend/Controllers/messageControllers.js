const asyncHandler = require('express-async-handler');
const Message = require('../Models/messageModel');
const User = require('../Models/userModel');
const Chat = require('../Models/chatModel');

const sendMessage = asyncHandler(async (req, res) => {
    const { content, chatId } = req.body;

    if (!content || !chatId) {
        console.log("Invalid data passed into request");
        return res.sendStatus(400);
    }

    var newMessage = {
        sender: req.user._id,
        content: content,
        chat: chatId,
    };

    try { 
        var message = await Message.create(newMessage);
        message = await message.populate("sender", "name");
        message = await message.populate("chat");
        message = await User.populate(message, {
            path: "chat.users",
            select: "name email",
        });

        await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

        res.json(message);
    } catch (error) {
        res.status(400);
        throw new Error(error.message);
    }
});

const allMessages = asyncHandler(async (req, res) => { 
    // console.log("allMessages", req.params.chatId);
    try {
        const messages = await Message.find({ chat: req.params.chatId })
            .populate("sender", "name email")
            .populate({
                path: "chat",
                populate: {
                    path: "users",
                    select: "name email"
                }
            })
            .sort({ createdAt: 1 }); // Sort messages by creation time

        if (!messages) {
            return res.status(404).json({ message: "No messages found" });
        }
        // console.log("messages", messages);
        res.json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(400).json({ message: error.message });
    }
});

module.exports = { sendMessage, allMessages };
