import { createContext, useContext, useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";

const ChatContext = createContext();

const ChatProvider = ({children}) => {
    const [user, setUser] = useState(() => {
        const userInfo = localStorage.getItem("userInfo");
        if (userInfo) {
            try {
                return JSON.parse(userInfo);
            } catch (error) {
                localStorage.removeItem("userInfo");
                return null;
            }
        }
        return null;
    });
    const [selectedChat, setSelectedChat] = useState(null);
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(false);
    const [unreadMessages, setUnreadMessages] = useState({});
    const history = useHistory();

    const fetchChats = async () => {
        if (!user?.token) return;
        
        try {
            setLoading(true);
            const config = {
                headers: {
                    Authorization: `Bearer ${user.token}`,
                },
            };
            const { data } = await axios.get('/api/chat', config);
            setChats(data || []);
        } catch (error) {
            console.error('Error fetching chats:', error);
            setChats([]);
        } finally {
            setLoading(false);
        }
    };

    const markMessageAsRead = (chatId) => {
        setUnreadMessages(prev => {
            const newUnread = { ...prev };
            delete newUnread[chatId];
            return newUnread;
        });
    };

    const updateChat = (updatedChat) => {
        setChats(prevChats => {
            // Remove the chat from its current position
            const filteredChats = prevChats.filter(chat => chat._id !== updatedChat._id);
            
            // If this is a new message from another user and the chat is not selected
            if (updatedChat.latestMessage?.sender?._id !== user._id && 
                selectedChat?._id !== updatedChat._id) {
                setUnreadMessages(prev => ({
                    ...prev,
                    [updatedChat._id]: true
                }));
            }
            
            // Add the updated chat at the beginning of the array
            return [updatedChat, ...filteredChats];
        });
        
        if (selectedChat?._id === updatedChat._id) {
            setSelectedChat(updatedChat);
            markMessageAsRead(updatedChat._id);
        }
    };

    // Handle user changes
    useEffect(() => {
        if (user) {
            if (window.location.pathname === '/') {
                history.push("/chats");
            }
        } else {
            setChats([]);
            setSelectedChat(null);
            setUnreadMessages({});
            if (window.location.pathname !== '/') {
                history.push("/");
            }
        }
    }, [user, history]);

    // Separate useEffect for fetching chats
    useEffect(() => {
        if (user) {
            fetchChats();
        }
    }, [user]);

    return (
        <ChatContext.Provider 
            value={{
                user, 
                setUser,
                selectedChat,
                setSelectedChat,
                chats,
                setChats,
                loading,
                updateChat,
                fetchChats,
                unreadMessages,
                markMessageAsRead
            }}
        >
            {children}
        </ChatContext.Provider>
    );
};

export const ChatState = () => useContext(ChatContext);

export default ChatProvider;
