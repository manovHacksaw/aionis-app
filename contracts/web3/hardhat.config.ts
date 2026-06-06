import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    somnia: {
      url: "https://dream-rpc.somnia.network",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 50312,
    },
  },
  paths: {
    artifacts: "../../src/contracts/artifacts",
  },
};

export default config;
