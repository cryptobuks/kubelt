// nftar/index.js

const app = require('./src/app');
const ethers = require('ethers');
const http = require('http');
const process = require('process');
const storage = require('nft.storage');

const main = async (api) => {
    // Inject client for our storage service into the context. We read the
    // API key for the service from the environment variable STORAGE_KEY.
    //
    // NB: app.context is the prototype from which the request ctx is
    // created.
    api.context.storage = new storage.NFTStorage({
        token: process.env.STORAGE_KEY,
    });

    // Import the wallet as a mnemonic. Assumes the default Ethereum
    // path and standard English wordlist.
    const mnemonic = process.env.WALLET_MNEMONIC;
    api.context.wallet = await ethers.Wallet.fromMnemonic(mnemonic);

    // The port to listen on.
    const port = parseInt(process.env.PORT) || 3000;

    return { api, port };
};

(async () => {
    const { api, port } = await main(app);
    http.createServer(api.callback()).listen(port);
})();