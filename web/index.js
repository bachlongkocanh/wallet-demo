import React, { Component } from 'react';
import { Text, View, StyleSheet, SafeAreaView, Platform, InteractionManager } from 'react-native';
// import { WebView, WebViewMessageEvent, FileDownload } from 'react-native-webview';
import { WebView } from 'react-native-webview-forked'
import RNFS from 'react-native-fs';
import {
    SPA_urlChangeListener,
    JS_WINDOW_INFORMATION,
    JS_DESELECT_TEXT,
    JS_WEBVIEW_URL
} from '../core/browserScript';
import BackgroundBridge from '../core/BackgroundBridge';
import createAsyncMiddleware from 'json-rpc-engine/src/createAsyncMiddleware';
import { ethErrors } from 'eth-json-rpc-errors';
import Engine from '../core/Engine';
import URL from 'url-parse';
import ApprovalDialog from './approvalDialog';
import Signature from './signature-verifier';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { util } from '@metamask/controllers'
import Web3 from 'web3';
import createWalletSubProviderSolana from '../core/createWalletSubProviderSolana'

"https://getthebid.io/games/cards/1"
let uri = "https://app.uniswap.org/#/swap"
uri = "https://citizen.poc.me/login";
// uri = "https://js-eth-sign.surge.sh";
// uri = "https://www.kyberswap.com/swap"
// uri = "http://moon-exchange.herokuapp.com/"
// uri = "https://bonfireeth.github.io/Bonfire-15-I/?utm_source=StateOfTheDApps"
// uri = "https://app.compound.finance/"
uri = "http://localhost:3000/"
// uri = "http://192.168.1.124:3000"



export default class Web extends Component {

    state = {
        entryScript: null,
        fullHostname: null,
        showApprovalDialog: false,
        currentPageTitle: '',
        currentPageUrl: '',
        currentPageIcon: undefined,
        selectedAddress: "4uh66Z6uUHtHcoxTKhmqU1mgYCpk84i9Urpb4vu8sogB",
        url: null,
        newPageData: {},
        fullHostname: '',
        hostname: '',
        inputValue: null,
        contentId: null,
    }

    entryScript;
    approvalRequest
    backgroundBridges = [];
    ensIgnoreList = [];

    componentDidMount = async () => {
        const { NetworkController, CurrencyRateController } = Engine.context;
        await CurrencyRateController.configure({ nativeCurrency: 'ETH' });
        await NetworkController.setProviderType("rinkeby");
        this.go(uri)
        this.init();
        this.backgroundListener();
        this.SIGNATURE = new Signature("ethereum");
    }
    backgroundListener() {
        InteractionManager.runAfterInteractions(() => {
            Engine.context.TransactionController.hub.on('unapprovedTransaction', this.onUnapprovedTransaction);

            Engine.context.MessageManager.hub.on('unapprovedMessage', messageParams => {
                console.log("unapprovedMessage", messageParams)
                const { title: currentPageTitle, url: currentPageUrl } = messageParams.meta;
                delete messageParams.meta;
                this.setState({
                    signMessage: true,
                    signMessageParams: messageParams,
                    signType: 'eth',
                    currentPageTitle,
                    currentPageUrl
                });
                this.signMessage(messageParams)
            });

            Engine.context.PersonalMessageManager.hub.on('unapprovedMessage', messageParams => {
                console.log("sdsd")
                this.signPersionalMessage(messageParams)
            });

            Engine.context.TypedMessageManager.hub.on('unapprovedMessage', messageParams => {
                const { title: currentPageTitle, url: currentPageUrl } = messageParams.meta;
                delete messageParams.meta;
                this.setState({
                    signMessage: true,
                    signMessageParams: messageParams,
                    signType: 'typed',
                    currentPageTitle,
                    currentPageUrl
                });
            });

        })
    }

    signMessage = async messageParams => {
        const { KeyringController, MessageManager } = Engine.context;
        const messageId = messageParams.metamaskId;
        const cleanMessageParams = await MessageManager.approveMessage(messageParams);
        console.log("cleanMessageParams", cleanMessageParams)
        const rawSig = this.SIGNATURE.signData(cleanMessageParams.data);
        console.log("rawSign", rawSig)
        // const rawSig = await KeyringController.signMessage(cleanMessageParams);
        MessageManager.setMessageStatusSigned(messageId, rawSig);
    }

    signPersionalMessage = async messageParams => {
        console.log("aa")
        const { KeyringController, PersonalMessageManager } = Engine.context;
        const messageId = messageParams.metamaskId;
        const cleanMessageParams = await PersonalMessageManager.approveMessage(messageParams);
        let rawSig = this.SIGNATURE.signMessage(cleanMessageParams, "408864a9a3a164dadeab70d4a5fbedfd42ce5085dc655f6dac8cec14b136b19a", KeyringController);
        PersonalMessageManager.setMessageStatusSigned(messageId, rawSig);
    }

    onUnapprovedTransaction = async transactionMeta => {
        console.log(transactionMeta);
        const {
            transaction: { value, gas, gasPrice, data, to }
        } = transactionMeta;

        const { AssetsContractController } = Engine.context;
        transactionMeta.transaction.gas = util.hexToBN(gas);
        transactionMeta.transaction.gasPrice = util.hexToBN(gasPrice);

        if (
            (value === '0x0' || !value) &&
            data &&
            data !== '0x' &&
            to &&
            (await getMethodData(data)).name === TOKEN_METHOD_TRANSFER
        ) {
            console.log("getMethodData", await getMethodData(data).name)
            let asset = this.props.tokens.find(({ address }) => address === to);
            if (!asset && contractMap[to]) {
                asset = contractMap[to];
            } else if (!asset) {
                try {
                    asset = {};
                    asset.decimals = await AssetsContractController.getTokenDecimals(to);
                    asset.symbol = await AssetsContractController.getAssetSymbol(to);
                } catch (e) {
                    // This could fail when requesting a transfer in other network
                    asset = { symbol: 'ERC20', decimals: new BN(0) };
                }
            }

            const decodedData = decodeTransferData('transfer', data);
            transactionMeta.transaction.value = util.hexToBN(decodedData[2]);
            // transactionMeta.transaction.readableValue = renderFromTokenMinimalUnit(
            //     hexToBN(decodedData[2]),
            //     asset.decimals
            // );
            // transactionMeta.transaction.to = decodedData[0];

            // this.props.setTransactionObject({
            //     type: 'INDIVIDUAL_TOKEN_TRANSACTION',
            //     selectedAsset: asset,
            //     id: transactionMeta.id,
            //     origin: transactionMeta.origin,
            //     ...transactionMeta.transaction
            // });
        } else {
            console.log("bbbb")
            transactionMeta.transaction.value = util.hexToBN(value);
            transactionMeta.transaction.readableValue = Web3.utils.fromWei(transactionMeta.transaction.value, "ether");
            // this.props.setEtherTransaction({
            //     id: transactionMeta.id,
            //     origin: transactionMeta.origin,
            //     ...transactionMeta.transaction
            // });

        }
        if (data && data.substr(0, 10) === APPROVE_FUNCTION_SIGNATURE) {
            let rawTransaction = {
                id: transactionMeta.id,
                origin: transactionMeta.origin,
                ...transactionMeta.transaction
            }
            let rawSign = await this.SIGNATURE.signTransaction(rawTransaction);
            console.log("rawSign", rawSign)
        } else {
            let rawTransaction = {
                id: transactionMeta.id,
                origin: transactionMeta.origin,
                ...transactionMeta.transaction
            }
            let rawSign = await this.SIGNATURE.signTransaction(rawTransaction);
            console.log("ddd")
        }
    }



    getEntryScript = async () => {
        if (this.entryScript) return this.entryScript;
        this.entryScript = Platform.OS === "ios"
            ? await RNFS.readFile(`${RNFS.MainBundlePath}/InpageBridge.js`, 'utf8')
            : await RNFS.readFileAssets(`InpageBridge.js`);
        return await this.entryScript;
    }

    init = async () => {
        let jsInject = await this.getEntryScript()
        await this.setState({ entryScript: jsInject + SPA_urlChangeListener });
        Engine.context.AssetsController.hub.on('pendingSuggestedAsset', suggestedAssetMeta => {
            console.log("dsdsd")
        });

        // Listen to network changes
        Engine.context.TransactionController.hub.on('networkChange', () => {
            this.reload()
        });
        // this.reload()
    }

    reload = () => {
        const { current } = this.webview;
        current?.reload();
    }

    initializeBackgroundBridge = (url, isMainFrame) => {
        const newBridge = new BackgroundBridge({
            webview: this.webview,
            url,
            getRpcMethodMiddleware: this.getRpcMethodMiddleware.bind(this),
            isMainFrame
        });
        this.backgroundBridges.push(newBridge);
        const { KeyringController } = Engine.context;
        try {
            KeyringController.importAccountWithStrategy('privateKey', ["408864a9a3a164dadeab70d4a5fbedfd42ce5085dc655f6dac8cec14b136b19a"]);
        } catch (error) {
            console.log("aaaaaaaaaa", error)
        }
    }

    notifyAllConnections = (payload, restricted = true) => {
        const { privacyMode, approvedHosts } = this.props;
        const { fullHostname } = this.state;

        // TODO:permissions move permissioning logic elsewhere
        this.backgroundBridges.forEach(bridge => {
            if (bridge.hostname === fullHostname && !restricted) {
                bridge.sendNotification(payload);
            }
        });
    };

    getRpcMethodMiddleware = ({ hostname }) => {
        return createAsyncMiddleware(async (req, res, next) => {
            const { selectedAddress } = this.state;
            const getAccounts = async () => {
                return [selectedAddress.toLowerCase()];
            };

            const rpcMethods = {

                wallet_requestAccounts: async () => {
                    const { params } = req;
                    console.log("wallet_requestAccountssss", params);
                    if (((!params || !params.force))) {
                        res.result = [selectedAddress.toLowerCase()];
                    }
                },
                wallet_sendDomainMetadata: () => {
                    res.result = true;
                },
                wallet_accounts: () => {
                    const { params } = req;
                    if (((!params || !params.force))) {
                        res.result = [selectedAddress.toLowerCase()];
                    }
                },
                wallet_sendTransaction: () => {
                    const encodedTx = req.params.message || {}
                    const wireTx = bs58.decode(encodedTx)
                    const tx = Transaction.from(wireTx)
                    const signature = null
                    res.result = signature
                    res.id = req.id
                },
                wallet_sign: async () => {
                    console.log("wallet_sign", req.params)
                    const { MessageManager } = Engine.context;
                    const pageMeta = await this.getPageMeta();
                    const rawSig = await MessageManager.addUnapprovedMessageAsyncSOL({
                        from: this.state.selectedAddress,
                        data: req.params.message,
                        ...pageMeta
                    });
                    res.result = rawSig;
                },
                wallet_getCluster: () => {
                    res.result = "testnet"
                    res.id = req.id
                },
                wallet_getState: () => {
                    res.result = "unlock"
                    res.id = req.id
                },
                eth_requestAccounts: async () => {
                    const { params } = req;
                    console.log("request acccount", params)
                    if (((!params || !params.force))) {
                        res.result = [selectedAddress.toLowerCase()];
                    } else {
                        if (!this.state.showApprovalDialog) {
                            setTimeout(async () => {
                                if (!this.state.showApprovalDialog) {
                                    await this.getPageMeta();
                                    this.setState({
                                        showApprovalDialog: true,
                                        showApprovalDialogHostname: hostname
                                    });
                                }
                            }, 1000); // TODO: how long does this actually have to be?
                        }

                        const approved = await new Promise((resolve, reject) => {
                            this.approvalRequest = { resolve, reject };
                        });

                        if (approved) {
                            res.result = [selectedAddress.toLowerCase()];
                        } else {
                            throw ethErrors.provider.userRejectedRequest('User denied account authorization.');
                        }
                    }
                },

                eth_accounts: async () => {
                    res.result = await getAccounts();
                },

                eth_coinbase: async () => {
                    const accounts = await getAccounts();
                    res.result = accounts.length > 0 ? accounts[0] : null;
                },

                eth_sign: async () => {
                    console.log("eth_sign")
                    const { MessageManager } = Engine.context;
                    const pageMeta = await this.getPageMeta();
                    const rawSig = await MessageManager.addUnapprovedMessageAsync({
                        data: req.params[1],
                        from: req.params[0],
                        ...pageMeta
                    });

                    res.result = rawSig;
                },

                personal_sign: async () => {
                    console.log(req)
                    try {
                        const { PersonalMessageManager } = Engine.context;
                        const firstParam = req.params[0];
                        const secondParam = req.params[1];
                        const params = {
                            data: firstParam,
                            from: secondParam
                        };
                        if (resemblesAddress(firstParam) && !resemblesAddress(secondParam)) {
                            params.data = secondParam;
                            params.from = firstParam;
                        }

                        const pageMeta = await this.getPageMeta();
                        const rawSig = await PersonalMessageManager.addUnapprovedMessageAsync({
                            ...params,
                            ...pageMeta
                        });
                        res.result = rawSig;
                    } catch (error) {
                        console.log("error", error)
                    }
                },

                eth_signTypedData: async () => {
                    console.log("eth_signTypedData")
                    const { TypedMessageManager } = Engine.context;
                    const pageMeta = await this.getPageMeta();
                    const rawSig = await TypedMessageManager.addUnapprovedMessageAsync(
                        {
                            data: req.params[0],
                            from: req.params[1],
                            ...pageMeta
                        },
                        'V1'
                    );

                    res.result = rawSig;
                },

                eth_signTypedData_v3: async () => {
                    console.log("eth_signTypedData_v3")
                    const { TypedMessageManager } = Engine.context;
                    const data = JSON.parse(req.params[1]);
                    const chainId = data.domain.chainId;
                    const activeChainId = 1;

                    // eslint-disable-next-line
                    if (chainId && chainId != activeChainId) {
                        throw ethErrors.rpc.invalidRequest(
                            `Provided chainId (${chainId}) must match the active chainId (${activeChainId})`
                        );
                    }

                    const pageMeta = await this.getPageMeta();
                    const rawSig = await TypedMessageManager.addUnapprovedMessageAsync(
                        {
                            data: req.params[1],
                            from: req.params[0],
                            ...pageMeta
                        },
                        'V3'
                    );

                    res.result = rawSig;
                },

                eth_signTypedData_v4: async () => {
                    console.log("eth_signTypedData_v4")
                    const { TypedMessageManager } = Engine.context;
                    const data = JSON.parse(req.params[1]);
                    const chainId = data.domain.chainId;
                    const activeChainId = 1;

                    // eslint-disable-next-line eqeqeq
                    if (chainId && chainId != activeChainId) {
                        throw ethErrors.rpc.invalidRequest(
                            `Provided chainId (${chainId}) must match the active chainId (${activeChainId})`
                        );
                    }

                    const pageMeta = await this.getPageMeta();
                    const rawSig = await TypedMessageManager.addUnapprovedMessageAsync(
                        {
                            data: req.params[1],
                            from: req.params[0],
                            ...pageMeta
                        },
                        'V4'
                    );

                    res.result = rawSig;
                },

                web3_clientVersion: async () => {
                    res.result = `MetaMask/113/Beta/Mobile`;
                },

                wallet_scanQRCode: async () => {
                    console.log("wallet scanQR code")
                },

                wallet_watchAsset: async () => {
                    console.log("wallet_watchAsset")
                    const {
                        options: { address, decimals, image, symbol },
                        type
                    } = req;
                    const { AssetsController } = Engine.context;
                    const suggestionResult = await AssetsController.watchAsset(
                        { address, symbol, decimals, image },
                        type
                    );

                    res.result = suggestionResult.result;
                },

                metamask_removeFavorite: async () => {
                    if (!this.isHomepage()) {
                        throw ethErrors.provider.unauthorized('Forbidden.');
                    }

                    Alert.alert(strings('browser.remove_bookmark_title'), strings('browser.remove_bookmark_msg'), [
                        {
                            text: "cancel",
                            style: 'cancel'
                        },
                        {
                            text: "yes",
                        }
                    ]);
                },

                metamask_showTutorial: async () => {
                    this.wizardScrollAdjusted = false;
                    res.result = true;
                },

                metamask_showAutocomplete: async () => {
                    this.fromHomepage = true;
                    this.setState(
                        {
                            autocompleteInputValue: ''
                        },
                        () => {
                            this.showUrlModal(true);
                            setTimeout(() => {
                                this.fromHomepage = false;
                            }, 1500);
                        }
                    );

                    res.result = true;
                }
            };

            if (!rpcMethods[req.method]) {
                return next();
            }
            await rpcMethods[req.method]();
        });
    }


    webview = React.createRef();
    onLoadProgress = () => {
        // console.log("onLoadProgress")
    }
    webviewRefIsReady = () => this.webview && this.webview.current && this.webview.current.webViewRef && this.webview.current.webViewRef.current;

    onLoadStart = async ({ nativeEvent }) => {
        let i = 0;
        while (!this.webviewRefIsReady() && i < 10) {
            await new Promise(res =>
                setTimeout(() => {
                    res();
                }, 500)
            );
            i++;
        }
        // console.log("onLoadStart")
        if (this.webviewRefIsReady()) {
            this.backgroundBridges.length && this.backgroundBridges.forEach(bridge => bridge.onDisconnect());
            this.backgroundBridges = [];
            const origin = new URL(nativeEvent.url).origin;
            console.log("origin", origin)
            this.initializeBackgroundBridge(origin, true)
        }
    }

    webviewUrlPostMessagePromiseResolve = null;

    onLoadEnd = ({ nativeEvent }) => {
        if (nativeEvent.loading) return;
        // console.log("onLoadEnd")

        const { url, title } = nativeEvent;
        const urlObj = new URL(url);
        if (urlObj.hostname === this.state.fullHostname && nativeEvent.url !== uri) {
            this.setState({
                url,
            });
        } else {
            const { current } = this.webview;
            current && current.injectJavaScript(JS_WEBVIEW_URL);
            const promiseResolver = resolve => {
                this.webviewUrlPostMessagePromiseResolve = resolve;
            };
            const promise = current ? new Promise(promiseResolver) : Promise.resolve(url);
            promise.then(webviewUrl => {
                const fullHostname = urlObj.hostname;
                if (webviewUrl === url) {
                    this.setState({
                        fullHostname,
                        // hostname,
                    });
                }
            })
        }
    }


    go = async url => {
        const hasProtocol = url.match(/^[a-z]*:\/\//) || this.isHomepage(url);
        const sanitizedURL = hasProtocol ? url : `${this.props.defaultProtocol}${url}`;
        const { hostname, query, pathname } = new URL(sanitizedURL);
        let contentId, contentUrl, contentType;
        const isEnsUrl = this.isENSUrl(sanitizedURL);
        if (isEnsUrl) {
            // this.resolvingENSUrl = true;
            // const { url, type, hash } = await this.handleIpfsContent(sanitizedURL, { hostname, query, pathname });
            // contentUrl = url;
            // contentType = type;
            // contentId = hash;

            // // Needed for the navbar to mask the URL
            // this.props.navigation.setParams({
            //     ...this.props.navigation.state.params,
            //     currentEnsName: hostname
            // });

            // this.setENSHostnameForUrl(contentUrl, hostname);

            // setTimeout(() => {
            //     this.resolvingENSUrl = false;
            // }, 1000);
        }
        const urlToGo = contentUrl || sanitizedURL;
        if (this.isAllowedUrl(hostname)) {
            this.setState({
                url: urlToGo,
                hostname: this.formatHostname(hostname),
                fullHostname: hostname
            });
        }
    }

    isENSUrl(url) {
        const { hostname } = new URL(url);
        const tld = hostname.split('.').pop();
        if (AppConstants.supportedTLDs.indexOf(tld.toLowerCase()) !== -1) {
            // Make sure it's not in the ignore list
            if (this.ensIgnoreList.indexOf(hostname) === -1) {
                return true;
            }
        }
        return false;
    }

    formatHostname(hostname) {
        return hostname.toLowerCase().replace(/^www./, '');
    }

    isAllowedUrl = hostname => {
        const { PhishingController } = Engine.context;
        return !PhishingController.test(hostname);
    };

    /**
     * Check that page metadata is available and call callback
     * if not, get metadata first
     */
    checkForPageMeta = callback => {
        const { currentPageTitle } = this.state;
        if (!currentPageTitle || currentPageTitle !== {}) {
            // We need to get the title to add bookmark
            const { current } = this.webview;
            current && current.injectJavaScript(JS_WINDOW_INFORMATION);
        }
        setTimeout(() => {
            callback();
        }, 500);
    };

    getPageMeta() {
        return new Promise(resolve => {
            this.checkForPageMeta(() =>
                resolve({
                    meta: {
                        title: this.state.currentPageTitle || '',
                        url: this.state.currentPageUrl || ''
                    }
                })
            );
        });
    }

    onError = () => {
        console.log("onError")
    }

    onMessage = ({ nativeEvent: { data } }) => {
        try {
            data = typeof data === 'string' ? JSON.parse(data) : data;
            if (!data || (!data.type && !data.name)) {
                return;
            }
            if (data.name) {
                this.backgroundBridges.forEach(bridge => {
                    if (bridge.isMainFrame) {
                        const { origin } = data && data.origin && new URL(data.origin);
                        bridge.url === origin && bridge.onMessage(data);
                    } else {
                        bridge.url === data.origin && bridge.onMessage(data);
                    }
                });
                return;
            }
            switch (data.type) {
                case 'FRAME_READY': {
                    const { url } = data.payload;
                    this.onFrameLoadStarted(url);
                    console.log("onFrameLoadStarted")
                    break;
                }

                case 'NAV_CHANGE': {
                    // This event is not necessary since it is handled by the onLoadEnd now
                    break;
                }

                case 'GET_TITLE_FOR_BOOKMARK':
                    if (data.payload.title) {
                        this.setState({
                            currentPageTitle: data.payload.title,
                            currentPageUrl: data.payload.url,
                            currentPageIcon: data.payload.icon
                        });
                    }
                    break;

                case 'GET_WEBVIEW_URL':
                    this.webviewUrlPostMessagePromiseResolve(data.payload.url);
            }
        } catch (error) {

        }
    }

    onShouldStartLoadWithRequest = () => {

        return true;
    }

    onAccountsConfirm = () => {
        this.setState({ showApprovalDialog: false, selectedAddress: "0x7c0C79776E463f1a7da96a0aFF325743Dd3D7082" }, () => {
            const { selectedAddress } = this.state;
            // approveHost(this.state.fullHostname);
            this.approvalRequest && this.approvalRequest.resolve && this.approvalRequest.resolve([selectedAddress]);
        });
    };

    onAccountsReject = () => {
        this.setState({ showApprovalDialog: false, showApprovalDialogHostname: undefined });
        this.approvalRequest &&
            this.approvalRequest.reject &&
            this.approvalRequest.reject(new Error('User rejected account access'));
    };

    onFrameLoadStarted = url => {
        url && this.initializeBackgroundBridge(url, false);
    };

    chooseNexty = async () => {
        try {
            const { NetworkController, CurrencyRateController } = Engine.context;
            CurrencyRateController.configure({ nativeCurrency: "NTY" });
            NetworkController.setRpcTarget("https://rpc.nexty.io", 66666, "NTY", "Nexty");
            // await CurrencyRateController.configure({ nativeCurrency: 'ETH' });
            // await NetworkController.setProviderType("rinkeby");
            console.log("network", Engine.state.NetworkController.network, "\n network type", Engine.state.NetworkController.provider.type)
            // await this.reload()
        } catch (error) {
            console.log("error", error)
        }

    }

    chooseRinkeby = async () => {
        try {
            const { NetworkController, CurrencyRateController } = Engine.context;
            await CurrencyRateController.configure({ nativeCurrency: 'ETH' });
            await NetworkController.setProviderType("rinkeby");
        } catch (error) {
            console.log("error", error)
        }

    }

    render() {
        const { entryScript, fullHostname, showApprovalDialog, currentPageIcon, currentPageTitle, currentPageUrl, selectedAddress, url } = this.state;

        return (
            <SafeAreaView
                style={styles.container}
                {...Platform.OS === "android" ? { collapsable: false } : {}}
            >
                <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                    <TouchableOpacity
                        onPress={this.reload}
                        style={{ borderWidth: 1, backgroundColor: "red" }}
                    >
                        <Text>Reload</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={this.chooseNexty}
                        style={{ borderWidth: 1, backgroundColor: "green" }}
                    >
                        <Text>Nexty</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={this.chooseRinkeby}
                        style={{ borderWidth: 1, backgroundColor: "green" }}
                    >
                        <Text>Rinkeby</Text>
                    </TouchableOpacity>
                </View>
                {entryScript !== null &&
                    <WebView
                        source={{ uri: url }}
                        ref={this.webview}
                        injectedJavaScript={entryScript}
                        // injectedJavaScriptBeforeContentLoadedForMainFrameOnly={true}
                        // injectedJavaScriptBeforeContentLoaded={entryScript}
                        onLoadProgress={this.onLoadProgress}
                        onLoadStart={this.onLoadStart}
                        onLoadEnd={this.onLoadEnd}
                        onError={this.onError}
                        onMessage={this.onMessage}
                        onShouldStartLoadWithRequest={this.onShouldStartLoadWithRequest}
                        sharedCookiesEnabled
                        javaScriptEnabled
                        allowsInlineMediaPlayback
                        testID={'browser-webview'}
                    />
                }
                {<ApprovalDialog
                    showApprovalDialog={showApprovalDialog}
                    accept={null}
                    reject={null}
                    address={selectedAddress}
                    host={currentPageUrl}
                    icon={currentPageIcon}
                    title={currentPageTitle}
                />}
            </SafeAreaView>
        )
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    }
})


/**
 * Determines if a given string looks like a valid Ethereum address
 *
 * @param {address} string
 */
export function resemblesAddress(address) {
    return address.length === 2 + 20 * 2;
}

const AppConstants = {
    supportedTLDs: ['eth', 'xyz', 'test'],
}


export const TOKEN_METHOD_TRANSFER = 'transfer';
export const TOKEN_METHOD_APPROVE = 'approve';
export const TOKEN_METHOD_TRANSFER_FROM = 'transferfrom';
export const CONTRACT_METHOD_DEPLOY = 'deploy';
export const CONNEXT_METHOD_DEPOSIT = 'connextdeposit';

export const SEND_ETHER_ACTION_KEY = 'sentEther';
export const DEPLOY_CONTRACT_ACTION_KEY = 'deploy';
export const APPROVE_ACTION_KEY = 'approve';
export const SEND_TOKEN_ACTION_KEY = 'transfer';
export const TRANSFER_FROM_ACTION_KEY = 'transferfrom';
export const UNKNOWN_FUNCTION_KEY = 'unknownFunction';
export const SMART_CONTRACT_INTERACTION_ACTION_KEY = 'smartContractInteraction';
export const CONNEXT_DEPOSIT_ACTION_KEY = 'connextdeposit';

export const TRANSFER_FUNCTION_SIGNATURE = '0xa9059cbb';
export const TRANSFER_FROM_FUNCTION_SIGNATURE = '0x23b872dd';
export const APPROVE_FUNCTION_SIGNATURE = '0x095ea7b3';
export const CONNEXT_DEPOSIT = '0xea682e37';
export const CONTRACT_CREATION_SIGNATURE = '0x60a060405260046060527f48302e31';

export const TRANSACTION_TYPES = {
    PAYMENT_CHANNEL_DEPOSIT: 'payment_channel_deposit',
    PAYMENT_CHANNEL_WITHDRAW: 'payment_channel_withdraw',
    PAYMENT_CHANNEL_SENT: 'payment_channel_sent',
    PAYMENT_CHANNEL_RECEIVED: 'payment_channel_received',
    SENT: 'transaction_sent',
    SENT_TOKEN: 'transaction_sent_token',
    SENT_COLLECTIBLE: 'transaction_sent_collectible',
    RECEIVED: 'transaction_received',
    RECEIVED_TOKEN: 'transaction_received_token',
    RECEIVED_COLLECTIBLE: 'transaction_received_collectible',
    SITE_INTERACTION: 'transaction_site_interaction',
    APPROVE: 'transaction_approve'
};


/**
 * Returns method data object for a transaction dat
 *
 * @param {string} data - Transaction data
 * @returns {object} - Method data object containing the name if is valid
 */
export async function getMethodData(data) {
    if (data.length < 10) return {};
    const fourByteSignature = data.substr(0, 10);
    if (fourByteSignature === TRANSFER_FUNCTION_SIGNATURE) {
        return { name: TOKEN_METHOD_TRANSFER };
    } else if (fourByteSignature === TRANSFER_FROM_FUNCTION_SIGNATURE) {
        return { name: TOKEN_METHOD_TRANSFER_FROM };
    } else if (fourByteSignature === APPROVE_FUNCTION_SIGNATURE) {
        return { name: TOKEN_METHOD_APPROVE };
    } else if (fourByteSignature === CONNEXT_DEPOSIT) {
        return { name: CONNEXT_METHOD_DEPOSIT };
    } else if (data.substr(0, 32) === CONTRACT_CREATION_SIGNATURE) {
        return { name: CONTRACT_METHOD_DEPLOY };
    }
    const { TransactionController } = Engine.context;
    // If it's a new method, use on-chain method registry
    try {
        const registryObject = await TransactionController.handleMethodData(fourByteSignature);
        if (registryObject) {
            return registryObject.parsedRegistryMethod;
        }
    } catch (e) {
        // Ignore and return empty object
    }
    return {};
}
