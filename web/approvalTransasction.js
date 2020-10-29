import React, { Component } from 'react'
import { Text, View, Modal, TextInput } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler';
import InputDataDecoder from 'ethereum-input-data-decoder';
import ABI from '../ABI';
import Web3 from 'web3';
import Engine from '../core/Engine';
import { util } from '@ezdefi/controllers';
import BigNumber from 'bignumber.js';

interface ApprovalDialogProps {
    showApprovalDialog: Boolean,
    accept: Function,
    reject: Function,
    transaction: Object
}
const WEB3 = new Web3();
export default class ApprovalDialog extends Component<ApprovalDialogProps> {
    state = {
        tokenInfo: null,
        from: null,
        to: null,
        contractAddress: null,
        gas: null,
        gasPrice: null,
        method: null,
        value: null,
        origin: null,
        amount: null,
        fee: null,
        gasLimit: null,
        balance: null,
        Insufficient: false

    }
    async componentDidMount() {
        const { transaction } = this.props;
        if (transaction) {
            console.log("transaction", transaction)
            let { data, from, gasPrice, gas, to, origin, value } = transaction;
            if (!BigNumber.isBigNumber(gas)) {
                gas = new BigNumber(gas);
            }
            this.setState({ from, to, origin, value: value.toString(), gas: gas.toString() })
            const { NetworkController } = Engine.context;
            WEB3.setProvider(NetworkController.provider);
            const decimalsBN = util.hexToBN(`0x${Math.pow(10, 18).toString(16)}`);
            try {
                var Contract = await new WEB3.eth.Contract(ABI, to);
                var symbol = await Contract.methods.symbol().call();
                var decimals = await Contract.methods.decimals().call();
                let tokenInfo = {
                    symbol,
                    decimals
                }
                this.setState({ tokenInfo, contractAddress: to })
            } catch (error) {
                console.log("err", error)
            }
            if (data) {
                DecodeInput(data).then(decode => {
                    try {
                        let amountNumber = decode?.inputs[1].div(decimalsBN);
                        this.setState({ method: decode?.method, to: decode?.inputs[0], amount: decode?.inputs[1].toString() });
                        // const value = util.BNToHex(decode?.inputs[1])
                        // console.log("value", value)
                    } catch (error) {

                    }
                    // switch (decode?.method) {
                    //     case "transfer":
                    //         this.setState({method:decode?.method})
                    //         break;
                    //     case "approve":
                    //         this.setState({ method: decode?.method })
                    //         break;
                    //     default:
                    //         break;
                    // }
                })
            }
            const balance = new BigNumber(await WEB3.eth.getBalance(from));

            const decimaslBN1 = new BigNumber(Math.pow(10, 18));
            const gasPriceBN = new BigNumber(gasPrice.toString());

            let gasPriceGwei = gasPriceBN.div(decimaslBN1);

            let fee = gasPriceGwei.multipliedBy(new BigNumber(gas.toString()));
            this.setState({
                gasPrice: (gasPriceBN.div(new BigNumber(Math.pow(10, 9)))),
                gasLimit: gas,
                fee: fee,
                balance,
                Insufficient: balance.isGreaterThanOrEqualTo(gasPriceBN.multipliedBy(gas))
            })
        }
    }

    onChangeGasPrice = value => {
        if (Number(value) <= 0) return;
        this.setState({ gasPrice: new BigNumber(value) }, () => {
            let gasPriceBN = new BigNumber(value).multipliedBy(new BigNumber(Math.pow(10, 9)));
            let fee = gasPriceBN.multipliedBy(this.state.gasLimit);
            this.setState({
                fee: fee.div(new BigNumber(Math.pow(10, 18))),
                Insufficient: this.state.balance.isGreaterThanOrEqualTo(fee)
            })
        })
    }

    onChangeGasLimit = value => {
        this.setState({ gasLimit: value }, () => {
            let gasLimitBN = new BigNumber(value);
            let fee = gasLimitBN.multipliedBy(this.state.gasPrice.multipliedBy(new BigNumber(Math.pow(10, 9))));
            this.setState({
                fee: fee.div(new BigNumber(Math.pow(10, 18))),
                Insufficient: this.state.balance.isGreaterThanOrEqualTo(fee)
            })
        })
    }

    onAccept = () => {
        const { gasLimit, gasPrice, } = this.state;
        let { accept, transaction } = this.props;
        console.log("aaaa", gasLimit.toString(), gasPrice.toString());
        let gasPriceWei = gasPrice.multipliedBy(new BigNumber(Math.pow(10, 9)));
        transaction.gasPrice = gasPriceWei;
        transaction.gas = gasLimit;
        accept(transaction)
    }


    render() {
        const { showApprovalDialog, accept, reject, transaction } = this.props;
        const { from, to, gas, gasPrice, method, tokenInfo, value, origin, amount, gasLimit, fee, Insufficient } = this.state;
        return (
            <Modal
                animationType="slide"
                visible={showApprovalDialog}
                statusBarTranslucent={true}
                transparent={true}
            >
                <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0,0.5)", paddingHorizontal: 50, paddingVertical: 200 }}>
                    <View style={{ flex: 1, backgroundColor: "#fff", borderRadius: 20, justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ justifyContent: "center", alignItems: "center" }}>
                            <Text style={{ textAlign: "center" }}>Allow https://{origin} to spend your {tokenInfo?.symbol} </Text>
                        </View>
                        <View>
                            <Text>From: {from}</Text>
                            <Text>To: {to}</Text>
                            <Text>Method: {method}</Text>
                            <Text>Amount: {tokenInfo ? amount : value} {tokenInfo && tokenInfo?.symbol}</Text>
                        </View>
                        <Text>Transaction Fee: {fee ? fee.toString() : ""} BNB</Text>
                        <View style={{ flexDirection: "row" }}>
                            <Text style={{ flex: 1 }}>Gas Price</Text>
                            <Text style={{ flex: 1 }}>Gas Limit</Text>
                        </View>
                        <View style={{ borderRadius: 2, flexDirection: "row" }}>
                            <TextInput
                                value={gasPrice ? gasPrice.toString() : ""}
                                style={{ borderWidth: 1, flex: 1, paddingVertical: 5 }}
                                onChangeText={this.onChangeGasPrice}
                            />
                            <TextInput
                                value={gasLimit ? gasLimit.toString() : ""}
                                style={{ borderWidth: 1, flex: 1, paddingVertical: 5 }}
                                onChangeText={this.onChangeGasLimit}
                            />
                        </View>
                        <View>
                            <Text style={{ color: "red" }}>{Insufficient ? "" : "Insufficient balance"}</Text>
                        </View>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1 }}>
                            <TouchableOpacity
                                style={{ paddingHorizontal: 50, paddingVertical: 20 }}
                                onPress={reject}
                            >
                                <Text style={{ color: "red" }}>Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ paddingHorizontal: 50, paddingVertical: 20 }}
                                onPress={this.onAccept}
                            >
                                <Text>Accept</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        )
    }
}

const DecodeInput = (input) => new Promise((resolve, reject) => {
    try {
        const decoder = new InputDataDecoder(ABI);
        var result = decoder.decodeData(input);
        resolve(result);
    } catch (error) {
        reject(error)
    }
})