/* eslint-disable import/no-commonjs */
import URL from 'url-parse';
import { JS_POST_MESSAGE_TO_PROVIDER, JS_IFRAME_POST_MESSAGE_TO_PROVIDER } from './browserScript';
import MobilePortStream from './MobilePortStream';
import { setupMultiplex } from './streams';
import { createOriginMiddleware, createLoggerMiddleware } from './middlewares';
import Engine from './Engine';
import NetworkList from './networks';
const ObservableStore = require('obs-store');
const RpcEngine = require('json-rpc-engine');
const createEngineStream = require('json-rpc-middleware-stream/engineStream');
const createFilterMiddleware = require('eth-json-rpc-filters');
const createSubscriptionManager = require('eth-json-rpc-filters/subscriptionManager');
const providerAsMiddleware = require('eth-json-rpc-middleware/providerAsMiddleware');
const pump = require('pump');
const asStream = require('obs-store/lib/asStream');
// eslint-disable-next-line import/no-nodejs-modules
const EventEmitter = require('events').EventEmitter;

/**
 * Module that listens for and responds to messages from an InpageBridge using postMessage
 */

class Port extends EventEmitter {
	constructor(window, isMainFrame) {
		super();
		this._window = window;
		this._isMainFrame = isMainFrame;
	}

	postMessage = (msg, origin = '*') => {
		const js = this._isMainFrame
			? JS_POST_MESSAGE_TO_PROVIDER(msg, origin)
			: JS_IFRAME_POST_MESSAGE_TO_PROVIDER(msg, origin);
		if (this._window.webViewRef && this._window.webViewRef.current) {
			this._window && this._window.injectJavaScript(js);
		}
	};
}

export class BackgroundBridge extends EventEmitter {
	constructor({ webview, url, getRpcMethodMiddleware, isMainFrame }) {
		super();
		this.url = url;
		this.hostname = new URL(url).hostname;
		this.isMainFrame = isMainFrame;
		this._webviewRef = webview && webview.current;

		this.createMiddleware = getRpcMethodMiddleware;
		this.provider = Engine.context.NetworkController.provider;
		this.blockTracker = this.provider._blockTracker;
		this.port = new Port(this._webviewRef, isMainFrame);

		this.engine = null;

		const portStream = new MobilePortStream(this.port, url);
		// setup multiplexing
		const mux = setupMultiplex(portStream);
		// connect features
		this.setupProviderConnection(mux.createStream('provider'));
		this.setupPublicConfig(mux.createStream('publicConfig'));
		Engine.context.NetworkController.subscribe(this.sendStateUpdate);
		Engine.context.PreferencesController.subscribe(this.sendStateUpdate);
	}

	sendStateUpdate = () => {
		this.emit('update');
	};

	onMessage = msg => {
		this.port.emit('message', { name: msg.name, data: msg.data });
	};

	onDisconnect = () => {
		this.port.emit('disconnect', { name: this.port.name, data: null });
	};

	/**
	 * A method for serving our ethereum provider over a given stream.
	 * @param {*} outStream - The stream to provide over.
	 */
	setupProviderConnection(outStream) {
		this.engine = this.setupProviderEngine();

		// setup connection
		const providerStream = createEngineStream({ engine: this.engine });

		pump(outStream, providerStream, outStream, err => {
			// handle any middleware cleanup
			this.engine._middleware.forEach(mid => {
				if (mid.destroy && typeof mid.destroy === 'function') {
					mid.destroy();
				}
			});
			if (err) console.log('Error with provider stream conn', err);
		});
	}

	/**
	 * A method for creating a provider that is safely restricted for the requesting domain.
	 **/
	setupProviderEngine() {
		const origin = this.hostname;
		// setup json rpc engine stack
		const engine = new RpcEngine();
		const provider = this.provider;
		const blockTracker = this.blockTracker;

		// create filter polyfill middleware
		const filterMiddleware = createFilterMiddleware({ provider, blockTracker });

		// create subscription polyfill middleware
		const subscriptionManager = createSubscriptionManager({ provider, blockTracker });
		subscriptionManager.events.on('notification', message => engine.emit('notification', message));

		// metadata
		engine.push(createOriginMiddleware({ origin }));
		engine.push(createLoggerMiddleware({ origin }));
		// filter and subscription polyfills
		engine.push(filterMiddleware);
		engine.push(subscriptionManager.middleware);
		// watch asset

		// user-facing RPC methods
		engine.push(
			this.createMiddleware({
				hostname: this.hostname
			})
		);

		// forward to metamask primary provider
		engine.push(providerAsMiddleware(provider));
		return engine;
	}

	/**
	 * A method for providing our public config info over a stream.
	 * This includes info we like to be synchronous if possible, like
	 * the current selected account, and network ID.
	 *
	 * Since synchronous methods have been deprecated in web3,
	 * this is a good candidate for deprecation.
	 *
	 * @param {*} outStream - The stream to provide public config over.
	 */
	setupPublicConfig(outStream) {
		const configStore = this.createPublicConfigStore();

		const configStream = asStream(configStore);

		pump(configStream, outStream, err => {
			configStore.destroy();
			configStream && configStream.destroy && configStream.destroy();
			if (err) {
				console.warn(err);
			}
		});
	}

	/**
	 * Constructor helper: initialize a public config store.
	 * This store is used to make some config info available to Dapps synchronously.
	 */
	createPublicConfigStore() {
		// subset of state for metamask inpage provider
		const publicConfigStore = new ObservableStore();

		const selectPublicState = ({ isUnlocked, selectedAddress, network }) => {
			const chainId = network ? `0x${parseInt(network, 10).toString(16)}` : network
			const result = {
				isUnlocked,
				networkVersion: network,
				chainId,
				selectedAddress,
				isEnabled: true,
			};
			return result;
		};

		const updatePublicConfigStore = memState => {
			if (!memState) {
				memState = this.getState();
			}
			const publicState = selectPublicState(memState);
			publicConfigStore.putState(publicState);
		};

		// setup memStore subscription hooks
		this.on('update', updatePublicConfigStore);
		updatePublicConfigStore(this.getState());

		publicConfigStore.destroy = () => {
			this.removeEventListener && this.removeEventListener('update', updatePublicConfigStore);
		};

		return publicConfigStore;
	}

	sendNotification(payload) {
		this.engine && this.engine.emit('notification', payload);
	}

	/**
	 * The metamask-state of the various controllers, made available to the UI
	 *
	 * @returns {Object} status
	 */
	getState() {
		const vault = Engine.context.KeyringController.state.vault;
		const { network, selectedAddress, provider } = Engine.datamodel.flatState;
		return {
			isInitialized: !!vault,
			isUnlocked: true,
			network,
			selectedAddress,
			chainId: provider.chainId
		};
	}
}

export default BackgroundBridge;



export const initState = {
	AppStateController: {},
	CachedBalancesController: {
		cachedBalances: {}
	},
	CurrencyController: {
		conversionDate: 1566547524.878,
		conversionRate: 193.33,
		currentCurrency: "usd",
		nativeCurrency: "ETH",
	},
	InfuraController: {
		infuraNetworkStatus: {
			kovan: "ok",
			mainnet: "ok",
			rinkeby: "ok",
			ropsten: "ok"
		}
	},
	KeyringController: {
		vault: '{"data":"dVdAi3XqcqObmb7i18AY2yCCPQaeyRX4NloGEFWzOmJ9DALVGS/b2Taqvgu2n+09GPt7L1oka77ce04Dxro9Py2E3Yq+SCaeI/IiHkEt9EF21llOXMHTy3lBlBH1Iqe/GJZ0G2RUIr4QqpRslZ+LZat0Y3bbZxUxU/0p8i4d8ZE36Mez1wfEHORJSv3CWc1J2Xg3YkVK9kKBPqeOkDlezbu3hMm1SNOaZOW9qFJYK8d63W13vg==","iv":"KYN+/dN7y9SF+NokZajBxg==","salt":"QppMHgzY1cflMuwCSvlJ1sNDWoZQsNDImi9vq1MnNfs="}'
	},
	NetworkController: {
		network: "66666",
		provider: { nickname: "", rpcTarget: "https://rpc.nexty.io", ticker: "NTY", type: "" },
		settings: { ticker: "NTY" }
	},
	OnboardingController: {
		seedPhraseBackedUp: true
	},
	PreferencesController: {
		accountTokens: {},
		assetImages: {},
		completedOnboarding: true,
		currentAccountTab: "history",
		currentLocale: "en",
		featureFlags: { privacyMode: true },
		firstTimeFlowType: "create",
		forgottenPassword: false,
		frequentRpcListDetail: [],
		identities: {},
		knownMethodData: {},
		lostIdentities: {},
		metaMetricsId: "0xba359264d53d48454f26f2f80d1eea26ca4d95ed166e806093482e743ef4d361",
		metaMetricsSendCount: 0,
		migratedPrivacyMode: false,
		participateInMetaMetrics: true,
		preferences: {
			useNativeCurrencyAsPrimaryCurrency: true
		},
		selectedAddress: null,
		suggestedTokens: {},
		tokens: [],
		useBlockie: false
	},
	TransactionController: {
	},
	config: {},
	firstTimeInfo: {
		date: 1566527505376,
		version: "7.0.1"
	}
};