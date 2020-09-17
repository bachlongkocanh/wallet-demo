/**
 * @format
 */
import './shim';
import { AppRegistry } from 'react-native';
import App from './App';
import App2 from './app2';
import App3 from './app3';
import Web from './web';
import { name as appName } from './app.json';
import Engine from './core/Engine';
import { initState } from './core/BackgroundBridge';
Engine.init(initState)

AppRegistry.registerComponent(appName, () => Web);
