// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Tables} from "./Tables.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title StarminerGame — ships, fleet, missions, reward vault and player market, in one contract.
/// @notice Every rule mirrors the client's config (src/game/config) and math (src/game/math):
///         the chance shown before launch is the chance stored in the mission and used to resolve it.
///         Randomness: a server-signed commitment at launch, revealed after the mission ends, mixed
///         with the launch block's entropy — neither the player nor the server can pick an outcome.
///         Failure never destroys a ship. Rewards only ever come from the vault.
contract StarminerGame {
    // ------------------------------------------------------------------ types
    struct Hull {
        uint32 power;
        uint128 price;
        uint8 class; // 0 scout, 1 miner, 2 cruiser, 3 destroyer, 4 dreadnought, 5 capital
        uint8 levelRequired;
        bool active;
    }
    struct Planet {
        uint32 minPower;
        uint32 recPower;
        uint32 duration; // seconds
        uint128 rewardMin;
        uint128 rewardMax;
        uint16 rareBps;
        uint32 xp;
    }
    struct Ship {
        address owner;
        uint8 hull;
        uint8 mark; // 1..5
        bool listed;
    }
    struct Player {
        uint32 xp;
        uint32 missionsCompleted;
        uint32 missionsSucceeded;
        uint8 furthestPlanet;
        uint32 nonce;
        uint128 totalMined;
        uint256 activeMission;
    }
    enum MissionStatus {
        None,
        Active,
        Resolved,
        Claimed,
        Aborted
    }
    struct Mission {
        address player;
        uint8 planet;
        MissionStatus status;
        bool success;
        bool rare;
        uint16 probabilityBps;
        uint16 rewardMultBps;
        uint16 rareMultBps;
        uint32 fleetPower;
        uint64 startedAt;
        uint64 endsAt;
        uint128 reward;
        uint128 rareBonus;
        bytes32 commit;
        bytes32 entropy;
        uint256[3] ships;
    }
    enum ListingStatus {
        None,
        Open,
        Sold,
        Cancelled
    }
    struct Listing {
        uint256 shipId;
        address seller;
        address buyer;
        uint128 price;
        uint64 listedAt;
        ListingStatus status;
    }

    // ------------------------------------------------------------------ constants (mirror src/game/config)
    uint256 public constant BPS = 10_000;
    uint256 public constant MARK_STEP_BPS = 1_500;
    uint256 public constant MARK_COST_RATE_BPS = 1_000;
    uint8 public constant MAX_MARK = 5;
    uint256 public constant VAULT_SHARE_BPS = 6_000;
    uint256 public constant MARKET_FEE_BPS = 250;
    uint256 public constant COMMANDER_BPS_PER_LEVEL = 50;
    uint256 public constant COMMANDER_CAP_BPS = 1_500;
    uint256 public constant FAILURE_XP_BPS = 2_000;
    uint256 public constant RARE_BONUS_BPS = 10_000;
    uint256 public constant REVEAL_GRACE = 2 days;
    uint8 public constant PLANET_COUNT = 30;
    uint16 public constant SCOUT_DURATION_BPS = 9_500;
    uint16 public constant MINER_REWARD_BPS = 10_500;
    uint16 public constant CRUISER_SUCCESS_BPS = 200;
    uint16 public constant DESTROYER_RARE_BPS = 12_500;
    uint16 public constant DREADNOUGHT_POWER_BPS = 10_300;
    uint16 public constant CAPITAL_POWER_BPS = 10_500;

    // ------------------------------------------------------------------ storage
    IERC20 public immutable token;
    address public owner;
    address public treasury;
    address public randomSigner;

    Hull[] private _hulls;
    Planet[31] private _planets; // 1-based
    Ship[] private _ships; // index 0 is a sentinel (empty slot)
    Mission[] private _missions; // index 0 is a sentinel
    Listing[] private _listings; // index 0 is a sentinel

    mapping(address => Player) private _players;
    mapping(address => uint256[3]) private _fleets;
    mapping(address => uint256[]) private _owned;
    mapping(uint256 => uint256) private _ownedIndex;
    mapping(address => mapping(uint8 => uint32)) public successesOn;
    mapping(address => uint256[]) private _missionsOf;
    /// @dev Every address that ever owned a ship, in order of arrival — the leaderboard reads them without an indexer.
    address[] private _commanders;
    mapping(address => bool) private _joined;

    uint256 public vaultAvailable;
    uint256 public vaultDistributed;
    uint256 public missionsPaid;
    uint256 public shipsPurchased;
    uint256 public tokensSpentOnShips;
    uint256 public tokensSpentOnRefits;
    uint256 public marketVolume;

    // ------------------------------------------------------------------ events
    event Purchased(address indexed player, uint8 indexed hull, uint256 indexed shipId, uint256 price);
    event Refitted(address indexed player, uint256 indexed shipId, uint8 mark, uint256 cost);
    event FleetChanged(address indexed player, uint256[3] ships);
    event Launched(address indexed player, uint256 indexed missionId, uint8 indexed planet, uint32 fleetPower, uint16 probabilityBps, uint64 endsAt);
    event Resolved(uint256 indexed missionId, address indexed player, bool success, uint256 reward, bool rare, uint256 roll);
    event Claimed(address indexed player, uint256 indexed missionId, uint256 reward);
    event Aborted(address indexed player, uint256 indexed missionId);
    event Listed(uint256 indexed listingId, uint256 indexed shipId, address indexed seller, uint256 price);
    event Cancelled(uint256 indexed listingId);
    event Sold(uint256 indexed listingId, uint256 indexed shipId, address indexed buyer, address seller, uint256 price, uint256 fee);
    event VaultFunded(address indexed from, uint256 amount);
    event OwnershipTransferred(address indexed from, address indexed to);

    modifier onlyOwner() {
        require(msg.sender == owner, "owner");
        _;
    }

    constructor(IERC20 token_, address owner_, address treasury_, address randomSigner_, Hull[] memory hulls_, Planet[] memory planets_) {
        require(planets_.length == PLANET_COUNT, "planets");
        require(hulls_.length > 0 && hulls_.length < 256, "hulls");
        token = token_;
        owner = owner_;
        treasury = treasury_;
        randomSigner = randomSigner_;
        for (uint256 i = 0; i < hulls_.length; i++) _hulls.push(hulls_[i]);
        for (uint256 i = 0; i < planets_.length; i++) {
            require(planets_[i].recPower > planets_[i].minPower && planets_[i].rewardMax >= planets_[i].rewardMin, "planet");
            _planets[i + 1] = planets_[i];
        }
        _ships.push();
        _missions.push();
        _listings.push();
    }

    // ------------------------------------------------------------------ views: config
    function hullCount() external view returns (uint256) {
        return _hulls.length;
    }

    function hull(uint8 id) external view returns (Hull memory) {
        return _hulls[id];
    }

    function hulls() external view returns (Hull[] memory) {
        return _hulls;
    }

    function planet(uint8 id) external view returns (Planet memory) {
        require(id >= 1 && id <= PLANET_COUNT, "planet");
        return _planets[id];
    }

    function planets() external view returns (Planet[] memory out) {
        out = new Planet[](PLANET_COUNT);
        for (uint8 i = 1; i <= PLANET_COUNT; i++) out[i - 1] = _planets[i];
    }

    // ------------------------------------------------------------------ views: players, ships, fleet
    function playerOf(address p) external view returns (Player memory) {
        return _players[p];
    }

    function levelOf(address p) public view returns (uint8) {
        return levelFor(_players[p].xp);
    }

    function levelFor(uint32 xp) public pure returns (uint8 lvl) {
        uint32[30] memory t = Tables.levelXp();
        lvl = 1;
        for (uint8 n = 2; n <= 30; n++) {
            if (xp >= t[n - 1]) lvl = n;
            else break;
        }
    }

    function ship(uint256 id) external view returns (Ship memory) {
        return _ships[id];
    }

    function shipsOf(address p) external view returns (uint256[] memory ids, Ship[] memory data) {
        ids = _owned[p];
        data = new Ship[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) data[i] = _ships[ids[i]];
    }

    function fleetOf(address p) external view returns (uint256[3] memory) {
        return _fleets[p];
    }

    /// @notice Fleet Power and traits exactly as a launch would compute them.
    function fleetPower(address p) external view returns (uint32 base, uint32 total, uint16 successBps, uint16 rewardMultBps, uint16 durationMultBps, uint16 rareMultBps) {
        (uint256 b, uint256 t, uint16 s, uint16 r, uint16 d, uint16 ra, ) = _fleet(p);
        return (uint32(b), uint32(t), s, r, d, ra);
    }

    function hullValue(uint8 hullId, uint8 mark) public view returns (uint256) {
        return _mulBpsRound(_hulls[hullId].price, BPS + MARK_STEP_BPS * (mark - 1));
    }

    function refitCost(uint256 shipId) public view returns (uint256) {
        Ship memory s = _ships[shipId];
        require(s.owner != address(0) && s.mark < MAX_MARK, "mark");
        return _mulBpsRound(_hulls[s.hull].price, MARK_COST_RATE_BPS * (s.mark + 1));
    }

    // ------------------------------------------------------------------ views: missions
    function isUnlocked(address p, uint8 pid) public view returns (bool) {
        if (pid == 1) return true;
        if (pid < 1 || pid > PLANET_COUNT) return false;
        if (successesOn[p][pid - 1] == 0) return false;
        (uint32 needMissions, uint8 needLevel) = _gates(pid);
        Player memory pl = _players[p];
        return pl.missionsCompleted >= needMissions && levelFor(pl.xp) >= needLevel;
    }

    /// @notice Success chance in bps for the player's current fleet on a planet (0 = below minimum).
    function successChance(address p, uint8 pid) external view returns (uint16) {
        (, uint256 total, uint16 s, , , , ) = _fleet(p);
        return _chanceBps(total, _planets[pid], s);
    }

    function missionOf(uint256 id) external view returns (Mission memory) {
        return _missions[id];
    }

    function activeMissionOf(address p) external view returns (uint256 id, Mission memory m) {
        id = _players[p].activeMission;
        m = _missions[id];
    }

    function missionCount() external view returns (uint256) {
        return _missions.length - 1;
    }

    /// @notice Every mission a player ever launched, oldest first.
    function missionIdsOf(address p) external view returns (uint256[] memory) {
        return _missionsOf[p];
    }

    // ------------------------------------------------------------------ views: market
    function listing(uint256 id) external view returns (Listing memory) {
        return _listings[id];
    }

    function listingCount() external view returns (uint256) {
        return _listings.length - 1;
    }

    function openListings() external view returns (uint256[] memory ids, Listing[] memory data) {
        uint256 n;
        for (uint256 i = 1; i < _listings.length; i++) if (_listings[i].status == ListingStatus.Open) n++;
        ids = new uint256[](n);
        data = new Listing[](n);
        uint256 k;
        for (uint256 i = 1; i < _listings.length; i++) {
            if (_listings[i].status == ListingStatus.Open) {
                ids[k] = i;
                data[k] = _listings[i];
                k++;
            }
        }
    }

    function listingsOf(address seller) external view returns (uint256[] memory ids, Listing[] memory data) {
        uint256 n;
        for (uint256 i = 1; i < _listings.length; i++) if (_listings[i].seller == seller) n++;
        ids = new uint256[](n);
        data = new Listing[](n);
        uint256 k;
        for (uint256 i = 1; i < _listings.length; i++) {
            if (_listings[i].seller == seller) {
                ids[k] = i;
                data[k] = _listings[i];
                k++;
            }
        }
    }

    function stats() external view returns (uint256 purchased, uint256 spentOnShips, uint256 spentOnRefits, uint256 volume, uint256 missions, uint256 available, uint256 distributed, uint256 paid) {
        return (shipsPurchased, tokensSpentOnShips, tokensSpentOnRefits, marketVolume, _missions.length - 1, vaultAvailable, vaultDistributed, missionsPaid);
    }

    function commanderCount() external view returns (uint256) {
        return _commanders.length;
    }

    function commanders(uint256 offset, uint256 limit) external view returns (address[] memory out) {
        uint256 n = _commanders.length;
        if (offset >= n) return out;
        uint256 end = offset + limit > n ? n : offset + limit;
        out = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) out[i - offset] = _commanders[i];
    }

    // ------------------------------------------------------------------ shipyard
    /// @notice Buy a hull at MK-I with the game token (approve first). 60% of the price funds the vault.
    function buyHull(uint8 hullId) external returns (uint256 shipId) {
        Hull memory h = _hulls[hullId];
        require(h.active, "hull");
        require(levelOf(msg.sender) >= h.levelRequired, "level");
        _pullSplit(msg.sender, h.price);
        shipsPurchased++;
        tokensSpentOnShips += h.price;
        shipId = _ships.length;
        _ships.push(Ship({owner: msg.sender, hull: hullId, mark: 1, listed: false}));
        _ownedIndex[shipId] = _owned[msg.sender].length;
        _owned[msg.sender].push(shipId);
        _join(msg.sender);
        _autoEquip(msg.sender, shipId);
        emit Purchased(msg.sender, hullId, shipId, h.price);
    }

    /// @notice Refit a hull one mark up (MK-V is the ceiling).
    function refit(uint256 shipId) external {
        Ship storage s = _ships[shipId];
        require(s.owner == msg.sender, "owner");
        require(!s.listed, "listed");
        uint256 cost = refitCost(shipId);
        _pullSplit(msg.sender, cost);
        tokensSpentOnRefits += cost;
        s.mark += 1;
        emit Refitted(msg.sender, shipId, s.mark, cost);
    }

    /// @notice Anyone can top up the reward vault.
    function fundVault(uint256 amount) external {
        _safeTransferFrom(msg.sender, address(this), amount);
        vaultAvailable += amount;
        emit VaultFunded(msg.sender, amount);
    }

    // ------------------------------------------------------------------ fleet
    function equip(uint8 slot, uint256 shipId) external {
        require(slot < 3, "slot");
        require(_players[msg.sender].activeMission == 0, "mission");
        Ship storage s = _ships[shipId];
        require(s.owner == msg.sender, "owner");
        require(!s.listed, "listed");
        uint256[3] storage f = _fleets[msg.sender];
        for (uint8 i = 0; i < 3; i++) if (f[i] == shipId) f[i] = 0;
        f[slot] = shipId;
        emit FleetChanged(msg.sender, f);
    }

    function unequip(uint8 slot) external {
        require(slot < 3, "slot");
        require(_players[msg.sender].activeMission == 0, "mission");
        _fleets[msg.sender][slot] = 0;
        emit FleetChanged(msg.sender, _fleets[msg.sender]);
    }

    // ------------------------------------------------------------------ missions
    /// @notice Launch an expedition. `commit` = keccak256(serverSeed), signed by the randomness server
    ///         over (chainId, game, player, nonce, commit). The chance stored here is the one that resolves.
    function launch(uint8 planetId, bytes32 commit, bytes calldata signature) external returns (uint256 id) {
        Player storage pl = _players[msg.sender];
        require(pl.activeMission == 0, "active");
        require(planetId >= 1 && planetId <= PLANET_COUNT, "planet");
        require(isUnlocked(msg.sender, planetId), "locked");
        (uint256 base, uint256 total, uint16 succ, uint16 rew, uint16 dur, uint16 rare, uint256[3] memory ids) = _fleet(msg.sender);
        require(base > 0, "fleet");
        Planet memory p = _planets[planetId];
        require(total >= p.minPower, "power");
        require(commit != bytes32(0), "commit");
        bytes32 h = keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, pl.nonce, commit));
        require(_recover(h, signature) == randomSigner, "sig");

        uint16 prob = _chanceBps(total, p, succ);
        uint64 endsAt = uint64(block.timestamp + _mulBpsRound(p.duration, dur));
        id = _missions.length;
        _missions.push();
        Mission storage m = _missions[id];
        m.player = msg.sender;
        m.planet = planetId;
        m.status = MissionStatus.Active;
        m.probabilityBps = prob;
        m.rewardMultBps = rew;
        m.rareMultBps = rare;
        m.fleetPower = uint32(total);
        m.startedAt = uint64(block.timestamp);
        m.endsAt = endsAt;
        m.commit = commit;
        m.entropy = blockhash(block.number - 1);
        m.ships = ids;
        pl.activeMission = id;
        pl.nonce += 1;
        _missionsOf[msg.sender].push(id);
        emit Launched(msg.sender, id, planetId, uint32(total), prob, endsAt);
    }

    /// @notice Resolve a finished expedition with the revealed server seed. Anyone may call it.
    function resolve(uint256 id, bytes32 seed) external {
        _resolve(id, seed);
    }

    /// @notice Resolve and collect in one transaction (the player's usual path).
    function resolveAndClaim(uint256 id, bytes32 seed) external {
        _resolve(id, seed);
        _claim(id);
    }

    function _resolve(uint256 id, bytes32 seed) internal {
        Mission storage m = _missions[id];
        require(m.status == MissionStatus.Active, "status");
        require(block.timestamp >= m.endsAt, "early");
        require(keccak256(abi.encodePacked(seed)) == m.commit, "seed");
        uint256 r1 = uint256(keccak256(abi.encodePacked(seed, m.entropy, id, uint8(1))));
        uint256 r2 = uint256(keccak256(abi.encodePacked(seed, m.entropy, id, uint8(2))));
        uint256 r3 = uint256(keccak256(abi.encodePacked(seed, m.entropy, id, uint8(3))));
        Planet memory p = _planets[m.planet];
        Player storage pl = _players[m.player];
        uint256 roll = r1 % BPS;
        bool success = roll < m.probabilityBps;
        uint256 xpGain;
        if (success) {
            uint256 lo = (uint256(p.rewardMin) * m.rewardMultBps) / BPS;
            uint256 hi = (uint256(p.rewardMax) * m.rewardMultBps) / BPS;
            uint256 base = lo + (r2 % (hi - lo + 1));
            uint256 rareBps = (uint256(p.rareBps) * m.rareMultBps) / BPS;
            if (rareBps > BPS) rareBps = BPS;
            bool rare = (r3 % BPS) < rareBps;
            uint256 bonus = rare ? (base * RARE_BONUS_BPS) / BPS : 0;
            uint256 total = base + bonus;
            if (total > vaultAvailable) total = vaultAvailable;
            uint256 paidBase = base > vaultAvailable ? vaultAvailable : base;
            m.success = true;
            m.rare = rare;
            m.reward = uint128(total);
            m.rareBonus = uint128(rare ? total - paidBase : 0);
            vaultAvailable -= total;
            vaultDistributed += total;
            missionsPaid += 1;
            pl.missionsSucceeded += 1;
            pl.totalMined += uint128(total);
            successesOn[m.player][m.planet] += 1;
            if (m.planet > pl.furthestPlanet) pl.furthestPlanet = m.planet;
            xpGain = p.xp;
        } else {
            xpGain = _mulBpsRound(p.xp, FAILURE_XP_BPS);
        }
        pl.xp += uint32(xpGain);
        pl.missionsCompleted += 1;
        m.status = MissionStatus.Resolved;
        emit Resolved(id, m.player, success, m.reward, m.rare, roll);
    }

    /// @notice Collect the reward (or close a failed mission) and free the fleet.
    function claim(uint256 id) external {
        _claim(id);
    }

    function _claim(uint256 id) internal {
        Mission storage m = _missions[id];
        require(m.player == msg.sender, "player");
        require(m.status == MissionStatus.Resolved, "status");
        m.status = MissionStatus.Claimed;
        _players[msg.sender].activeMission = 0;
        if (m.reward > 0) _safeTransfer(msg.sender, m.reward);
        emit Claimed(msg.sender, id, m.reward);
    }

    /// @notice If the seed is never revealed, the player frees the fleet after a grace period. No reward, no XP.
    function abort(uint256 id) external {
        Mission storage m = _missions[id];
        require(m.player == msg.sender, "player");
        require(m.status == MissionStatus.Active, "status");
        require(block.timestamp >= uint256(m.endsAt) + REVEAL_GRACE, "grace");
        m.status = MissionStatus.Aborted;
        _players[msg.sender].activeMission = 0;
        emit Aborted(msg.sender, id);
    }

    // ------------------------------------------------------------------ player market
    function list(uint256 shipId, uint128 price) external returns (uint256 id) {
        Ship storage s = _ships[shipId];
        require(s.owner == msg.sender, "owner");
        require(!s.listed, "listed");
        require(price > 0, "price");
        Player storage pl = _players[msg.sender];
        if (pl.activeMission != 0) {
            Mission storage m = _missions[pl.activeMission];
            for (uint8 i = 0; i < 3; i++) require(m.ships[i] != shipId, "on mission");
        } else {
            uint256[3] storage f = _fleets[msg.sender];
            for (uint8 i = 0; i < 3; i++) if (f[i] == shipId) f[i] = 0;
        }
        s.listed = true;
        id = _listings.length;
        _listings.push(Listing({shipId: shipId, seller: msg.sender, buyer: address(0), price: price, listedAt: uint64(block.timestamp), status: ListingStatus.Open}));
        emit Listed(id, shipId, msg.sender, price);
    }

    function cancel(uint256 id) external {
        Listing storage l = _listings[id];
        require(l.seller == msg.sender, "seller");
        require(l.status == ListingStatus.Open, "status");
        l.status = ListingStatus.Cancelled;
        _ships[l.shipId].listed = false;
        emit Cancelled(id);
    }

    /// @notice Buy a listed hull: the fee goes to the vault, the rest to the seller, the ship to you.
    function buy(uint256 id) external {
        Listing storage l = _listings[id];
        require(l.status == ListingStatus.Open, "status");
        require(msg.sender != l.seller, "own");
        uint256 fee = (uint256(l.price) * MARKET_FEE_BPS) / BPS;
        _safeTransferFrom(msg.sender, address(this), fee);
        vaultAvailable += fee;
        _safeTransferFrom(msg.sender, l.seller, l.price - fee);
        l.status = ListingStatus.Sold;
        l.buyer = msg.sender;
        Ship storage s = _ships[l.shipId];
        s.listed = false;
        _transferShip(l.shipId, l.seller, msg.sender);
        _join(msg.sender);
        _autoEquip(msg.sender, l.shipId);
        marketVolume += l.price;
        emit Sold(id, l.shipId, msg.sender, l.seller, l.price, fee);
    }

    // ------------------------------------------------------------------ admin
    function setRandomSigner(address a) external onlyOwner {
        randomSigner = a;
    }

    function setTreasury(address a) external onlyOwner {
        treasury = a;
    }

    function setHull(uint8 id, Hull calldata h) external onlyOwner {
        require(id < _hulls.length, "hull");
        _hulls[id] = h;
    }

    function addHull(Hull calldata h) external onlyOwner {
        require(_hulls.length < 255, "hulls");
        _hulls.push(h);
    }

    function setPlanet(uint8 id, Planet calldata p) external onlyOwner {
        require(id >= 1 && id <= PLANET_COUNT && p.recPower > p.minPower && p.rewardMax >= p.rewardMin, "planet");
        _planets[id] = p;
    }

    function transferOwnership(address a) external onlyOwner {
        emit OwnershipTransferred(owner, a);
        owner = a;
    }

    // ------------------------------------------------------------------ internals
    function _fleet(address p) internal view returns (uint256 base, uint256 total, uint16 succ, uint16 rew, uint16 dur, uint16 rare, uint256[3] memory ids) {
        ids = _fleets[p];
        uint8 mask;
        for (uint8 i = 0; i < 3; i++) {
            if (ids[i] == 0) continue;
            Ship memory s = _ships[ids[i]];
            base += _mulBpsRound(_hulls[s.hull].power, BPS + MARK_STEP_BPS * (s.mark - 1));
            mask |= uint8(1 << _hulls[s.hull].class);
        }
        total = base;
        rew = uint16(BPS);
        dur = uint16(BPS);
        rare = uint16(BPS);
        if (mask & 1 != 0) dur = SCOUT_DURATION_BPS;
        if (mask & 2 != 0) rew = MINER_REWARD_BPS;
        if (mask & 4 != 0) succ = CRUISER_SUCCESS_BPS;
        if (mask & 8 != 0) rare = DESTROYER_RARE_BPS;
        if (mask & 16 != 0) total = _mulBpsRound(total, DREADNOUGHT_POWER_BPS);
        if (mask & 32 != 0) total = _mulBpsRound(total, CAPITAL_POWER_BPS);
        uint256 cmd = _commanderBps(levelFor(_players[p].xp));
        if (cmd > 0) total = _mulBpsRound(total, BPS + cmd);
    }

    function _commanderBps(uint8 level) internal pure returns (uint256) {
        uint256 b = uint256(level > 1 ? level - 1 : 0) * COMMANDER_BPS_PER_LEVEL;
        return b > COMMANDER_CAP_BPS ? COMMANDER_CAP_BPS : b;
    }

    /// @dev The shared curve tables with integer linear interpolation — identical to the client.
    function _chanceBps(uint256 power, Planet memory p, uint16 successBonus) internal pure returns (uint16) {
        if (power < p.minPower) return 0;
        uint256 E6 = 1e6;
        uint256 bps;
        if (power < p.recPower) {
            uint16[17] memory tb = Tables.below();
            uint256 t6 = ((power - p.minPower) * E6) / (p.recPower - p.minPower);
            uint256 x = t6 * Tables.BELOW_STEPS;
            uint256 i = x / E6;
            uint256 f = x % E6;
            bps = i >= Tables.BELOW_STEPS ? tb[Tables.BELOW_STEPS] : tb[i] + ((uint256(tb[i + 1]) - tb[i]) * f) / E6;
        } else {
            uint256 r6 = (power * E6) / p.recPower;
            if (r6 >= E6 + Tables.ABOVE_RANGE_E6) {
                bps = Tables.CAP_BPS;
            } else {
                uint16[25] memory ta = Tables.above();
                uint256 x = (r6 - E6) * ((Tables.ABOVE_STEPS * E6) / Tables.ABOVE_RANGE_E6);
                uint256 i = x / E6;
                uint256 f = x % E6;
                bps = ta[i] + ((uint256(ta[i + 1]) - ta[i]) * f) / E6;
            }
        }
        bps += successBonus;
        if (bps > Tables.CAP_BPS) bps = Tables.CAP_BPS;
        return uint16(bps);
    }

    function _gates(uint8 pid) internal pure returns (uint32 needMissions, uint8 needLevel) {
        if (pid == 2) return (0, 0);
        if (pid == 3) return (2, 0);
        uint8 zone = (pid - 1) / 5 + 1;
        uint8 first = (zone - 1) * 5 + 1;
        if (pid == first) {
            uint8[7] memory zl = [0, 1, 3, 6, 10, 15, 20];
            return (uint32(zone - 1) * 4, zl[zone]);
        }
        return (uint32(pid) - 1, 0);
    }

    function _join(address p) internal {
        if (_joined[p]) return;
        _joined[p] = true;
        _commanders.push(p);
    }

    function _autoEquip(address p, uint256 shipId) internal {
        if (_players[p].activeMission != 0) return;
        uint256[3] storage f = _fleets[p];
        for (uint8 i = 0; i < 3; i++) {
            if (f[i] == 0) {
                f[i] = shipId;
                emit FleetChanged(p, f);
                return;
            }
        }
    }

    function _transferShip(uint256 shipId, address from, address to) internal {
        uint256[] storage list_ = _owned[from];
        uint256 idx = _ownedIndex[shipId];
        uint256 last = list_[list_.length - 1];
        list_[idx] = last;
        _ownedIndex[last] = idx;
        list_.pop();
        _ownedIndex[shipId] = _owned[to].length;
        _owned[to].push(shipId);
        _ships[shipId].owner = to;
    }

    function _pullSplit(address from, uint256 amount) internal {
        _safeTransferFrom(from, address(this), amount);
        uint256 toVault = (amount * VAULT_SHARE_BPS) / BPS;
        vaultAvailable += toVault;
        uint256 rest = amount - toVault;
        if (rest > 0) _safeTransfer(treasury, rest);
    }

    function _mulBpsRound(uint256 x, uint256 bps) internal pure returns (uint256) {
        return (x * bps + BPS / 2) / BPS;
    }

    function _safeTransfer(address to, uint256 amount) internal {
        (bool ok, bytes memory data) = address(token).call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transfer");
    }

    function _safeTransferFrom(address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = address(token).call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transferFrom");
    }

    function _recover(bytes32 h, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "siglen");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "sigv");
        bytes32 eth = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h));
        address a = ecrecover(eth, v, r, s);
        require(a != address(0), "sig0");
        return a;
    }
}
