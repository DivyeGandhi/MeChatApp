import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import PropTypes from 'prop-types';
import { ChatState } from '../context/ChatProvider';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { connectSocket, getSocket, joinChat, leaveChat } from '../config/socket';

const ChatBox = ({ fetchAgain, setFetchAgain, notification, setNotification }) => {
    const { theme } = useTheme();
    const [message, setMessage] = useState('');
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const { user, selectedChat, setSelectedChat, updateChat } = ChatState();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newMessage, setNewMessage] = useState("");
    const [socketConnected, setSocketConnected] = useState(false);
    const [typing, setTyping] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
    const [retryCount, setRetryCount] = useState(0);
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds
    const typingTimeout = useRef(null);
    const socket = useRef();

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        }
    };

    // Only scroll to bottom when new messages arrive
    useEffect(() => {
        if (messages.length > 0) {
            scrollToBottom();
        }
    }, [messages.length]);

    // Update groupName when selectedChat changes
    useEffect(() => {
        if (selectedChat?.isGroupChat) {
            setGroupName(selectedChat.chatName);
        }
    }, [selectedChat]);

    // Update the socket connection effect
    useEffect(() => {
        let mounted = true;
        let socketCleanup = null;

        const initializeSocket = async () => {
            try {
                const socket = await connectSocket(user);
                if (!mounted || !socket) return;

                const handleConnect = () => {
                    console.log('Socket connected successfully');
                    setSocketConnected(true);
                };

                const handleDisconnect = () => {
                    console.log('Socket disconnected');
                    setSocketConnected(false);
                };

                socket.on('connect', handleConnect);
                socket.on('disconnect', handleDisconnect);
                socket.on('reconnect', handleConnect);

                socketCleanup = () => {
                    socket.off('connect', handleConnect);
                    socket.off('disconnect', handleDisconnect);
                    socket.off('reconnect', handleConnect);
                };
            } catch (error) {
                console.warn('Error initializing socket, proceeding anyway:', error);
            }
        };

        initializeSocket();

        return () => {
            mounted = false;
            if (socketCleanup) {
                socketCleanup();
            }
        };
    }, [user]);

    // Handle chat room joining and leaving
    useEffect(() => {
        const socket = getSocket();
        if (socket && socketConnected && selectedChat) {
            console.log('Joining chat room:', selectedChat._id);
            joinChat(selectedChat._id);
        }

        return () => {
            if (socket && socketConnected && selectedChat) {
                console.log('Leaving chat room:', selectedChat._id);
                leaveChat(selectedChat._id);
            }
        };
    }, [selectedChat, socketConnected]);

    // Handle typing events
    useEffect(() => {
        if (!socket.current || !selectedChat) return;

        const handleTyping = (data) => {
            if (data.chatId === selectedChat._id && data.userId !== user._id) {
                setIsTyping(true);
                // Clear any existing timeout
                if (typingTimeout.current) {
                    clearTimeout(typingTimeout.current);
                }
                // Set a new timeout to hide the typing indicator after 3 seconds
                const timeout = setTimeout(() => {
                    setIsTyping(false);
                }, 3000);
                typingTimeout.current = timeout;
            }
        };

        const handleStopTyping = (data) => {
            if (data.chatId === selectedChat._id && data.userId !== user._id) {
                setIsTyping(false);
                if (typingTimeout.current) {
                    clearTimeout(typingTimeout.current);
                }
            }
        };

        socket.current.on('typing', handleTyping);
        socket.current.on('stop typing', handleStopTyping);

        return () => {
            socket.current.off('typing', handleTyping);
            socket.current.off('stop typing', handleStopTyping);
        };
    }, [selectedChat, user._id]);

    // Handle typing input
    const handleTyping = () => {
        if (!socket.current || !selectedChat) return;

        if (!typing) {
            setTyping(true);
            socket.current.emit('typing', { 
                chatId: selectedChat._id,
                userId: user._id
            });
        }

        // Clear any existing timeout
        if (typingTimeout.current) {
            clearTimeout(typingTimeout.current);
        }

        // Set a new timeout to emit stop typing after 3 seconds
        const timeout = setTimeout(() => {
            setTyping(false);
            socket.current.emit('stop typing', { 
                chatId: selectedChat._id,
                userId: user._id
            });
        }, 3000);
        typingTimeout.current = timeout;
    };

    // Update the message handling effect
    useEffect(() => {
        let mounted = true;
        let socketCleanup = null;
        let joinTimeout = null;

        const initializeMessageHandlers = async () => {
            try {
                const socket = await getSocket();
                if (!mounted || !socket) return;

                // Remove any existing message listeners to prevent duplicates
                socket.off('message received');

                const messageHandler = (newMessageReceived) => {
                    if (!mounted) return;
                    
                    // Check if message already exists in messages array
                    const messageExists = messages.some(msg => msg._id === newMessageReceived._id);
                    if (messageExists) return;
                    
                    // Update the chat with the new message
                    const updatedChat = {
                        ...newMessageReceived.chat,
                        latestMessage: {
                            ...newMessageReceived,
                            createdAt: new Date().toISOString()
                        }
                    };
                    
                    // Update the chat list to move this chat to the top
                    updateChat(updatedChat);
                    
                    if (!selectedChat || selectedChat._id !== newMessageReceived.chat._id) {
                        if (typeof setNotification === 'function') {
                            setNotification(prev => {
                                if (!prev) return [newMessageReceived];
                                if (prev.some(msg => msg._id === newMessageReceived._id)) return prev;
                                return [newMessageReceived, ...prev];
                            });
                        }
                    } else {
                        setMessages(prev => {
                            // Check again to prevent duplicates
                            if (prev.some(msg => msg._id === newMessageReceived._id)) return prev;
                            return [...prev, newMessageReceived];
                        });
                    }
                };

                // Join the chat room
                if (selectedChat) {
                    try {
                        joinTimeout = setTimeout(() => {
                            console.warn('Join chat timeout, proceeding anyway');
                        }, 5000);

                        await joinChat(selectedChat._id);
                        clearTimeout(joinTimeout);
                    } catch (error) {
                        console.warn('Error joining chat, proceeding anyway:', error);
                    }
                }

                // Add event listeners
                socket.on('message received', messageHandler);

                socketCleanup = () => {
                    if (selectedChat) {
                        leaveChat(selectedChat._id).catch(error => {
                            console.warn('Error leaving chat, proceeding anyway:', error);
                        });
                    }
                    socket.off('message received', messageHandler);
                };
            } catch (error) {
                console.warn('Error setting up message handlers, proceeding anyway:', error);
            }
        };

        initializeMessageHandlers();

        return () => {
            mounted = false;
            if (joinTimeout) {
                clearTimeout(joinTimeout);
            }
            if (socketCleanup) {
                socketCleanup();
            }
        };
    }, [selectedChat, setNotification, messages]);

    const fetchMessages = async () => {
        if (!selectedChat) return;

        try {
            setLoading(true);
            const config = {
                headers: {
                    Authorization: `Bearer ${user.token}`,
                },
            };

            const { data } = await axios.get(
                `/api/message/${selectedChat._id}`,
                config
            );

            setMessages(data);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching messages:", error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, [selectedChat]);

    const sendMessage = useCallback(async (messageContent) => {
        if (!messageContent.trim() || !selectedChat) return;

        const sendMessageWithRetry = async (content, retries = 0) => {
            try {
                // First get the socket connection
                const socket = await getSocket();
                if (!socket || !socket.connected) {
                    throw new Error('Not connected to chat server');
                }

                const config = {
                    headers: {
                        "Content-type": "application/json",
                        Authorization: `Bearer ${user.token}`,
                    },
                };

                // Send the message to the server
                const { data } = await axios.post(
                    "/api/message",
                    {
                        content: content.trim(),
                        chatId: selectedChat._id,
                    },
                    config
                );

                // Emit the message through socket
                socket.emit('new message', data);
                
                // Update local state
                setMessages(prev => [...prev, data]);
                
                // Clear typing indicator
                socket.emit('stop typing', selectedChat._id);
                setTyping(false);
                
                // Reset retry count on success
                setRetryCount(0);
                return true;
            } catch (error) {
                console.error("Error sending message:", error);
                
                if (retries < MAX_RETRIES) {
                    // Show retry notification
                    toast.warning(`Message not sent. Retrying... (${retries + 1}/${MAX_RETRIES})`);
                    
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    
                    // Retry sending the message
                    return sendMessageWithRetry(content, retries + 1);
                } else {
                    // Max retries reached, show error
                    toast.error("Failed to send message after multiple attempts. Please try again.");
                    setRetryCount(0);
                    return false;
                }
            }
        };

        // Start the sending process
        const success = await sendMessageWithRetry(messageContent);
        
        if (!success) {
            // If message failed to send, keep it in the input field
            setMessage(messageContent);
        }
    }, [selectedChat, user?.token]);

    // Update the handleSendMessage function
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;

        const currentMessage = message; // Store the current message before clearing
        setMessage(""); // Clear input immediately

        try {
            const socket = await getSocket();
            if (socket && socket.connected && selectedChat) {
                socket.emit('stop typing', selectedChat._id);
            }

            await sendMessage(currentMessage);
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Failed to send message');
            // Keep the message in the input field if sending fails
            setMessage(currentMessage);
        }
    };

    const handleRenameGroup = async () => {
        if (!groupName.trim()) {
            toast.error('Please enter a group name');
            return;
        }

        try {
            setIsRenaming(true);
            const config = {
                headers: {
                    Authorization: `Bearer ${user.token}`,
                },
            };

            const { data } = await axios.put(
                '/api/chat/rename',
                {
                    chatId: selectedChat._id,
                    chatName: groupName
                },
                config
            );

            if (data) {
                // Update both the context and local state
                updateChat(data);
                setSelectedChat(data);
                setShowGroupInfo(false);
                toast.success('Group renamed successfully');
            }
        } catch (error) {
            console.error('Error renaming group:', error);
            if (error.response && error.response.data) {
                toast.error(error.response.data.message || 'Error renaming group');
            } else {
                toast.error('An error occurred while renaming the group');
                setShowGroupInfo(false);
            }
        } finally {
            setIsRenaming(false);
        }
    };

    const handleAvatarClick = (user) => {
        setSelectedUser(user);
        setShowProfileModal(true);
    };

    // In mobile view, don't show anything when no chat is selected
    if (!selectedChat) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-3xl pb-3 font-work-sans">
                    Click on a user to start chatting
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-800">
            {selectedChat ? (
                <>
                    <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
                        {/* Back Button - Only visible on mobile */}
                        <button 
                            onClick={() => setSelectedChat(null)}
                            className="md:hidden mr-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <svg 
                                className="w-6 h-6 text-gray-600 dark:text-gray-300" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                                    d="M15 19l-7-7 7-7" 
                        />
                    </svg>
                        </button>

            {/* Chat Header */}
                        <div className="flex items-center flex-1">
                            <div 
                                className="avatar mr-3 cursor-pointer"
                                data-letter={selectedChat.isGroupChat 
                                    ? selectedChat.chatName.charAt(0).toUpperCase() 
                                    : selectedChat.users.find(u => u._id !== user._id)?.name.charAt(0).toUpperCase()}
                                data-group={selectedChat.isGroupChat}
                                onClick={(e) => {
                                    if (selectedChat.isGroupChat) {
                                        setShowGroupInfo(true);
                                    } else {
                                        handleAvatarClick(selectedChat.users.find(u => u._id !== user._id));
                                    }
                                }}
                            >
                                <span>
                            {selectedChat.isGroupChat 
                                        ? selectedChat.chatName.charAt(0).toUpperCase()
                                        : selectedChat.users.find(
                                            (u) => u._id !== user._id
                                        )?.name.charAt(0).toUpperCase()}
                        </span>
                </div>
                <div>
                                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                        {selectedChat.isGroupChat 
                            ? selectedChat.chatName
                                        : selectedChat.users.find(
                                            (u) => u._id !== user._id
                                        )?.name}
                    </h2>
                    {selectedChat.isGroupChat && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {selectedChat.users.length} members
                        </p>
                    )}
                </div>
                </div>
            </div>

                    {/* Messages Container */}
                    <div 
                        ref={messagesContainerRef}
                        className="flex-1 overflow-y-auto p-4 space-y-4"
                    >
                        {loading ? (
                            <div className="flex justify-center items-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            </div>
                        ) : (
                            <>
                                {messages.map((message) => (
                                    <div
                                        key={message._id}
                                        className={`flex ${message.sender._id === user._id ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[70%] rounded-lg p-3 ${
                                                message.sender._id === user._id
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                                            }`}
                                        >
                                            <p>{message.content}</p>
                                            <span className="text-xs opacity-70 mt-1 block">
                                                {new Date(message.createdAt).toLocaleTimeString([], {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {isTyping && (
                                    <div className="flex justify-start">
                                        <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-3">
                                            <div className="typing-bubble">
                                                <div className="typing-dot" style={{ animationDelay: '0ms' }}></div>
                                                <div className="typing-dot" style={{ animationDelay: '150ms' }}></div>
                                                <div className="typing-dot" style={{ animationDelay: '300ms' }}></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </>
                        )}
                    </div>

                    {/* Message Input */}
                    <form onSubmit={handleSendMessage} className="flex items-center p-4 border-t border-gray-200 dark:border-gray-700">
                    <input
                        type="text"
                        value={message}
                            onChange={(e) => {
                                setMessage(e.target.value);
                                handleTyping();
                            }}
                        placeholder="Type a message..."
                            className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
                    />
                    <button
                        type="submit"
                        disabled={!message.trim()}
                            className={`ml-2 p-2 rounded-lg ${
                            message.trim()
                                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </form>
                </>
            ) : (
                <div className="flex items-center justify-center h-full">
                    <p className="text-3xl pb-3 font-work-sans">
                        Click on a user to start chatting
                    </p>
                </div>
            )}

            {/* Group Info Modal */}
            {showGroupInfo && selectedChat.isGroupChat && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md border-2 border-white">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Group Info</h2>
                            <button
                                onClick={() => setShowGroupInfo(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Group Name Section */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Group Name
                            </label>
                            <div className="flex space-x-2">
                                <input
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    placeholder={selectedChat.chatName}
                                    className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                                />
                                <button
                                    onClick={handleRenameGroup}
                                    disabled={isRenaming}
                                    className={`px-4 py-2 rounded-lg ${
                                        isRenaming
                                            ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                                    }`}
                                >
                                    {isRenaming ? (
                                        <div className="flex items-center">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                            Renaming...
                                        </div>
                                    ) : (
                                        'Rename'
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Members List */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Members
                            </h3>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {selectedChat.users.map((user) => (
                                    <div
                                        key={user._id}
                                        className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-[#1a1a1a]"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                                <span className="text-sm font-semibold text-blue-600 dark:text-blue-300">
                                                    {user.name.charAt(0)}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {user.name}
                                                </p>
                                                <p className="text-xs text-gray-700 dark:text-gray-200">
                                                    {user.email}
                                                </p>
                                            </div>
                                        </div>
                                        {selectedChat.groupAdmin._id === user._id && (
                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Admin</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Modal */}
            {showProfileModal && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 relative">
                        <button
                            onClick={() => setShowProfileModal(false)}
                            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        
                        <div className="flex flex-col items-center space-y-4">
                            <div 
                                className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white uppercase"
                                data-letter={selectedUser.name[0]}
                                style={{
                                    background: 'var(--avatar-gradient)',
                                }}
                            >
                                {selectedUser.name[0]}
                            </div>
                            
                            <div className="text-center">
                                <h3 className="text-xl font-semibold mb-2 dark:text-white">
                                    {selectedUser.name}
                                </h3>
                                <p className="text-gray-600 dark:text-gray-300">
                                    {selectedUser.email}
                                </p>
                            </div>
                        </div>
                    </div>
            </div>
            )}
        </div>
    );
};

ChatBox.propTypes = {
    fetchAgain: PropTypes.bool.isRequired,
    setFetchAgain: PropTypes.func.isRequired,
    notification: PropTypes.array,
    setNotification: PropTypes.func
};

ChatBox.defaultProps = {
    notification: [],
    setNotification: () => {}
};

export default ChatBox; 