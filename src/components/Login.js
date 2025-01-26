import React, { useState } from 'react';
import './Login.css';

const Login = () => {
    const [account, setAccount] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState('');

    // const getEnsName = async (address) => {
    //     try {
    //         // Check if the provider supports ENS
    //         const provider = window.ethereum;
    //         if (!provider.request) return null;

    //         // Try to get the ENS name
    //         const name = await provider.request({
    //             method: 'eth_call',
    //             params: [
    //                 {
    //                     to: '0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41', // ENS Reverse Resolver contract
    //                     data: `0x691f3431${address.slice(2).padStart(64, '0')}`, // function: reverseOf(address)
    //                 },
    //                 'latest',
    //             ],
    //         });

    //         // If we got a name, remove the padding and convert from bytes32
    //         if (name && name !== '0x' && name !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
    //             const ensName = window.web3.utils.hexToUtf8(name);
    //             return ensName;
    //         }
    //         return null;
    //     } catch (error) {
    //         console.error('Error fetching ENS name:', error);
    //         return null;
    //     }
    // };

    const signMessage = async (walletAddress) => {
        const message = `Login to Talker.io at ${new Date().toISOString()} with wallet: ${walletAddress}`;
        try {
            const signature = await window.ethereum.request({
                method: 'personal_sign',
                params: [message, walletAddress],
            });
            return { message, signature };
        } catch (error) {
            setLoading(false)
            console.error('Error signing message:', error);
            setError('Failed to sign the message. Please try again.');
            return null;
        }
    };

    const connectMetaMask = async () => {
        const isMetaMaskInstalled =
            typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
        if (isMetaMaskInstalled) {
            try {
                // Request accounts from MetaMask
                setLoading(true)
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                if (accounts.length === 0) {
                    setLoading(false);
                    setError('Connection canceled or no account selected.');
                    return;
                }
                const userAccount = accounts[0];

                const signedData = await signMessage(userAccount);
                if (signedData) {
                    console.log('Signed Data:', signedData.signature);
                    setLoading(false)
                    setAccount(userAccount);
                    setError('');
                    console.log('Connected Account:', userAccount);
                    localStorage.setItem('walletAddress', userAccount);
                }
            } catch (err) {
                setLoading(false)
                console.error('Error connecting to MetaMask:', err);
                setError('Failed to connect. Please try again.');
            }
        } else {
            setLoading(false)
            setError('MetaMask is not installed. Please install it to continue.');
        }
    };

    const Logout = () => {
        localStorage.removeItem('walletAddress');
        setAccount(null);
        // alert('Logged out successfully');
    };

    return (
        <div className="login-container">
            <div>
                <div className="login-card">
                    {!account ? <h1>Sign In</h1> : <h1>Welcome </h1>}
                    {!account ? <p className='wallet-heading'>Connect your wallet to continue</p> : <p>Wallet Connected</p>}
                    {account && <p className='wallet-address'>{account}</p>}
                    <div className="buttons">
                        {!account && <button className="login-button" onClick={connectMetaMask}>
                            {loading ? <div className='loader'></div> : 'MetaMask / Phantom'}
                        </button>}
                        {account && <button className="logout-button" onClick={Logout}>
                            Logout
                        </button>}
                    </div>
                    {error && <p className="error">{error}</p>}
                </div>
            </div>
        </div>
    );
};

export default Login;

document.addEventListener('mousemove', function (event) {
    const dustContainer = document.createElement('div');
    dustContainer.classList.add('dust');
    document.body.appendChild(dustContainer);

    const size = Math.random() * 10 + 5; // Random size for dust particles
    dustContainer.style.width = `${size}px`;
    dustContainer.style.height = `${size}px`;

    const mouseX = event.clientX;
    const mouseY = event.clientY;

    dustContainer.style.left = `${mouseX - size / 2}px`;
    dustContainer.style.top = `${mouseY - size / 2}px`;

    setTimeout(() => {
        dustContainer.remove();
    }, 2000);
});
