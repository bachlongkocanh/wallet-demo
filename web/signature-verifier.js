import { ethers } from 'ethers';
import Web3 from 'web3';
import { util } from '@metamask/controllers';
import Engine from '../core/Engine';
import { sign } from '@warren-bank/ethereumjs-tx-sign';
import { Connection, Account } from '@solana/web3.js';
const nacl = require('tweetnacl');
const WEB3 = new Web3();

const TESTNET = "https://testnet.solana.com";
let connection = new Connection(TESTNET, "recent");

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
            // let tx: Tx = {
            //     chainId: 4,
            //     data: transaction.data,
            //     from: transaction.from,
            //     gas: transaction.gas,
            //     gasPrice: transaction.gasPrice,
            //     to: transaction.to,
            //     value: transaction.value,
            // }
            // console.log("txxxx", tx)
            // tx.nonce = await WEB3.eth.getTransactionCount(tx.from);
            // console.log("nonce", tx)
            // const rawTx = "0x" + await sign(tx, "408864a9a3a164dadeab70d4a5fbedfd42ce5085dc655f6dac8cec14b136b19a").rawTx;
            // console.log("raw tx", rawTx)
            // WEB3.eth.sendSignedTransaction(rawTx, (error, hash) => {
            //     if (error) {
            //         console.log("errrrr", error)
            //         reject(error.toString())
            //     } else {
            //         console.log("rawTxxxxxx", hash)
            //         resolve(hash)
            //     }
            // })
            await TransactionController.updateTransaction(updatedTx);
            await TransactionController.approveTransaction(transaction.id);
        } catch (error) {
            console.log("error", error)
        }

    })


}



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