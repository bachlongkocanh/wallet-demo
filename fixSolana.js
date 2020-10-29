const fs = require('fs');

function addAfterfix() {
    try {
        console.log("**** Add afterfix to file. Fix error module superstruct in RN");
        if (fs.existsSync("'./node_modules/superstruct/lib/structs/index.cjs.js'")) {
            console.log("--File has changed name");
            return;
        }
        fs.rename('./node_modules/superstruct/lib/structs/index.cjs', './node_modules/superstruct/lib/structs/index.cjs.js', (error) => {
            if (error) {
                console.log("--Error", error)
            } else {
                console.log("--Change name file success")
            }
        })
    } catch (error) {
        console.log("-- Error", error)
    }
}
addAfterfix();