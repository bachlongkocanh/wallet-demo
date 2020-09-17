import React, { Component } from 'react'
import { Text, View, Modal } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler';

interface ApprovalDialogProps {
    showApprovalDialog: Boolean,
    accept: Function,
    reject: Function,
    host: String,
    address: String,
    title: String,
    icon: String
}

export default class ApprovalDialog extends Component<ApprovalDialogProps> {
    render() {
        const { showApprovalDialog, accept, address, reject, host, title, icon } = this.props;
        return (
            <Modal
                animationType="slide"
                visible={showApprovalDialog}
                statusBarTranslucent={true}
                transparent={true}
            >
                <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0,0.5)", paddingHorizontal: 50, paddingVertical: 200 }}>
                    <View style={{ flex: 1, backgroundColor: "#fff", borderRadius: 20, justifyContent: "space-between", alignItems: "center" }}>
                        <View >
                            <Text>Request</Text>
                        </View>
                        <View>
                            <Text>{host}</Text>
                            <Text>{title} would like to connect to your account</Text>
                            <Text>{address}</Text>
                            <Text>This site is requesting access to view your current account address. Always make sure you trust the sites you interact with.</Text>
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
                                onPress={accept}
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