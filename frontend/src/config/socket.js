import io from 'socket.io-client';

let socket = null;
let connectionPromise = null;

export const connectSocket = async (user) => {
    if (!user) {
        console.error('No user provided for socket connection');
        return null;
    }

    // If we already have a connection promise, return it
    if (connectionPromise) {
        return connectionPromise;
    }

    // Create a new connection promise
    connectionPromise = new Promise((resolve, reject) => {
        try {
            if (socket && socket.connected) {
                console.log('Using existing socket connection');
                resolve(socket);
                return;
            }

            // Disconnect existing socket if any
            if (socket) {
                socket.disconnect();
                socket = null;
            }

            console.log('Creating new socket connection');
            socket = io('http://localhost:7000', {
                query: {
                    userId: user._id,
                },
                transports: ['websocket'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: 5,
                timeout: 20000,
                forceNew: true,
                autoConnect: true
            });

            // Connection success handler
            const connectHandler = () => {
                console.log('Socket connected successfully');
                socket.emit('setup', user);
                resolve(socket);
            };

            // Connection error handler
            const connectErrorHandler = (error) => {
                console.error('Socket connection error:', error);
                reject(error);
            };

            // Disconnect handler
            const disconnectHandler = (reason) => {
                console.log('Socket disconnected:', reason);
                if (reason === 'io server disconnect' || reason === 'transport close') {
                    // Server initiated disconnect, try to reconnect
                    setTimeout(() => {
                        if (!socket.connected) {
                            socket.connect();
                        }
                    }, 1000);
                }
            };

            // Reconnection handlers
            const reconnectHandler = (attemptNumber) => {
                console.log('Socket reconnected after', attemptNumber, 'attempts');
                socket.emit('setup', user);
            };

            const reconnectErrorHandler = (error) => {
                console.error('Socket reconnection error:', error);
            };

            const reconnectFailedHandler = () => {
                console.error('Socket reconnection failed');
                reject(new Error('Socket reconnection failed'));
            };

            // Set up event listeners
            socket.on('connect', connectHandler);
            socket.on('connect_error', connectErrorHandler);
            socket.on('disconnect', disconnectHandler);
            socket.on('reconnect', reconnectHandler);
            socket.on('reconnect_error', reconnectErrorHandler);
            socket.on('reconnect_failed', reconnectFailedHandler);

            // Clean up listeners on error
            socket.once('connect_error', () => {
                socket.off('connect', connectHandler);
                socket.off('connect_error', connectErrorHandler);
                socket.off('disconnect', disconnectHandler);
                socket.off('reconnect', reconnectHandler);
                socket.off('reconnect_error', reconnectErrorHandler);
                socket.off('reconnect_failed', reconnectFailedHandler);
            });

        } catch (error) {
            console.error('Error creating socket connection:', error);
            reject(error);
        }
    });

    return connectionPromise;
};

export const getSocket = async () => {
    if (!socket) {
        throw new Error('Socket not initialized. Call connectSocket first.');
    }

    if (!socket.connected) {
        try {
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    console.warn('Socket connection timeout, proceeding anyway');
                    resolve(); // Resolve instead of reject to allow chat to continue
                }, 5000); // Reduced timeout to 5 seconds

                socket.once('connect', () => {
                    clearTimeout(timeout);
                    resolve();
                });

                socket.connect();
            });
        } catch (error) {
            console.error('Error reconnecting socket:', error);
            // Don't throw error, allow chat to continue
            return socket;
        }
    }

    return socket;
};

export const disconnectSocket = async () => {
    if (socket) {
        try {
            await new Promise((resolve) => {
                socket.disconnect();
                socket.once('disconnect', () => {
                    socket = null;
                    connectionPromise = null;
                    resolve();
                });
            });
        } catch (error) {
            console.error('Error disconnecting socket:', error);
        }
    }
};

export const joinChat = async (chatId) => {
    try {
        const socket = await getSocket();
        if (!socket || !chatId) {
            throw new Error('Socket not connected or invalid chat ID');
        }

        console.log('Joining chat:', chatId);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.warn('Join chat timeout, proceeding anyway');
                resolve(); // Resolve instead of reject to allow chat to continue
            }, 5000); // Reduced timeout to 5 seconds

            socket.emit('join chat', chatId, (response) => {
                clearTimeout(timeout);
                if (response && response.error) {
                    console.warn('Server returned error on join:', response.error);
                    resolve(); // Resolve anyway to allow chat to continue
                } else {
                    console.log('Successfully joined chat:', chatId);
                    resolve();
                }
            });
        });
    } catch (error) {
        console.error('Error joining chat:', error);
        // Don't throw error, allow chat to continue
        return Promise.resolve();
    }
};

export const leaveChat = async (chatId) => {
    try {
        const socket = await getSocket();
        if (!socket || !chatId) {
            throw new Error('Socket not connected or invalid chat ID');
        }

        console.log('Leaving chat:', chatId);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.warn('Leave chat timeout, proceeding anyway');
                resolve(); // Resolve instead of reject to allow chat to continue
            }, 5000); // Reduced timeout to 5 seconds

            socket.emit('leave chat', chatId, (response) => {
                clearTimeout(timeout);
                if (response && response.error) {
                    console.warn('Server returned error on leave:', response.error);
                    resolve(); // Resolve anyway to allow chat to continue
                } else {
                    console.log('Successfully left chat:', chatId);
                    resolve();
                }
            });
        });
    } catch (error) {
        console.error('Error leaving chat:', error);
        // Don't throw error, allow chat to continue
        return Promise.resolve();
    }
}; 