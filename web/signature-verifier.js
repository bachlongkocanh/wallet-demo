import { ethers } from 'ethers';
import Web3 from 'web3';
import { util } from '@metamask/controllers';
import Engine from '../core/Engine';
import { sign } from '@warren-bank/ethereumjs-tx-sign';
import { Connection, Account, PublicKey, SystemProgram, Transaction, SystemInstruction, Message } from '@solana/web3.js';
const nacl = require('tweetnacl');
const WEB3 = new Web3();
import {
    decodeInstruction,
    decodeTokenInstructionData,
    Market,
    MARKETS,
    TokenInstructions,
    SETTLE_FUNDS_BASE_WALLET_INDEX,
    SETTLE_FUNDS_QUOTE_WALLET_INDEX,
    NEW_ORDER_OPEN_ORDERS_INDEX,
    NEW_ORDER_OWNER_INDEX,
} from '@project-serum/serum';
const bs58 = require('bs58');
const privateKey = "fe5d6b4af644d5662c17d23489a47d6489ef50406cee1a361fe79d6011aac3d4ebca56c71846771710f60a61d337d603ed558dfb07d9befac64503367714ab82"

const TESTNET = "https://testnet.solana.com";
const MAINNET = "https://solana-api.projectserum.com";
let connection = new Connection(MAINNET, "recent");
const marketCache = {};
let marketCacheConnection = null;
const cacheDuration = 15 * 1000;

export default class SignatureVerifier {
    provider;
    constructor(network) {
        switch (network) {
            case "ethereum":
                WEB3.setProvider(new Web3.providers.HttpProvider('https://rinkeby.infura.io/v3/c35d29e3edf64e099bce0102aed4e81a'));
                break;
            case "nexty":
                WEB3.setProvider(new Web3.providers.HttpProvider('https://rpc.nexty.io'));
                break;
            case "tron":
                break;
            default:
                break;
        }
    }

    signData = (data) => new Promise((resolve, reject) => {
        try {
            let rawSign = nacl.sign.detached(data, Buffer.from("2f9ecbc02dc87033ca22cf886d9a1c4a37c87e517c2df589aa63deb60f1e975b3d3c14f44b7ab03824960435370a3a050c85331c1016f956c605ec14e75f1a0e", 'hex'));
            resolve(rawSign)
        } catch (error) {
            console.log("error", error)
            reject(error)
        }
    })



    signMessage = (message, privateKey, KeyringController) => new Promise(async (resolve, reject) => {
        try {
            let rawTx = await KeyringController.signPersonalMessage(message);
            resolve(rawTx)
        } catch (error) {
            reject(error)
        }
    })

    signTransactionSOL = (transaction) => new Promise(async (resolve, reject) => {
        try {
            const { TransactionController } = Engine.context;
            TransactionController.hub.on(`${transaction.id}:finished`, transactionMeta => {
                if (transactionMeta.status === 'submitted') {
                    console.log("submitted")
                } else {
                    console.log(transactionMeta.error)
                    throw transactionMeta.error;
                }
            })
            const fullTx = Engine.state.TransactionController.transactions.find(({ id }) => id === transaction.id);
            const updatedTx = { ...fullTx, transaction };
            await TransactionController.updateTransactionSOL(updatedTx);
            await TransactionController.approveTransactionSOL(transaction.id);
        } catch (error) {
            console.log("errorrrrr", error)
        }
    })


    signTransaction = (transaction) => new Promise(async (resolve, reject) => {
        try {
            const { TransactionController, KeyringController } = Engine.context;
            transaction = prepareTransaction(transaction);
            TransactionController.hub.on(`${transaction.id}:finished`, transactionMeta => {
                console.log("TransactionController.hub.on", transactionMeta.status)
                if (transactionMeta.status === 'submitted') {
                    console.log("transactionMeta.status")
                } else {
                    console.log(transactionMeta.error)
                    throw transactionMeta.error;
                }
            })
            console.log("transactions", Engine.state.TransactionController)
            const fullTx = Engine.state.TransactionController.transactions.find(({ id }) => id === transaction.id);
            const updatedTx = { ...fullTx, transaction };
            await TransactionController.updateTransaction(updatedTx);
            await TransactionController.approveTransaction(transaction.id);
        } catch (error) {
            console.log("error", error)
        }

    })

    signData(data) {
        return nacl.sign.detached(data, Buffer.from(privateKey, 'hex'));
    }

    signTx(tx) {
        return nacl.sign.detached(bs58.decode(tx), Buffer.from(privateKey, 'hex'));
    }

}

export const getPublicKey = (address) => {
    return new PublicKey(address).toBuffer()
}

export const signData = (data) => {
    return nacl.sign.detached(data, Buffer.from(privateKey, 'hex'));
}

export const signTx = (tx) => {
    return nacl.sign.detached(bs58.decode(tx), Buffer.from(privateKey, 'hex'));
}

export const toParams = async (tx, address) => {
    const decodeMessage = await DecodeMessage(tx, address)
    return {
        from: address,
        to: address,
        value: '0x0',
        data: JSON.stringify(decodeMessage),
        nonETH: true,
    }
}

const DecodeMessage = async (message, address) => {
    message = bs58.decode(message)
    // get message object
    const transactionMessage = Message.from(message);
    if (!transactionMessage.instructions || !transactionMessage.accountKeys) {
        return;
    }

    // get instructions
    const instructions = [];
    for (var i = 0; i < transactionMessage.instructions.length; i++) {
        let transactionInstruction = transactionMessage.instructions[i];
        const instruction = await toInstruction(
            transactionMessage.accountKeys,
            transactionInstruction,
            i,
            address
        );
        instructions.push({
            ...instruction,
            rawData: transactionInstruction.data,
        });
    }
    return instructions;
};

const toInstruction = async (accountKeys, instruction, index, address) => {
    if (
        !instruction.data ||
        !instruction.accounts ||
        !instruction.programIdIndex
    ) {
        return;
    }

    // get instruction data
    const decoded = bs58.decode(instruction.data);
    const programId = getAccountByIndex(
        [instruction.programIdIndex],
        accountKeys,
        0,
    );

    const publicKey = new PublicKey(address)
    if (!programId) {
        return null;
    }

    try {
        if (programId.equals(SystemProgram.programId)) {
            console.log('[' + index + '] Handled as system instruction');
            return handleSystemInstruction(publicKey, instruction, accountKeys);
        } else if (programId.equals(TOKEN_PROGRAM_ID)) {
            console.log('[' + index + '] Handled as token instruction');
            let decodedInstruction = decodeTokenInstruction(decoded);
            return handleTokenInstruction(
                publicKey,
                instruction.accounts,
                decodedInstruction,
                accountKeys,
            );
        } else if (
            MARKETS.some(
                (market) => market.programId && market.programId.equals(programId),
            )
        ) {
            console.log('[' + index + '] Handled as dex instruction');
            let decodedInstruction = decodeInstruction(decoded);
            return await handleDexInstruction(
                instruction,
                accountKeys,
                decodedInstruction,
            );
        }
    } catch { }

    // all decodings failed
    console.log('[' + index + '] Failed, data: ' + JSON.stringify(decoded));

    return;
};

const getAccountByIndex = (accounts, accountKeys, accountIndex) => {
    const index = accounts.length > accountIndex && accounts[accountIndex];
    return accountKeys.length > index && accountKeys[index];
};

const handleSystemInstruction = (publicKey, instruction, accountKeys) => {
    const { programIdIndex, accounts, data } = instruction;
    if (!programIdIndex || !accounts || !data) {
        return;
    }

    // construct system instruction
    const systemInstruction = {
        programId: accountKeys[programIdIndex],
        keys: accounts.map((accountIndex) => ({
            pubkey: accountKeys[accountIndex],
        })),
        data: bs58.decode(data),
    };

    // get layout
    let decoded;
    const type = SystemInstruction.decodeInstructionType(systemInstruction);
    switch (type) {
        case 'Create':
            decoded = SystemInstruction.decodeCreateAccount(systemInstruction);
            break;
        case 'CreateWithSeed':
            decoded = SystemInstruction.decodeCreateWithSeed(systemInstruction);
            break;
        case 'Allocate':
            decoded = SystemInstruction.decodeAllocate(systemInstruction);
            break;
        case 'AllocateWithSeed':
            decoded = SystemInstruction.decodeAllocateWithSeed(systemInstruction);
            break;
        case 'Assign':
            decoded = SystemInstruction.decodeAssign(systemInstruction);
            break;
        case 'AssignWithSeed':
            decoded = SystemInstruction.decodeAssignWithSeed(systemInstruction);
            break;
        case 'Transfer':
            decoded = SystemInstruction.decodeTransfer(systemInstruction);
            break;
        case 'AdvanceNonceAccount':
            decoded = SystemInstruction.decodeNonceAdvance(systemInstruction);
            break;
        case 'WithdrawNonceAccount':
            decoded = SystemInstruction.decodeNonceWithdraw(systemInstruction);
            break;
        case 'InitializeNonceAccount':
            decoded = SystemInstruction.decodeNonceInitialize(systemInstruction);
            break;
        case 'AuthorizeNonceAccount':
            decoded = SystemInstruction.decodeNonceAuthorize(systemInstruction);
            break;
        default:
            return;
    }

    if (
        !decoded ||
        (decoded.fromPubkey && !publicKey.equals(decoded.fromPubkey))
    ) {
        return;
    }

    return {
        type: 'system' + type,
        data: decoded,
    };
};

const decodeTokenInstruction = (bufferData) => {
    if (!bufferData) {
        return;
    }

    if (bufferData.length === 1) {
        if (bufferData[0] === 1) {
            return { initializeAccount: {} };
        } else if (bufferData[0] === 9) {
            return { closeAccount: {} };
        }
    } else {
        return decodeTokenInstructionData(bufferData);
    }
};

const handleTokenInstruction = (publicKey, accounts, decodedInstruction, accountKeys) => {
    if (!decodedInstruction || Object.keys(decodedInstruction).length > 1) {
        return;
    }

    // get data
    const type = Object.keys(decodedInstruction)[0];
    let data = decodedInstruction[type];
    if (type === 'initializeAccount') {
        const initializeAccountData = getInitializeAccountData(
            publicKey,
            accounts,
            accountKeys,
        );
        data = { ...data, ...initializeAccountData };
    } else if (type === 'transfer') {
        const transferData = getTransferData(publicKey, accounts, accountKeys);
        data = { ...data, ...transferData };
    } else if (type === 'closeAccount') {
        const closeAccountData = getCloseAccountData(
            publicKey,
            accounts,
            accountKeys,
        );
        data = { ...data, ...closeAccountData };
    }

    return {
        type,
        data,
    };
};
const getInitializeAccountData = (publicKey, accounts, accountKeys) => {
    const accountPubkey = getAccountByIndex(
        accounts,
        accountKeys,
        TokenInstructions.INITIALIZE_ACCOUNT_ACCOUNT_INDEX,
    );

    const mintPubkey = getAccountByIndex(
        accounts,
        accountKeys,
        TokenInstructions.INITIALIZE_ACCOUNT_MINT_INDEX,
    );

    const ownerPubkey = getAccountByIndex(
        accounts,
        accountKeys,
        TokenInstructions.INITIALIZE_ACCOUNT_OWNER_INDEX,
    );

    if (!ownerPubkey || !publicKey.equals(ownerPubkey)) {
        return;
    }
    return { accountPubkey, mintPubkey, ownerPubkey };
};


const getTransferData = (publicKey, accounts, accountKeys) => {
    const sourcePubkey = getAccountByIndex(
        accounts,
        accountKeys,
        TokenInstructions.TRANSFER_SOURCE_INDEX,
    );

    const destinationPubkey = getAccountByIndex(
        accounts,
        accountKeys,
        TokenInstructions.TRANSFER_DESTINATION_INDEX,
    );

    const ownerPubkey = getAccountByIndex(
        accounts,
        accountKeys,
        TokenInstructions.TRANSFER_OWNER_INDEX,
    );

    if (!ownerPubkey || !publicKey.equals(ownerPubkey)) {
        return;
    }

    return { sourcePubkey, destinationPubkey, ownerPubkey };
};

const getCloseAccountData = (publicKey, accounts, accountKeys) => {
    const sourcePubkey = getAccountByIndex(
        accounts,
        accountKeys,
        TokenInstructions.TRANSFER_SOURCE_INDEX,
    );

    const destinationPubkey = getAccountByIndex(
        accounts,
        accountKeys,
        TokenInstructions.TRANSFER_DESTINATION_INDEX,
    );

    const ownerPubkey = getAccountByIndex(
        accounts,
        accountKeys,
        TokenInstructions.TRANSFER_OWNER_INDEX,
    );

    if (!ownerPubkey || !publicKey.equals(ownerPubkey)) {
        return;
    }

    return { sourcePubkey, destinationPubkey, ownerPubkey };
};

const handleDexInstruction = async (instruction, accountKeys, decodedInstruction, ) => {
    if (!decodedInstruction || Object.keys(decodedInstruction).length > 1) {
        return;
    }

    const { accounts, programIdIndex } = instruction;

    // get market info
    const marketInfo =
        accountKeys &&
        MARKETS.find(
            (market) =>
                accountKeys.findIndex((accountKey) =>
                    accountKey.equals(market.address),
                ) > -1,
        );

    // get market
    let market, programIdAddress;
    try {
        const marketAddress =
            marketInfo.address || getAccountByIndex(accounts, accountKeys, 0);
        programIdAddress =
            marketInfo.programId ||
            getAccountByIndex([programIdIndex], accountKeys, 0);
        const strAddress = marketAddress.toBase58();
        const now = new Date().getTime();
        if (
            !(
                connection === marketCacheConnection &&
                strAddress in marketCache &&
                now - marketCache[strAddress].ts < cacheDuration
            )
        ) {
            marketCacheConnection = connection;
            console.log('Loading market', strAddress);
            marketCache[strAddress] = {
                market: await Market.load(
                    connection,
                    marketAddress,
                    {},
                    programIdAddress,
                ),
                ts: now,
            };
        }
        market = marketCache[strAddress].market;
    } catch (e) {
        console.log('Error loading market: ' + e.message);
    }

    // get data
    const type = Object.keys(decodedInstruction)[0];
    let data = decodedInstruction[type];
    if (type === 'settleFunds') {
        const settleFundsData = getSettleFundsData(accounts, accountKeys);
        if (!settleFundsData) {
            return;
        } else {
            data = { ...data, ...settleFundsData };
        }
    } else if (type === 'newOrder') {
        const newOrderData = getNewOrderData(accounts, accountKeys);
        data = { ...data, ...newOrderData };
    }
    return {
        type,
        data,
        market,
        marketInfo,
    };
};

const getNewOrderData = (accounts, accountKeys) => {
    const openOrdersPubkey = getAccountByIndex(
        accounts,
        accountKeys,
        NEW_ORDER_OPEN_ORDERS_INDEX,
    );
    const ownerPubkey = getAccountByIndex(
        accounts,
        accountKeys,
        NEW_ORDER_OWNER_INDEX,
    );
    return { openOrdersPubkey, ownerPubkey };
};

const getSettleFundsData = (accounts, accountKeys) => {
    const basePubkey = getAccountByIndex(
        accounts,
        accountKeys,
        SETTLE_FUNDS_BASE_WALLET_INDEX,
    );

    const quotePubkey = getAccountByIndex(
        accounts,
        accountKeys,
        SETTLE_FUNDS_QUOTE_WALLET_INDEX,
    );

    if (!basePubkey || !quotePubkey) {
        return;
    }

    return { basePubkey, quotePubkey };
};



const prepareTransaction = transaction => ({
    ...transaction,
    gas: util.BNToHex(transaction.gas),
    gasPrice: util.BNToHex(transaction.gasPrice),
    value: util.BNToHex(transaction.value),
    to: transaction.to,
    from: transaction.from
});

export interface Tx {
    nonce?: string | number,
    chainId?: string | number,
    from?: string,
    to?: string,
    data?: string,
    value?: string | number,
    gas?: string | number,
    gasPrice?: string | number

}

const TOKEN_PROGRAM_ID = new PublicKey(
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);