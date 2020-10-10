const bs58 = require('bs58');
const createAsyncMiddleware = require('json-rpc-engine/src/createAsyncMiddleware')
const createScaffoldMiddleware = require('json-rpc-engine/src/createScaffoldMiddleware')
const { Transaction } = require('@solana/web3.js')

module.exports = createWalletSubproviderSolana

function createWalletSubproviderSolana(opts = {}) {
    // parse + validate options
    const getAccounts = opts.getAccounts
    const getCluster = opts.getCluster
    const processTransaction = opts.processTransaction
    const signData = opts.signData
    const sendTx = opts.sendTx
    const getState = opts.getState

    return createScaffoldMiddleware({
        'wallet_sendDomainMetadata': createAsyncMiddleware(sendDomainMetadata),
        // account lookups
        'wallet_accounts': createAsyncMiddleware(lookupAccounts),
        'wallet_requestAccounts': createAsyncMiddleware(lookupAccounts),
        // tx signatures
        'wallet_sendTransaction': createAsyncMiddleware(_sendTx),
        'wallet_sign': createAsyncMiddleware(_signData),
        'wallet_getCluster': createAsyncMiddleware(_getCluster),
        'wallet_getState': createAsyncMiddleware(_getState),
    })

    async function _getState(req, res) {
        if (!getState) throw new Error('WalletMiddleware - opts.getState not provided')
        const state = await getState()
        res.result = state
        res.id = req.id
    }

    async function _getCluster(req, res) {
        if (!getCluster) throw new Error('WalletMiddleware - opts.getCluster not provided')
        const cluster = await getCluster()
        res.result = cluster
        res.id = req.id
    }

    async function sendDomainMetadata(req, res) {
        // TODO
        res.result = true;
    }

    //
    // account lookups
    //

    async function lookupAccounts(req, res) {
        if (!getAccounts) throw new Error('WalletMiddleware - opts.getAccounts not provided')
        const accounts = await getAccounts(req)
        res.result = accounts
    }

    //
    // transaction signatures
    //

    async function _signData(req, res) {
        const { signature, publicKey } = await signData(req)
        res.result = {
            signature: bs58.encode(Buffer.from(signature)),
            publicKey: bs58.encode(Buffer.from(publicKey)),
        }
        res.id = req.id
    }

    async function _sendTx(req, res) {
        if (!sendTx) throw new Error('WalletMiddleware - opts.sendTx not provided')
        const encodedTx = req.params.message || {}
        const wireTx = bs58.decode(encodedTx)
        const tx = Transaction.from(wireTx)
        const signature = await sendTx(tx, req)
        res.result = signature
        res.id = req.id
    }

}
