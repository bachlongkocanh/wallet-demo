import React, { Component } from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { BncClient, rpc, Transaction, crypto, ledger, utils, types, amino } from "@binance-chain/javascript-sdk";
import { ethers } from 'ethers';
import axios from 'axios';

const test_net = "https://testnet-dex.binance.org/";
const main_net = "http://dataseed3.binance.org/";
const from = "tbnb1e94fvt72h6sk7qv2pq2mwr78jpfhqtq9nc4z38";
const pk_from = "1601e81f2f27ece2536665b87827fdd7d7399c108d52336dd460a7c693f5594b";
const to = "tbnb14nwt0ynnw7rc4cu4p78y006r0haur6retdcrmh";
const pk_to = "c6f5bb7f89e91ea6baca45f4df4b33c4934914ef5814a42c42e13139c45b612a";
const HTTP_API = 'https://dex.binance.org';
const ASSET = '';
const MESSAGE = 'MEMO';
export default class App2 extends Component {
    state = {
        address_to: "",
        balance_to: "",
        address_from: "",
        balance_from: ""
    }

    async componentDidMount() {
        this.client = new BncClient(test_net);
        this.client.initChain();
        this.client.chooseNetwork("testnet");
        // const rpcClient = new rpc(main_net, "mainnet");

        // let bal = await rpcClient.getBalance("tbnb1e94fvt72h6sk7qv2pq2mwr78jpfhqtq9nc4z38", "BNB");
        // console.log("bal", bal);
        // var keystore = `{"version":1,"id":"7d461d5a-4ed9-492e-8e07-e250d1c49b95","crypto":{"ciphertext":"751685e379a760270686ba99bbda4a1e07ea93d58d6d0f379f87bf9eeb4c27a7","cipherparams":{"iv":"8521e1ff94ff48f0a47f533a44966c69"},"cipher":"aes-256-ctr","kdf":"pbkdf2","kdfparams":{"dklen":32,"salt":"cf76dca2a611a9c50dea9491a8f125669ff8d72952dbd2cc37f815c0f5c8be20","c":262144,"prf":"hmac-sha256"},"mac":"69f55714186ee825787d94011d6523653902b4eae5810a4e814c392f215460194ac73712f355375b3ab10be28d4fa39824291d4587dc64fccaf6abbe205453f8"}}`
        // this.account_from = await this.client.recoverAccountFromKeystore(keystore, "A123456@");
        // var keystore2 = `{"version":1,"id":"d7737c24-353c-4bea-8fee-35fd1e255903","crypto":{"ciphertext":"0309e2836d79c2f22d74d934bc44cadaeb013bcae8473a0a1fbe82d10d4616ea","cipherparams":{"iv":"b16320d9d66fb18f747474ac90393242"},"cipher":"aes-256-ctr","kdf":"pbkdf2","kdfparams":{"dklen":32,"salt":"71614381d5380b47b57f86d30148a331efcfd97538a5310a7a9f37b498e6c751","c":262144,"prf":"hmac-sha256"},"mac":"41db18c09601a3e293880d2ced538bfc2ede5273f81a9e753a07208675e6637bd2eb90f8e71eed44414fa555d9ce626915aa005882e81d97316bc9ad9e846897"}}`;
        // this.account_to = await this.client.recoverAccountFromKeystore(keystore2, "A123456@")


        const balance_to = await this.client.getBalance(to);
        const balance_from = await this.client.getBalance(from);

        this.setState({
            address_to: to,
            address_from: from,
            balance_to: balance_to.length > 0 ? Number(balance_to[0].free) + Number(balance_to[0].frozen) + Number(balance_to[0].locked) : 0,
            balance_from: Number(balance_from[0].free) + Number(balance_from[0].frozen) + Number(balance_from[0].locked) | 0,
        })

    }

    send = async () => {
        this.client.setPrivateKey(pk_from);
        this.client.getAccount(from).then(account => {
            if (account.status === 200) {
                console.log(account)
                const sequence = account.result.sequence || 0;
                console.log("sequence", sequence)
                this.client.transfer(from, to, 0.1, "BNB", MESSAGE, sequence).then(ss => {
                    console.log("ss", ss)
                }).catch(e => {
                    console.log("err", e)
                })
            }
        })
    }


    render() {
        const { address_from, address_to, balance_from, balance_to } = this.state;
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }} >
                <View>
                    <Text style={{ fontWeight: "bold" }}>TO</Text>
                    <Text>Address: {to} </Text>
                    <Text>Balance: {balance_from} </Text>
                    <Text style={{ fontWeight: "bold" }}>FROM</Text>
                    <Text>Address: {from} </Text>
                    <Text>Balance: {balance_to} </Text>
                    <View style={{ justifyContent: "center", alignItems: "center" }}>
                        <TouchableOpacity
                            onPress={this.send}
                            style={{
                                paddingHorizontal: 70,
                                paddingVertical: 15,
                                backgroundColor: "red",
                                borderRadius: 10
                            }}
                        >
                            <Text>Send</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        )
    }
}