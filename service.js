import { ethers } from "ethers";
import AsyncStorage from '@react-native-community/async-storage';



const initAccount = async () => {
    try {
        let account;
        let privateKey = await getData();
        if (!privateKey) {
            account = new ethers.Wallet.createRandom();
            storeData(account.signingKey.privateKey);
        } else {
            account = new ethers.Wallet(privateKey)
        }
        return account;
    } catch (error) {
        console.log("aaa", error)
        throw new Error(error)
    }

}

const storeData = async (value) => {
    try {
        const jsonValue = JSON.stringify(value)
        await AsyncStorage.setItem('@private-key', jsonValue)
    } catch (e) {
        // saving error
    }
}

const getData = async () => {
    try {
        const jsonValue = await AsyncStorage.getItem('@private-key')
        return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (e) {
        // error reading value
    }
}

export default {
    initAccount
}