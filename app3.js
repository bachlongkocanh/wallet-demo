import React, { Component } from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import {
    Account,
    Connection,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    SYSVAR_RENT_PUBKEY,
    StakeProgram,
    SystemInstruction,

} from '@solana/web3.js';
import { ethers } from 'ethers';
import nacl from 'tweetnacl';
import bip39 from 'react-native-bip39';
import { bip32 } from 'bitcoinjs-lib'
import * as BufferLayout from 'buffer-layout';
import bs58 from "bs58";
import { ParsedInfo } from "validators";
// import { IX_STRUCTS, TokenInstructionType, IX_TITLES } from "./types";

const mnemonic = "wage invite bar liberty cave inside holiday together glimpse deer soup fatal lonely damage ostrich";
const MAINNET_URL = 'https://solana-api.projectserum.com';
const TESTNET = "https://testnet.solana.com";

const toAddress = "5sme35uTFmyxNkn5noPQtkJeFVp9VJTfJuy2x9S5U6sx"
const TokenAddress = "4nSzoeUJKLpPs1ekpghqYMMFiUE8Y7wKU5dnx956Ykqe";
export default class componentName extends Component {
    state = {
        address: null,
        balance: null
    }


    componentDidMount = async () => {
        this.connection = new Connection(TESTNET, 'recent')
        // console.error('connection', connection);
        const seed = await this.mnemonicToSeed(mnemonic)
        this.account = this.getAccountFromSeed(seed, 2, 0)
        this.publicKey = this.account.publicKey;
        console.log("address", this.account.publicKey.toBase58())
        this.setState({ address: this.account.publicKey.toBase58() })
        this.loadListConfirm()
    };

    updateBalance = async (publicKey) => {
        const accountInfo = await this.connection.getAccountInfo(publicKey)
        let { mint, owner, amount } = accountInfo?.owner.equals(new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'))
            ? parseTokenAccountData(accountInfo.data)
            : {}
        if (!mint) {
            return {
                amount: accountInfo?.lamports ?? 0,
                decimals: 9,
                mint: null,
                owner: publicKey,
                tokenName: 'SOL',
                tokenSymbol: 'SOL',
                valid: true,
            };
        }
    }

    getInfoToken = () => {
        let tokenAddress = new PublicKey("6JPQESYCNK29dbDnNVU3zzg2TyeSjj5hQnkSiNsPCWcE")
        this.connection.getTokenSupply(tokenAddress).then(ss => {
            console.log("ss", ss)
        }).catch(e => console.log(e))
    }


    async mnemonicToSeed(mnemonic) {
        if (!bip39.validateMnemonic(mnemonic)) {
            throw new Error('Invalid seed words');
        }
        const seed = await bip39.mnemonicToSeed(mnemonic);
        return Buffer.from(seed);
    }

    getAccountFromSeed(seed, walletIndex, accountIndex = 0) {
        const derivedSeed = bip32
            .fromSeed(seed)
            .derivePath(`m/501'/${walletIndex}'/0/${accountIndex}`).privateKey;
        return new Account(nacl.sign.keyPair.fromSeed(derivedSeed).secretKey);
    }

    transferSOL = async (amount) => {
        this.connection.sendTransaction(
            SystemProgram.transfer({
                fromPubkey: this.publicKey,
                toPubkey: new PublicKey(toAddress),
                lamports: amount
            }),
            [this.account]
        ).then(ss => {
            console.log("success", ss)
        }).catch(e => console.log("error", e))

    }

    transferTokens = async ({ owner, sourcePublicKey, destinationPublicKey, amount }) => {
        let transaction = new Transaction().add(
            transfer({
                source: sourcePublicKey,
                destination: destinationPublicKey,
                owner: owner.publicKey,
                amount,
            }),
        );
        let signers = [owner];
        return await this.connection.sendTransaction(transaction, signers);
    }

    send = async () => {
        let amount = Math.round(1 * Math.pow(10, 9))
        if (this.publicKey.equals(this.publicKey)) {
            return this.transferSOL(amount)
        }
        return await this.transferTokens({
            owner: this.account,
            sourcePublicKey: this.publicKey,
            destinationPublicKey: new PublicKey(toAddress),
            amount: amount
        })
    }

    onPress = async () => {
        let account = await this.createAddressOnToken();
        console.log("acc", account)
    }

    createAddressOnToken = async () => {
        const mint = new PublicKey(TokenAddress);
        const newAccount = new Account();
        let transaction = SystemProgram.createAccount({
            fromPubkey: this.account.publicKey,
            newAccountPubkey: newAccount.publicKey,
            lamports: await this.connection.getMinimumBalanceForRentExemption(
                ACCOUNT_LAYOUT.span,
            ),
            space: ACCOUNT_LAYOUT.span,
            programId: TOKEN_PROGRAM_ID,
        });
        transaction.add(
            initializeAccount({
                account: newAccount.publicKey,
                mint: mint,
                owner: this.account.publicKey,
            }),
        );
        let signers = [this.account, newAccount];
        console.log("new account", newAccount.publicKey.toBase58())
        return await this.connection.sendTransaction(transaction, signers);
    }

    loadListConfirm = () => {
        this.connection.getConfirmedSignaturesForAddress2(this.account.publicKey, { limit: 50 }).then(listConfirms => {

            listConfirms.forEach(confirm => {
                setTimeout(() => {
                    this.connection.getParsedConfirmedTransaction(confirm.signature).then(info => {
                        console.log("slot", info.slot)
                        const { transaction } = info;
                        transaction.message.instructions.map((next, index) => {
                            if ("parsed" in next) {
                                if (next.program === "spl-token") {
                                    console.log("token");
                                    console.log("next", next.parsed)
                                }
                                return;
                            }
                            const ix = intoTransactionInstruction(transaction, index);
                            if (SystemProgram.programId.equals(ix.programId)) {
                                let systemInstructionType = SystemInstruction.decodeInstructionType(ix);
                                switch (systemInstructionType) {
                                    case "Transfer":
                                        let transfer = SystemInstruction.decodeTransfer(ix);
                                        console.log("transfer", transfer)
                                        break;
                                    default:
                                        break;
                                }
                                return
                            } else if (StakeProgram.programId.equals(ix.programId)) {
                                // console.log("stake detail")
                                return
                            } else if (isSerumInstruction(ix)) {
                                // console.log("serum detail")
                                return
                            } else {
                                // console.log("unknow")
                                return
                            }
                        })
                    })
                }, 1000);
            })
        }).catch(e => console.log)
    }

    render() {
        const { address } = this.state;
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: "center" }}>
                <Text numberOfLines={1} ellipsizeMode="middle">Address: {address}</Text>

                <TouchableOpacity
                    style={{ paddingHorizontal: 100, paddingVertical: 15, backgroundColor: "#1976d2", marginVertical: 20 }}
                    onPress={this.send}
                >
                    <Text>Send</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={{ paddingHorizontal: 40, paddingVertical: 15, backgroundColor: "#1976d2" }}
                    onPress={this.onPress}
                >
                    <Text>Create address on Token</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={{ paddingHorizontal: 100, paddingVertical: 15, backgroundColor: "#1976d2", marginVertical: 20 }}
                    onPress={this.getInfoToken}
                >
                    <Text>Info token</Text>
                </TouchableOpacity>
            </View>
        )
    }
}


const ACCOUNT_LAYOUT = BufferLayout.struct([
    BufferLayout.blob(32, "mint"),
    BufferLayout.blob(32, "owner"),
    BufferLayout.nu64("amount"),
    BufferLayout.blob(93)
])

const MINT_LAYOUT = BufferLayout.struct([
    BufferLayout.blob(44),
    BufferLayout.u8('decimals'),
    BufferLayout.blob(37),
]);

const parseTokenAccountData = (data) => {
    let { mint, owner, amount } = ACCOUNT_LAYOUT.decode(data);
    return {
        mint: new PublicKey(mint),
        owner: new PublicKey(owner),
        amount,
    };
}

const parseMintData = (data) => {
    let { decimals } = MINT_LAYOUT.decode(data);
    return { decimals };
}

const getOwnedAccountsFilters = (publicKey) => {
    return [
        {
            memcmp: {
                offset: ACCOUNT_LAYOUT.offsetOf('owner'),
                bytes: publicKey.toBase58(),
            },
        },
        {
            dataSize: ACCOUNT_LAYOUT.span,
        },
    ];
}

const TOKEN_PROGRAM_ID = new PublicKey(
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);

const LAYOUT = BufferLayout.union(BufferLayout.u8('instruction'));
LAYOUT.addVariant(
    0,
    BufferLayout.struct([
        BufferLayout.u8('decimals'),
        BufferLayout.blob(32, 'mintAuthority'),
        BufferLayout.u8('freezeAuthorityOption'),
        BufferLayout.blob(32, 'freezeAuthority'),
    ]),
    'initializeMint',
);
LAYOUT.addVariant(1, BufferLayout.struct([]), 'initializeAccount');
LAYOUT.addVariant(
    3,
    BufferLayout.struct([BufferLayout.nu64('amount')]),
    'transfer',
);
LAYOUT.addVariant(
    7,
    BufferLayout.struct([BufferLayout.nu64('amount')]),
    'mintTo',
);
LAYOUT.addVariant(
    8,
    BufferLayout.struct([BufferLayout.nu64('amount')]),
    'burn',
);

const instructionMaxSpan = Math.max(
    ...Object.values(LAYOUT.registry).map((r) => r.span),
);

const initializeAccount = ({ account, mint, owner }) => {
    let keys = [
        { pubkey: account, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: owner, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    return new TransactionInstruction({
        keys,
        data: encodeTokenInstructionData({
            initializeAccount: {},
        }),
        programId: TOKEN_PROGRAM_ID,
    });
}

const encodeTokenInstructionData = (instruction) => {
    let b = Buffer.alloc(instructionMaxSpan);
    let span = LAYOUT.encode(instruction, b);
    return b.slice(0, span);
}


const mintTo = ({ mint, destination, amount, mintAuthority }) => {
    let keys = [
        { pubkey: mint, isSigner: false, isWritable: true },
        { pubkey: destination, isSigner: false, isWritable: true },
        { pubkey: mintAuthority, isSigner: true, isWritable: false },
    ];
    return new TransactionInstruction({
        keys,
        data: encodeTokenInstructionData({
            mintTo: {
                amount,
            },
        }),
        programId: TOKEN_PROGRAM_ID,
    });
}

const initializeMint = ({
    mint,
    decimals,
    mintAuthority,
    freezeAuthority,
}) => {
    let keys = [
        { pubkey: mint, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
    return new TransactionInstruction({
        keys,
        data: encodeTokenInstructionData({
            initializeMint: {
                decimals,
                mintAuthority: mintAuthority.toBuffer(),
                freezeAuthorityOption: !!freezeAuthority,
                freezeAuthority: (freezeAuthority || new PublicKey()).toBuffer(),
            },
        }),
        programId: TOKEN_PROGRAM_ID,
    });
}

var binArrayToJson = (binArray) => {
    var str = "";
    for (var i = 0; i < binArray.length; i++) {
        str += String.fromCharCode(parseInt(binArray[i]));
    }
    return JSON.parse(str)
}

const intoTransactionInstruction = (
    tx: ParsedTransaction,
    index: number
): TransactionInstruction | undefined => {
    const message = tx.message;
    const instruction = message.instructions[index];
    if ("parsed" in instruction) return;

    const keys = [];
    for (const account of instruction.accounts) {
        const accountKey = message.accountKeys.find(({ pubkey }) =>
            pubkey.equals(account)
        );
        if (!accountKey) return;
        keys.push({
            pubkey: accountKey.pubkey,
            isSigner: accountKey.signer,
            isWritable: accountKey.writable,
        });
    }
    return new TransactionInstruction({
        data: bs58.decode(instruction.data),
        keys: keys,
        programId: instruction.programId,
    });
}

const isSerumInstruction = (instruction: TransactionInstruction) => {
    return instruction.programId.toBase58() === EXTERNAL_PROGRAMS["Serum"];
}
const EXTERNAL_PROGRAMS: { [key: string]: string } = {
    Serum: "4ckmDgGdxQoPDLUkDT3vHgSAkzA3QRdNq5ywwY4sUSJn",
};