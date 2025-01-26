import React, { useRef, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';

const VideoChat = () => {
    const [socket, setSocket] = useState(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnection = useRef(null);
    const localStreamRef = useRef(null);

    const [localStreamStarted, setLocalStreamStarted] = useState(false);
    const [room, setRoom] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');

    const RoomJoined = (message) => toast.success(message)
    const RoomNotJoined = () => toast.error(`Error Joining Room`)
    const UserLeft = (id) => toast.error(`${id} Left The Room`)
    const UserJoined = (id) => toast.success(`${id} Joined`)
    const EndCall = (id) => toast.error(`${id} Ends the Call`)
    const config = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    };

    // Initialize socket connection
    useEffect(() => {
        const newSocket = io('https://chatter-qpe4.onrender.com', {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        newSocket.on('connect', () => {
            console.log('Socket connected:', newSocket.id);
            setConnectionStatus('connected');
        });

        newSocket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            setConnectionStatus('error');
        });

        newSocket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            setConnectionStatus('disconnected');
        });

        setSocket(newSocket);

        return () => {
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, []);

    useEffect(() => {
        if (!socket) return;

        socket.on('room-joined', ({ room, id }) => {
            if (id) {
                RoomJoined(`Successfully joined room: ${room}`)
                console.log(`Successfully joined room: ${room} with ID: ${id}`);
            } else {
                RoomNotJoined('Error Joining Room')
            }
        });

        socket.on('user-joined', ({ userId }) => {
            UserJoined(userId)
            console.log(`User joined: ${userId}`);
        });

        socket.on('user-left', ({ userId }) => {
            UserLeft(userId)
            console.log(`User left: ${userId}`);
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;
            }
            setIsConnected(false);
        });

        socket.on('call-ends', ({ userId }) => {
            EndCall(userId)
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = null;

            }

        });

        socket.on('offer', async ({ from, offer }) => {
            console.log(`Received offer from ${from}`);
            try {
                peerConnection.current = createPeerConnection();
                if (!peerConnection.current) return;

                await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peerConnection.current.createAnswer();
                await peerConnection.current.setLocalDescription(answer);

                socket.emit('answer', { answer, room });
            } catch (err) {
                console.error('Error handling offer:', err);
            }
        });

        socket.on('answer', async ({ answer }) => {
            try {
                if (peerConnection.current) {
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
                }
            } catch (err) {
                console.error('Error setting remote description:', err);
            }
        });

        socket.on('ice-candidate', async ({ candidate }) => {
            try {
                if (peerConnection.current && candidate) {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                }
            } catch (err) {
                console.error('Error adding ICE candidate:', err);
            }

        });

        return () => {
            socket.off('room-joined');
            socket.off('user-joined');
            socket.off('user-left');
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');
        };
    }, [socket, room]);

    const startLocalStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            localStreamRef.current = stream;
            localVideoRef.current.srcObject = stream;
            setLocalStreamStarted(true);
        } catch (err) {
            console.error('Error accessing media devices:', err);
            alert('Failed to access camera and microphone. Please check permissions.');
        }
    };

    const stopLocalStream = async () => {
        localStreamRef.current = null;
        localVideoRef.current.srcObject = null;
        setLocalStreamStarted(false);
    };

    const createPeerConnection = () => {
        try {
            const pc = new RTCPeerConnection(config);

            // Add local tracks to peer connection
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    pc.addTrack(track, localStreamRef.current);
                });
            }

            // Handle incoming tracks
            pc.ontrack = (event) => {
                console.log('Received remote stream');
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = event.streams[0];
                }
            };

            // Handle ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        room,
                    });
                }
            };

            // Connection state changes
            pc.onconnectionstatechange = () => {
                console.log('Connection state:', pc.connectionState);
                setIsConnected(pc.connectionState === 'connected');
            };

            return pc;
        } catch (err) {
            console.error('Error creating peer connection:', err);
            return null;
        }
    };

    const joinRoom = () => {
        if (!socket) {
            alert('Socket not connected. Please try again.');
            return;
        }
        if (!room.trim()) {
            alert('Please enter a room ID');
            return;
        }
        console.log(`Joining room: ${room}`);
        socket.emit('join-room', room);
    };

    const createOffer = async () => {
        if (!localStreamRef.current) {
            alert('Please start your video first');
            return;
        }

        try {
            peerConnection.current = createPeerConnection();
            if (!peerConnection.current) return;

            const offer = await peerConnection.current.createOffer();
            await peerConnection.current.setLocalDescription(offer);

            console.log('Sending offer');
            socket.emit('offer', { offer, room });
        } catch (err) {
            console.error('Error creating offer:', err);
            alert('Failed to create call offer');
        }
    };

    const endCall = () => {
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;

            remoteVideoRef.current.srcObject = null;

            socket.emit('end-call', { room });
        }
    }

    return (
        <div className="h-[100vh] bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100 p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
                {/* Header Section */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        Chatter.IO
                    </h1>
                    <ToastContainer />
                    <div className="mt-2 flex items-center">
                        <div className={`h-2 w-2 rounded-full mr-2 ${connectionStatus === 'connected' ? 'bg-green-500' :
                            connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                            }`} />
                        <span className="text-sm text-gray-400">
                            {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
                        </span>
                    </div>
                </div>

                {/* Room Controls */}
                <div className="backdrop-blur-md bg-white/5 rounded-2xl p-6 mb-6 border border-white/10">
                    <div className="flex flex-wrap gap-4">
                        <input
                            type="text"
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                            placeholder="Enter room ID"
                            className="flex-1 min-w-[200px] bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                        />
                        <button
                            onClick={joinRoom}
                            disabled={connectionStatus !== 'connected'}
                            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-medium 
                            disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/20 
                            transition-all duration-300 transform hover:-translate-y-0.5"
                        >
                            Join Room
                        </button>
                    </div>
                </div>

                {/* Video Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Local Video */}
                    <div className="backdrop-blur-md bg-white/5 rounded-2xl p-4 border border-white/10 overflow-hidden">
                        <h3 className="text-lg font-medium mb-3 text-gray-300">My Screen</h3>
                        <div className="relative aspect-video bg-gray-800 rounded-lg">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                muted
                                playsInline
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/50 rounded-md text-xs">
                                You
                            </div>
                        </div>
                    </div>

                    {/* Remote Video */}
                    <div className="backdrop-blur-md bg-white/5 rounded-2xl p-4 border border-white/10 overflow-hidden">
                        <h3 className="text-lg font-medium mb-3 text-gray-300">Remote Video</h3>
                        <div className="relative aspect-video bg-gray-800 rounded-lg ">
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/50 rounded-md text-xs">
                                Peer
                            </div>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="backdrop-blur-md bg-white/5 rounded-2xl p-6 border border-white/10">
                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={localStreamStarted ? stopLocalStream : startLocalStream}
                            // disabled={localStreamStarted}
                            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg font-medium 
                            disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-500/20 
                            transition-all duration-300 transform hover:-translate-y-0.5"
                        >
                            {localStreamStarted ? 'Stop Streaming' : 'Start Streaming'}
                        </button>
                        <button
                            onClick={createOffer}
                            disabled={!localStreamStarted || !room || connectionStatus !== 'connected'}
                            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-medium 
                            disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/20 
                            transition-all duration-300 transform hover:-translate-y-0.5"
                        >
                            Start Call
                        </button>
                        <button
                            onClick={endCall}
                            disabled={!localStreamStarted || !room || connectionStatus !== 'connected'}
                            className={`px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-medium 
                                disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/20 
                                transition-all duration-300 transform hover:-translate-y-0.5 
                                ${!remoteVideoRef.current?.srcObject ? 'hidden' : ''}`}
                        >
                            End Call
                        </button>
                    </div>

                    {isConnected && (
                        <div className="mt-4 flex items-center text-emerald-400">
                            <div className="h-2 w-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                            Connected
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoChat;
