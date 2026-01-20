require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: __dirname + '/.env' });

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000001";

module.exports = {
  solidity: "0.8.20",
  networks: {
    polygon: {
      url: "https://polygon.llamarpc.com",
      accounts: [PRIVATE_KEY],
      chainId: 137
    }
  }
};
