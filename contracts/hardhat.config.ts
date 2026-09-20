import "@nomicfoundation/hardhat-toolbox";
import type { HardhatUserConfig } from "hardhat/config";

const PRIVATE_KEY = process.env.PRIVATE_KEY?.trim();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      // Paris: no PUSH0 / MCOPY, so the bytecode runs on any EVM L2.
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      ...(process.env.FORK_URL ? { forking: { url: process.env.FORK_URL } } : {}),
    },
    localhost: {
      url: process.env.LOCAL_RPC ?? "http://127.0.0.1:8781",
      chainId: 31337,
    },
    robinhood: {
      url: process.env.RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com",
      chainId: 4663,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  paths: { sources: "./contracts", tests: "./test", cache: "./cache", artifacts: "./artifacts" },
};

export default config;
