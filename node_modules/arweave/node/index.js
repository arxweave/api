"use strict";
const common_1 = require("./common");
const node_driver_1 = require("./lib/crypto/node-driver");
common_1.default.init = function (apiConfig = {}) {
    return new common_1.default({
        api: apiConfig,
        crypto: new node_driver_1.default()
    });
};
module.exports = common_1.default;
//# sourceMappingURL=index.js.map