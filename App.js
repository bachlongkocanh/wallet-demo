// import React, { Component } from 'react';
// import {
//   View,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
// } from 'react-native';
// import Service from './service';
// import QRCodeScanner from "react-native-qrcode-scanner";
// import WalletConnect from './walletconnect';


// export default class App extends Component {
//   state = {
//     account: null,
//     statusCam: false,
//   }
//   assets = [{ "balance": "0", "contractAddress": "", "decimals": "18", "name": "Ethereum", "symbol": "ETH" }];

//   componentDidMount = async () => {
//     this.setState({ account: await Service.initAccount() }, () => {
//       setTimeout(() => {
//         console.log("aaa")
//         let uri = "wc:8e95ba4f-7891-469c-8fc2-36d6bafb740a@1?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=82d7e8f85f2656ed8739c9fca24420266aca9f875c8495c3cca8e1b1453a0dec"
//         let wc = new WalletConnect(uri);
//       }, 2000);
//     });

//   }

//   onRead = async (event: any) => {
//     const uri = event.data;

//     if (uri && typeof uri === "string") {

//       // this.props.walletConnectOnSessionRequest(uri);
//     }

//     setTimeout(() => {
//       this.scanner.reactivate();
//     }, 1000);
//   };

//   turnOffCam = () => {
//     this.setState({ statusCam: !this.state.statusCam }, () => {
//       if (this.state.statusCam) {
//         this.scanner.enable()
//       } else {
//         this.scanner.disable()
//       }
//     })
//   }


//   render() {
//     const { account } = this.state;
//     return (
//       <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
//         <Text style={styles.centerText}>
//           <Text>{account?.signingKey?.address}</Text>
//         </Text>
//         {/* <QRCodeScanner
//           style={{ flex: 1 }}
//           topContent={
//             <Text style={styles.centerText}>
//               <Text>{account?.signingKey?.address}</Text>
//             </Text>
//           }
//           bottomContent={
//             <TouchableOpacity style={styles.buttonTouchable} onPress={this.turnOffCam}>
//               <Text style={styles.buttonText}>OK. Got it!</Text>
//             </TouchableOpacity>
//           }
//           // topContent={
//           //   <Text>{account?.signingKey?.address}</Text>
//           // }
//           ref={c => {
//             this.scanner = c;
//           }}
//           onRead={this.onRead}
//         /> */}
//       </View>
//     )
//   }
// }

// const styles = StyleSheet.create({
//   centerText: {
//     flex: 1,
//     fontSize: 18,
//     padding: 32,
//     color: '#777'
//   },
//   textBold: {
//     fontWeight: '500',
//     color: '#000'
//   },
//   buttonText: {
//     fontSize: 21,
//     color: 'rgb(0,122,255)'
//   },
//   buttonTouchable: {
//     padding: 16
//   }
// });





import React, { Component } from 'react'
import { Text, View } from 'react-native'
export default class componentName extends Component {
  render() {
    return (
      <View>
        <Text> textInComponent </Text>
      </View>
    )
  }
}