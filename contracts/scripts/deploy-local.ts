// Local rig for the frontend: a mock token, the CREATE2 proxy and Multicall3 at their canonical
// addresses, funded test accounts, and the env lines the app needs. The game contract itself is
// deployed from the site's /deploy page, exactly as in production.
// usage: npx hardhat run scripts/deploy-local.ts --network localhost
import { mkdirSync, writeFileSync } from "node:fs";
import { ethers, network } from "hardhat";

const CREATE2_PROXY = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
// Runtime code of Arachnid's deterministic deployment proxy.
const CREATE2_PROXY_CODE = "0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3";
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MULTICALL3_SOURCE_RPC = process.env.MULTICALL3_SOURCE_RPC ?? "https://rpc.mainnet.chain.robinhood.com";

async function main() {
  const [deployer, alice] = await ethers.getSigners();
  const Token = await ethers.getContractFactory("MockToken");
  const token = await Token.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  await network.provider.send("hardhat_setCode", [CREATE2_PROXY, CREATE2_PROXY_CODE]);

  // Multicall3: copy the real bytecode from a chain that has it (the app reads through multicall).
  let multicall = "missing";
  try {
    const src = new ethers.JsonRpcProvider(MULTICALL3_SOURCE_RPC);
    const code = await src.getCode(MULTICALL3);
    if (code && code !== "0x") {
      await network.provider.send("hardhat_setCode", [MULTICALL3, code]);
      multicall = "installed";
    }
  } catch (e) {
    console.warn("Multicall3 copy failed:", (e as Error).message);
  }

  for (const who of [deployer, alice]) await (await token.mint(who.address, ethers.parseUnits("1000000", 18))).wait();

  const signer = ethers.Wallet.createRandom();
  const out = {
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    token: tokenAddress,
    owner: deployer.address,
    alice: alice.address,
    signerKey: signer.privateKey,
    signerAddress: signer.address,
    proxy: CREATE2_PROXY,
    multicall3: multicall,
  };
  mkdirSync("deployments", { recursive: true });
  writeFileSync("deployments/local.json", JSON.stringify(out, null, 2));

  console.log(`# local rig ready — multicall3 ${multicall}
NEXT_PUBLIC_CHAIN_ID=${out.chainId}
NEXT_PUBLIC_CHAIN_NAME=Hardhat (local)
NEXT_PUBLIC_TOKEN_ADDRESS=${tokenAddress}
NEXT_PUBLIC_OWNER_ADDRESS=${deployer.address}
NEXT_PUBLIC_RANDOM_SIGNER_ADDRESS=${signer.address}
RANDOM_SIGNER_KEY=${signer.privateKey}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
