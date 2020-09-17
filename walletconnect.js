import RNWalletConnect from '@walletconnect/client';


const nativeOptions = {
    clientMeta: {
        description: "WalletConnect Demo App",
        url: "https://walletconnect.org",
        icons: ["https://walletconnect.org/walletconnect-logo.png"],
        name: "WalletConnect",
        ssl: true
    }
};

export default class WalletConnect {
    constructor(uri) {
        this.walletConnect = new RNWalletConnect({ uri, ...nativeOptions });
        this.walletConnect.on("session_request", (error, payload) => {
            console.log("payloadddd", payload)
            if (error) {
                throw error
            }
            const { peerId, peerMeta } = payload.params[0];
        })
    }
}