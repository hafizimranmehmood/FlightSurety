var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

module.exports = {
  networks: {
    development: {
      // provider: function() {
      //   return new HDWalletProvider(mnemonic, "http://127.0.0.1:8545/", 0, 50);
      // },
      host: "127.0.0.1",
      port: 8545,
      network_id: '*',
      gas: 999999999,
      gasPrice: 20000000000,
      websockets: true
    },
    // develop: {
    //   accounts: 40
    // }
  },
  // compilers: {
  //   solc: {
  //     version: "^0.4.24"
  //   }
  // }
};