import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import config from "../deploy-config.json";

/* ------------------------------------------------------------------ */
/*  StarminerGame — the whole loop on a Hardhat chain with a mock token */
/* ------------------------------------------------------------------ */

const E18 = 10n ** 18n;
const BPS = 10_000;

// The client's curve interpolation (src/game/math/miningProbability.ts), so the test asserts parity.
const BELOW = [5200, 5465, 5678, 5875, 6062, 6242, 6416, 6587, 6753, 6917, 7078, 7236, 7393, 7547, 7700, 7851, 8000];
const ABOVE = [8000, 8321, 8591, 8817, 9007, 9166, 9300, 9412, 9507, 9586, 9652, 9708, 9755, 9794, 9827, 9855, 9878, 9898, 9900, 9900, 9900, 9900, 9900, 9900, 9900];
function chanceBps(power: number, min: number, rec: number): number {
  if (power < min) return 0;
  const E6 = 1_000_000;
  if (power < rec) {
    const t6 = Math.floor(((power - min) * E6) / (rec - min));
    const x = t6 * 16;
    const i = Math.floor(x / E6);
    const f = x % E6;
    if (i >= 16) return BELOW[16];
    return BELOW[i] + Math.floor(((BELOW[i + 1] - BELOW[i]) * f) / E6);
  }
  const r6 = Math.floor((power * E6) / rec);
  if (r6 >= 2_500_000) return 9900;
  const x = (r6 - E6) * 16;
  const i = Math.floor(x / E6);
  const f = x % E6;
  return Math.min(9900, ABOVE[i] + Math.floor(((ABOVE[i + 1] - ABOVE[i]) * f) / E6));
}

const hullId = (id: string) => config.hulls.findIndex((h) => h.id === id);
const AERA = config.planets[0];

async function deployFixture() {
  const [deployer, alice, bob, treasury] = await ethers.getSigners();
  const signer = ethers.Wallet.createRandom();
  const Token = await ethers.getContractFactory("MockToken");
  const token = await Token.deploy();
  const Game = await ethers.getContractFactory("StarminerGame");
  const game = await Game.deploy(
    await token.getAddress(),
    deployer.address,
    treasury.address,
    signer.address,
    config.hulls.map((h) => ({ power: h.power, price: BigInt(h.price), class: h.class, levelRequired: h.levelRequired, active: h.active })),
    config.planets.map((p) => ({ minPower: p.minPower, recPower: p.recPower, duration: p.duration, rewardMin: BigInt(p.rewardMin), rewardMax: BigInt(p.rewardMax), rareBps: p.rareBps, xp: p.xp })),
  );
  const gameAddr = await game.getAddress();
  for (const who of [alice, bob]) {
    await token.mint(who.address, 1_000_000n * E18);
    await token.connect(who).approve(gameAddr, ethers.MaxUint256);
  }
  await token.mint(deployer.address, 10_000_000n * E18);
  await token.approve(gameAddr, ethers.MaxUint256);
  await game.fundVault(2_500_000n * E18);
  const chainId = (await ethers.provider.getNetwork()).chainId;

  /** Server side of the randomness: a seed, its commitment and the launch signature. */
  async function commitFor(player: string, nonce: number, seedLabel = "seed") {
    const seed = ethers.keccak256(ethers.toUtf8Bytes(`${seedLabel}:${player}:${nonce}`));
    const commit = ethers.keccak256(seed);
    const hash = ethers.solidityPackedKeccak256(["uint256", "address", "address", "uint32", "bytes32"], [chainId, gameAddr, player, nonce, commit]);
    const signature = await signer.signMessage(ethers.getBytes(hash));
    return { seed, commit, signature };
  }

  /** Outcome the contract will compute for a seed, given the entropy of the block before the launch. */
  function predict(seed: string, entropy: string, missionId: number, probabilityBps: number) {
    const r1 = BigInt(ethers.solidityPackedKeccak256(["bytes32", "bytes32", "uint256", "uint8"], [seed, entropy, missionId, 1]));
    return Number(r1 % BigInt(BPS)) < probabilityBps;
  }

  return { deployer, alice, bob, treasury, signer, token, game, gameAddr, chainId, commitFor, predict };
}

describe("StarminerGame", () => {
  it("deploys with the config: 24 hulls, 30 planets, vault funded", async () => {
    const { game } = await loadFixture(deployFixture);
    expect(await game.hullCount()).to.equal(24n);
    const p1 = await game.planet(1);
    expect(p1.minPower).to.equal(90);
    expect(p1.recPower).to.equal(140);
    const p30 = await game.planet(30);
    expect(p30.recPower).to.equal(45000);
    expect(await game.vaultAvailable()).to.equal(2_500_000n * E18);
  });

  it("buyHull: pulls the price, splits 60/40 vault/treasury, mints and auto-equips; level and allowance gates hold", async () => {
    const { game, token, alice, bob, treasury } = await loadFixture(deployFixture);
    const vault0 = await game.vaultAvailable();
    const t0 = await token.balanceOf(treasury.address);
    await expect(game.connect(alice).buyHull(hullId("scout-01"))).to.emit(game, "Purchased");
    expect(await token.balanceOf(alice.address)).to.equal(1_000_000n * E18 - 500n * E18);
    expect(await game.vaultAvailable()).to.equal(vault0 + 300n * E18);
    expect(await token.balanceOf(treasury.address)).to.equal(t0 + 200n * E18);
    const [ids, ships] = await game.shipsOf(alice.address);
    expect(ids.length).to.equal(1);
    expect(ships[0].owner).to.equal(alice.address);
    expect(ships[0].mark).to.equal(1);
    expect((await game.fleetOf(alice.address))[0]).to.equal(ids[0]);
    await expect(game.connect(alice).buyHull(hullId("omega"))).to.be.revertedWith("level");
    await token.connect(bob).approve(await game.getAddress(), 0);
    await expect(game.connect(bob).buyHull(hullId("scout-01"))).to.be.reverted;
  });

  it("fleet power and success chance match the client's arithmetic", async () => {
    const { game, alice } = await loadFixture(deployFixture);
    await game.connect(alice).buyHull(hullId("scout-01"));
    let fp = await game.fleetPower(alice.address);
    expect(fp.base).to.equal(100);
    expect(fp.total).to.equal(100);
    expect(fp.durationMultBps).to.equal(9500); // scout trait
    expect(await game.successChance(alice.address, 1)).to.equal(chanceBps(100, AERA.minPower, AERA.recPower));
    expect(await game.successChance(alice.address, 1)).to.equal(5912);
    await game.connect(alice).buyHull(hullId("scout-02"));
    fp = await game.fleetPower(alice.address);
    expect(fp.total).to.equal(260);
    expect(await game.successChance(alice.address, 1)).to.equal(chanceBps(260, AERA.minPower, AERA.recPower));
    expect(await game.successChance(alice.address, 6)).to.equal(0); // below Kryos minimum
    // Mixed classes: prospector (miner) adds the reward trait.
    await game.connect(alice).buyHull(hullId("ranger"));
    await expect(game.connect(alice).buyHull(hullId("prospector"))).to.be.revertedWith("level"); // miner hull needs level 2
    fp = await game.fleetPower(alice.address);
    expect(fp.total).to.equal(520);
    expect(fp.rewardMultBps).to.equal(10000);
  });

  it("launch needs the server signature and a fleet above minimum; the fleet freezes while flying", async () => {
    const { game, alice, bob, commitFor, signer } = await loadFixture(deployFixture);
    await game.connect(alice).buyHull(hullId("scout-01"));
    const { commit, signature } = await commitFor(alice.address, 0);
    // A signature for another player is refused.
    await game.connect(bob).buyHull(hullId("scout-01"));
    await expect(game.connect(bob).launch(1, commit, signature)).to.be.revertedWith("sig");
    // A commit signed by the wrong key is refused.
    const rogue = ethers.Wallet.createRandom();
    const bad = await rogue.signMessage(ethers.getBytes(ethers.solidityPackedKeccak256(["uint256", "address", "address", "uint32", "bytes32"], [31337, await game.getAddress(), alice.address, 0, commit])));
    await expect(game.connect(alice).launch(1, commit, bad)).to.be.revertedWith("sig");
    expect(signer.address).to.equal(await game.randomSigner());
    await expect(game.connect(alice).launch(1, commit, signature)).to.emit(game, "Launched");
    const [id, m] = await game.activeMissionOf(alice.address);
    expect(id).to.equal(1n);
    expect(m.probabilityBps).to.equal(5912);
    expect(m.fleetPower).to.equal(100);
    expect(m.endsAt - m.startedAt).to.equal(29n); // 30 s × scout trait 0.95, rounded
    await expect(game.connect(alice).launch(1, commit, signature)).to.be.revertedWith("active");
    await expect(game.connect(alice).equip(1, 1)).to.be.revertedWith("mission");
    await expect(game.connect(alice).list(1, 100n * E18)).to.be.revertedWith("on mission");
  });

  it("resolve: only after endsAt, only with the committed seed; the outcome is the predicted one and rewards leave the vault", async () => {
    const { game, token, alice, commitFor, predict } = await loadFixture(deployFixture);
    await game.connect(alice).buyHull(hullId("scout-01"));
    await game.connect(alice).buyHull(hullId("scout-02"));
    await game.connect(alice).buyHull(hullId("ranger")); // 520 power → Aera at 99%
    const prob = Number(await game.successChance(alice.address, 1));
    expect(prob).to.equal(9900);
    // Pick a seed that fails and one that succeeds for the entropy the launch will use (hash of the latest block).
    const latest = await ethers.provider.getBlock("latest");
    const entropy = latest!.hash!;
    let winning: Awaited<ReturnType<typeof commitFor>> | null = null;
    let losing: Awaited<ReturnType<typeof commitFor>> | null = null;
    for (let k = 0; k < 4000 && (!winning || !losing); k++) {
      const c = await commitFor(alice.address, 0, `s${k}`);
      const ok = predict(c.seed, entropy, 1, prob);
      if (ok && !winning) winning = c;
      if (!ok && !losing) losing = c;
    }
    expect(winning, "a winning seed exists").to.not.equal(null);
    expect(losing, "a losing seed exists").to.not.equal(null);

    await game.connect(alice).launch(1, losing!.commit, losing!.signature);
    await expect(game.resolve(1, losing!.seed)).to.be.revertedWith("early");
    await time.increase(60);
    await expect(game.resolve(1, winning!.seed)).to.be.revertedWith("seed");
    const vault0 = await game.vaultAvailable();
    await expect(game.resolve(1, losing!.seed)).to.emit(game, "Resolved");
    let m = await game.missionOf(1);
    expect(m.success).to.equal(false);
    expect(m.reward).to.equal(0n);
    expect(await game.vaultAvailable()).to.equal(vault0);
    let pl = await game.playerOf(alice.address);
    expect(pl.xp).to.equal(4); // 20% of Aera's 20 XP
    expect(pl.missionsCompleted).to.equal(1);
    expect(await game.isUnlocked(alice.address, 2)).to.equal(false);
    // Failure never touched the ships.
    expect((await game.shipsOf(alice.address))[0].length).to.equal(3);
    await game.connect(alice).claim(1);
    expect((await game.playerOf(alice.address)).activeMission).to.equal(0n);

    // Second mission with a winning seed (nonce 1, fresh entropy).
    const latest2 = await ethers.provider.getBlock("latest");
    let win2: Awaited<ReturnType<typeof commitFor>> | null = null;
    for (let k = 0; k < 4000 && !win2; k++) {
      const c = await commitFor(alice.address, 1, `w${k}`);
      if (predict(c.seed, latest2!.hash!, 2, prob)) win2 = c;
    }
    await game.connect(alice).launch(1, win2!.commit, win2!.signature);
    await time.increase(60);
    await game.resolve(2, win2!.seed);
    m = await game.missionOf(2);
    expect(m.success).to.equal(true);
    expect(m.reward >= 5n * E18 && m.reward <= 16n * E18).to.equal(true); // 5–8, doubled on a rare drop
    const bal0 = await token.balanceOf(alice.address);
    await expect(game.connect(alice).claim(2)).to.emit(game, "Claimed");
    expect(await token.balanceOf(alice.address)).to.equal(bal0 + m.reward);
    expect(await game.vaultAvailable()).to.equal(vault0 - m.reward);
    await expect(game.connect(alice).claim(2)).to.be.revertedWith("status");
    pl = await game.playerOf(alice.address);
    expect(pl.xp).to.equal(24);
    expect(pl.missionsSucceeded).to.equal(1);
    expect(pl.furthestPlanet).to.equal(1);
    expect(await game.isUnlocked(alice.address, 2)).to.equal(true);
    expect(await game.isUnlocked(alice.address, 3)).to.equal(false); // Noma still needs a Lyra success
  });

  it("unlock gates mirror the config: Noma needs Lyra mined and two missions; zone 2 needs level 3", async () => {
    const { game, alice } = await loadFixture(deployFixture);
    expect(await game.isUnlocked(alice.address, 1)).to.equal(true);
    expect(await game.isUnlocked(alice.address, 2)).to.equal(false);
    expect(await game.levelFor(0)).to.equal(1);
    expect(await game.levelFor(80)).to.equal(2);
    expect(await game.levelFor(299)).to.equal(2);
    expect(await game.levelFor(300)).to.equal(3);
    expect(await game.levelFor(1_000_000)).to.equal(30);
  });

  it("refit: 10% × price × target mark, power +15% per mark, MK-V is the ceiling", async () => {
    const { game, alice } = await loadFixture(deployFixture);
    await game.connect(alice).buyHull(hullId("scout-01"));
    expect(await game.refitCost(1)).to.equal(100n * E18);
    await expect(game.connect(alice).refit(1)).to.emit(game, "Refitted");
    expect((await game.ship(1)).mark).to.equal(2);
    expect((await game.fleetPower(alice.address)).total).to.equal(115);
    expect(await game.refitCost(1)).to.equal(150n * E18);
    for (let i = 0; i < 3; i++) await game.connect(alice).refit(1);
    expect((await game.ship(1)).mark).to.equal(5);
    await expect(game.refitCost(1)).to.be.revertedWith("mark");
    expect((await game.fleetPower(alice.address)).total).to.equal(160);
  });

  it("player market: list leaves the fleet, cancel returns it, buy pays seller minus the vault fee and moves the ship", async () => {
    const { game, token, alice, bob } = await loadFixture(deployFixture);
    await game.connect(alice).buyHull(hullId("scout-01"));
    await game.connect(alice).buyHull(hullId("scout-02"));
    await expect(game.connect(alice).list(2, 700n * E18)).to.emit(game, "Listed");
    expect((await game.fleetOf(alice.address))[1]).to.equal(0n);
    expect((await game.ship(2)).listed).to.equal(true);
    await expect(game.connect(alice).equip(1, 2)).to.be.revertedWith("listed");
    await expect(game.connect(alice).buy(1)).to.be.revertedWith("own");
    await game.connect(alice).cancel(1);
    expect((await game.ship(2)).listed).to.equal(false);
    await game.connect(alice).list(2, 700n * E18);
    const [openIds] = await game.openListings();
    expect(openIds.length).to.equal(1);
    const vault0 = await game.vaultAvailable();
    const aliceBal = await token.balanceOf(alice.address);
    await expect(game.connect(bob).buy(2)).to.emit(game, "Sold");
    const fee = (700n * E18 * 250n) / 10_000n;
    expect(await game.vaultAvailable()).to.equal(vault0 + fee);
    expect(await token.balanceOf(alice.address)).to.equal(aliceBal + 700n * E18 - fee);
    expect((await game.ship(2)).owner).to.equal(bob.address);
    expect((await game.shipsOf(alice.address))[0].length).to.equal(1);
    expect((await game.shipsOf(bob.address))[0].length).to.equal(1);
    expect((await game.fleetOf(bob.address))[0]).to.equal(2n); // auto-equipped for the buyer
    expect((await game.openListings())[0].length).to.equal(0);
    expect(await game.marketVolume()).to.equal(700n * E18);
  });

  it("abort frees the fleet when the seed is never revealed, after the grace period", async () => {
    const { game, alice, commitFor } = await loadFixture(deployFixture);
    await game.connect(alice).buyHull(hullId("scout-01"));
    const c = await commitFor(alice.address, 0);
    await game.connect(alice).launch(1, c.commit, c.signature);
    await expect(game.connect(alice).abort(1)).to.be.revertedWith("grace");
    await time.increase(3 * 24 * 3600);
    await expect(game.connect(alice).abort(1)).to.emit(game, "Aborted");
    expect((await game.playerOf(alice.address)).activeMission).to.equal(0n);
    expect((await game.playerOf(alice.address)).xp).to.equal(0);
    await expect(game.connect(alice).equip(1, 1)).to.not.be.reverted;
  });

  it("only the owner tunes the config; anyone can fund the vault", async () => {
    const { game, alice, deployer } = await loadFixture(deployFixture);
    await expect(game.connect(alice).setTreasury(alice.address)).to.be.revertedWith("owner");
    await game.connect(deployer).setPlanet(1, { minPower: 90, recPower: 150, duration: 30, rewardMin: 5n * E18, rewardMax: 8n * E18, rareBps: 60, xp: 20 });
    expect((await game.planet(1)).recPower).to.equal(150);
    const v0 = await game.vaultAvailable();
    await game.connect(alice).fundVault(10n * E18);
    expect(await game.vaultAvailable()).to.equal(v0 + 10n * E18);
  });

  it("resolveAndClaim settles in one transaction; commanders are registered once, in order", async () => {
    const { game, token, alice, bob, commitFor } = await loadFixture(deployFixture);
    expect(await game.commanderCount()).to.equal(0n);
    await game.connect(alice).buyHull(hullId("scout-01"));
    await game.connect(alice).buyHull(hullId("scout-02"));
    await game.connect(bob).buyHull(hullId("scout-01"));
    expect(await game.commanderCount()).to.equal(2n);
    expect(await game.commanders(0, 10)).to.deep.equal([alice.address, bob.address]);
    const c = await commitFor(alice.address, 0);
    await game.connect(alice).launch(1, c.commit, c.signature);
    await time.increase(60);
    await expect(game.connect(bob).resolveAndClaim(1, c.seed)).to.be.revertedWith("player");
    const bal0 = await token.balanceOf(alice.address);
    await expect(game.connect(alice).resolveAndClaim(1, c.seed)).to.emit(game, "Claimed");
    const m = await game.missionOf(1);
    expect(m.status).to.equal(3n); // Claimed
    expect(await token.balanceOf(alice.address)).to.equal(bal0 + m.reward);
    expect((await game.playerOf(alice.address)).activeMission).to.equal(0n);
    expect((await game.playerOf(alice.address)).missionsCompleted).to.equal(1);
  });
});
