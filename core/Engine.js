import {
    AccountTrackerController,
    AddressBookController,
    AssetsContractController,
    AssetsController,
    AssetsDetectionController,
    ComposableController,
    CurrencyRateController,
    KeyringController,
    PersonalMessageManager,
    MessageManager,
    NetworkController,
    NetworkStatusController,
    PhishingController,
    PreferencesController,
    TokenBalancesController,
    TokenRatesController,
    TransactionController,
    TypedMessageManager,
    NetworkType
} from '@ezdefi/controllers';

import AsyncStorage from '@react-native-community/async-storage';
import Encryptor from './Encryptor';
import { toChecksumAddress } from 'ethereumjs-util';
import Networks from './networks';
import contractMap from 'eth-contract-metadata'

// const OPENSEA_API_KEY = process.env.MM_OPENSEA_KEY;
const encryptor = new Encryptor();
let refreshing = false;
/**
 * Core controller responsible for composing other metamask controllers together
 * and exposing convenience methods for common wallet operations.
 */
class Engine {
    /**
     * ComposableController reference containing all child controllers
     */
    datamodel;

    /**
     * Object containing the info for the latest incoming tx block
     * for each address and network
     */
    lastIncomingTxBlockInfo;

    /**
     * Creates a CoreController instance
     */
    constructor(initialState = {}) {
        if (!Engine.instance) {
            const { nativeCurrency, currentCurrency } = initialState.CurrencyRateController || {
                nativeCurrency: 'eth',
                currentCurrency: 'usd'
            };

            this.datamodel = new ComposableController(
                [
                    new KeyringController({}, initialState.KeyringController),
                    new AccountTrackerController(),
                    new AddressBookController(),
                    new AssetsContractController(),
                    new AssetsController(),
                    new AssetsDetectionController(),
                    new CurrencyRateController({
                        nativeCurrency,
                        currentCurrency
                    }),
                    new PersonalMessageManager(),
                    new MessageManager(),
                    new NetworkController(
                        {
                            providerConfig: {
                                static: {
                                    eth_sendTransaction: async (payload, next, end) => {
                                        const { TransactionController } = this.datamodel.context;
                                        try {
                                            const hash = await (await TransactionController.addTransaction(
                                                payload.params[0],
                                                payload.origin
                                            )).result;
                                            end(undefined, hash);
                                        } catch (error) {
                                            end(error);
                                        }
                                    }
                                },
                                getAccounts: (end, payload) => {
                                    // const { approvedHosts, privacyMode } = store.getState();
                                    const isEnabled = true
                                    const { KeyringController } = this.datamodel.context;
                                    const isUnlocked = KeyringController.isUnlocked();
                                    console.log("isUnlocked", isUnlocked)
                                    const selectedAddress = this.datamodel.context.PreferencesController.state
                                        .selectedAddress;
                                    end(null, isUnlocked && isEnabled && selectedAddress ? [selectedAddress] : []);
                                }
                            },
                            infuraProjectId: "c35d29e3edf64e099bce0102aed4e81a"
                        },
                        { network: '1', provider: { type: 'mainnet' } }
                    ),
                    new NetworkStatusController(),
                    new PhishingController(),
                    new PreferencesController(
                        {},
                        {
                            ipfsGateway: "https://cloudflare-ipfs.com/ipfs/"
                        }
                    ),
                    new TokenBalancesController(),
                    new TokenRatesController(),
                    new TransactionController(),
                    new TypedMessageManager()
                ],
                initialState
            );

            const {
                AssetsController: assets,
                KeyringController: keyring,
                NetworkController: network,
                TransactionController: transaction
            } = this.datamodel.context;

            // assets.setApiKey(OPENSEA_API_KEY);
            network.refreshNetwork();
            transaction.configure({ sign: keyring.signTransaction.bind(keyring) });
            network.subscribe(this.refreshNetwork);
            this.configureControllersOnNetworkChange();
            keyring.createNewVaultAndKeychain("");
            Engine.instance = this;
        }
        return Engine.instance;
    }

    configureControllersOnNetworkChange() {
        const {
            AccountTrackerController,
            AssetsContractController,
            AssetsDetectionController,
            NetworkController: { provider },
            TransactionController
        } = this.datamodel.context;

        provider.sendAsync = provider.sendAsync.bind(provider);
        AccountTrackerController.configure({ provider });
        AccountTrackerController.refresh();
        AssetsContractController.configure({ provider });
        TransactionController.configure({ provider });
        TransactionController.hub.emit('networkChange');
        AssetsDetectionController.detectAssets();
    }

    /**
     * Refreshes all controllers that depend on the network
     */
    refreshNetwork = () => {
        if (!refreshing) {
            refreshing = true;
            setTimeout(() => {
                this.configureControllersOnNetworkChange();
                refreshing = false;
            }, 500);
        }
    };



    resetState = async () => {
        // Whenever we are gonna start a new wallet
        // either imported or created, we need to
        // get rid of the old data from state
        const {
            TransactionController,
            AssetsController,
            TokenBalancesController,
            TokenRatesController
        } = this.datamodel.context;

        //Clear assets info
        AssetsController.update({
            allCollectibleContracts: {},
            allCollectibles: {},
            allTokens: {},
            collectibleContracts: [],
            collectibles: [],
            ignoredCollectibles: [],
            ignoredTokens: [],
            suggestedAssets: [],
            tokens: []
        });

        TokenBalancesController.update({ contractBalances: {} });
        TokenRatesController.update({ contractExchangeRates: {} });

        TransactionController.update({
            internalTransactions: [],
            methodData: {},
            transactions: []
        });
    };

    sync = async ({ accounts, preferences, network, transactions, seed, pass, importedAccounts }) => {
        const {
            KeyringController,
            PreferencesController,
            NetworkController,
            TransactionController,
            AssetsController
        } = this.datamodel.context;

        // Select same network ?
        await NetworkController.setProviderType(network.provider.type);

        // Recreate accounts
        await KeyringController.createNewVaultAndRestore(pass, seed);
        for (let i = 0; i < accounts.hd.length - 1; i++) {
            await KeyringController.addNewAccount();
        }

        // Recreate imported accounts
        if (importedAccounts) {
            for (let i = 0; i < importedAccounts.length; i++) {
                await KeyringController.importAccountWithStrategy('privateKey', [importedAccounts[i]]);
            }
        }
        // Sync tokens
        const allTokens = {};
        Object.keys(preferences.accountTokens).forEach(address => {
            const checksummedAddress = toChecksumAddress(address);
            allTokens[checksummedAddress] = {};
            Object.keys(preferences.accountTokens[address]).forEach(
                networkType =>
                    (allTokens[checksummedAddress][networkType] =
                        networkType !== 'mainnet'
                            ? preferences.accountTokens[address][networkType]
                            : preferences.accountTokens[address][networkType]
                                .filter(({ address }) =>
                                    contractMap[toChecksumAddress(address)]
                                        ? contractMap[toChecksumAddress(address)].erc20
                                        : true
                                )
                                .map(token => ({ ...token, address: toChecksumAddress(token.address) })))
            );
        });
        await AssetsController.update({ allTokens });

        // Restore preferences
        const updatedPref = { ...preferences, identities: {} };
        Object.keys(preferences.identities).forEach(address => {
            const checksummedAddress = toChecksumAddress(address);
            if (accounts.hd.includes(checksummedAddress) || accounts.simpleKeyPair.includes(checksummedAddress)) {
                updatedPref.identities[checksummedAddress] = preferences.identities[address];
            }
        });
        await PreferencesController.update(updatedPref);

        if (accounts.hd.includes(toChecksumAddress(updatedPref.selectedAddress))) {
            PreferencesController.setSelectedAddress(updatedPref.selectedAddress);
        } else {
            PreferencesController.setSelectedAddress(accounts.hd[0]);
        }

        await TransactionController.update({
            transactions: transactions.map(tx => ({
                id: tx.id,
                networkID: tx.metamaskNetworkId,
                origin: tx.origin,
                status: tx.status,
                time: tx.time,
                transactionHash: tx.hash,
                rawTx: tx.rawTx,
                transaction: {
                    from: tx.txParams.from,
                    to: tx.txParams.to,
                    nonce: tx.txParams.nonce,
                    gas: tx.txParams.gas,
                    gasPrice: tx.txParams.gasPrice,
                    value: tx.txParams.value
                }
            }))
        });

        return true;
    };
}

let instance;

export default {
    get context() {
        return instance && instance.datamodel && instance.datamodel.context;
    },
    get state() {
        const {
            AccountTrackerController,
            AddressBookController,
            AssetsContractController,
            AssetsController,
            AssetsDetectionController,
            CurrencyRateController,
            KeyringController,
            PersonalMessageManager,
            NetworkController,
            NetworkStatusController,
            PreferencesController,
            PhishingController,
            TokenBalancesController,
            TokenRatesController,
            TransactionController,
            TypedMessageManager
        } = instance.datamodel.state;

        return {
            AccountTrackerController,
            AddressBookController,
            AssetsContractController,
            AssetsController,
            AssetsDetectionController,
            CurrencyRateController,
            KeyringController,
            PersonalMessageManager,
            NetworkController,
            NetworkStatusController,
            PhishingController,
            PreferencesController,
            TokenBalancesController,
            TokenRatesController,
            TransactionController,
            TypedMessageManager
        };
    },
    get datamodel() {
        return instance.datamodel;
    },
    getTotalFiatAccountBalance() {
        return instance.getTotalFiatAccountBalance();
    },
    hasFunds() {
        return instance.hasFunds();
    },
    resetState() {
        return instance.resetState();
    },
    sync(data) {
        return instance.sync(data);
    },
    refreshTransactionHistory(forceCheck = false) {
        return instance.refreshTransactionHistory(forceCheck);
    },
    init(state) {
        instance = new Engine(state);
        Object.freeze(instance);
        return instance;
    }
};
