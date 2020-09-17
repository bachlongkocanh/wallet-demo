import React, { Component } from 'react';
import { Text, View, StyleSheet, SafeAreaView, Platform, InteractionManager } from 'react-native';
import { WebView, WebViewMessageEvent, FileDownload } from 'react-native-webview';
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
import ApprovalDialog from './approvalDialog'
let uri = "https://app.uniswap.org/#/swap"
uri = "https://citizen.poc.me/login";
export default class Web extends Component {

    state = {
        entryScript: null,
        fullHostname: null,
        showApprovalDialog: false,
        currentPageTitle: '',
        currentPageUrl: '',
        currentPageIcon: undefined,
        selectedAddress: "0x7c0C79776E463f1a7da96a0aFF325743Dd3D7082"
    }

    entryScript;
    componentDidMount = () => {
        const hasProtocol = uri.match(/^[a-z]*:\/\//) || this.isHomepage(uri);
        const sanitizedURL = hasProtocol ? uri : `${this.props.defaultProtocol}${uri}`;
        const { hostname, query, pathname } = new URL(sanitizedURL);
        this.setState({ fullHostname: hostname })
        this.init();
    }
    approvalRequest
    backgroundBridges = [];

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
        Engine.context.TransactionController.hub.on('networkChange', this.reload);
        // this.reload()
    }

    reload = () => {
        console.log("network change")
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
                eth_requestAccounts: async () => {
                    console.log("eth_requestAccounts")
                    const { params } = req;
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
                    console.log("personal_sign")
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
            // console.log("origin", origin)
            this.initializeBackgroundBridge(origin, true)
        }
    }

    webviewUrlPostMessagePromiseResolve = null;

    onLoadEnd = () => {
        // console.log("onLoadEnd")
        const { current } = this.webview;
        current && current.injectJavaScript(JS_WEBVIEW_URL);
        const promiseResolver = resolve => {
            this.webviewUrlPostMessagePromiseResolve = resolve;
        };
        const promise = current ? new Promise(promiseResolver) : Promise.resolve(url);

    }

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

    render() {
        const { entryScript, fullHostname, showApprovalDialog, currentPageIcon, currentPageTitle, currentPageUrl, selectedAddress } = this.state;
        return (
            <SafeAreaView
                style={styles.container}
                {...Platform.OS === "android" ? { collapsable: false } : {}}
            >
                {entryScript !== null &&
                    <WebView
                        source={{ uri }}
                        ref={this.webview}
                        // injectedJavaScript={entryScript}
                        // injectedJavaScriptBeforeContentLoadedForMainFrameOnly={true}
                        injectedJavaScriptBeforeContentLoaded={entryScript}
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