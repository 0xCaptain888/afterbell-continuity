// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVerifierRegistry {
    function trustedSigners(address signer) external view returns (bool);
}

contract ExecutionBondEscrow {
    enum State { NONE, BONDED, PASSED, CHALLENGED, REFUNDED }

    struct Bond {
        address executor;
        address beneficiary;
        bytes32 commitment;
        uint96 amount;
        uint64 challengeDeadline;
        State state;
    }

    IVerifierRegistry public immutable registry;
    mapping(bytes32 => Bond) public bonds;

    event BondOpened(bytes32 indexed intentHash, address indexed executor, address indexed beneficiary, uint256 amount, bytes32 commitment);
    event BondPassed(bytes32 indexed intentHash, address indexed verifier);
    event BondChallenged(bytes32 indexed intentHash, address indexed verifier, bytes32 evidenceHash);
    event BondClaimed(bytes32 indexed intentHash, address indexed recipient, uint256 amount);

    constructor(address registryAddress) {
        require(registryAddress != address(0), "zero registry");
        registry = IVerifierRegistry(registryAddress);
    }

    function openBond(bytes32 intentHash, address beneficiary, bytes32 commitment, uint64 challengeWindow) external payable {
        require(bonds[intentHash].state == State.NONE, "bond exists");
        require(msg.value > 0 && msg.value <= type(uint96).max, "invalid amount");
        require(beneficiary != address(0), "zero beneficiary");
        bonds[intentHash] = Bond({
            executor: msg.sender,
            beneficiary: beneficiary,
            commitment: commitment,
            amount: uint96(msg.value),
            challengeDeadline: uint64(block.timestamp) + challengeWindow,
            state: State.BONDED
        });
        emit BondOpened(intentHash, msg.sender, beneficiary, msg.value, commitment);
    }

    function pass(bytes32 intentHash) external {
        require(registry.trustedSigners(msg.sender), "untrusted verifier");
        Bond storage bond = bonds[intentHash];
        require(bond.state == State.BONDED, "not bonded");
        bond.state = State.PASSED;
        emit BondPassed(intentHash, msg.sender);
    }

    function challenge(bytes32 intentHash, bytes32 evidenceHash) external {
        require(registry.trustedSigners(msg.sender), "untrusted verifier");
        Bond storage bond = bonds[intentHash];
        require(bond.state == State.BONDED, "not bonded");
        require(block.timestamp <= bond.challengeDeadline, "challenge window closed");
        bond.state = State.CHALLENGED;
        emit BondChallenged(intentHash, msg.sender, evidenceHash);
    }

    function claim(bytes32 intentHash) external {
        Bond storage bond = bonds[intentHash];
        require(bond.amount > 0, "nothing to claim");
        address recipient;
        if (bond.state == State.PASSED || (bond.state == State.BONDED && block.timestamp > bond.challengeDeadline)) {
            recipient = bond.executor;
        } else if (bond.state == State.CHALLENGED) {
            recipient = bond.beneficiary;
        } else {
            revert("not claimable");
        }
        uint256 amount = bond.amount;
        bond.amount = 0;
        bond.state = State.REFUNDED;
        (bool ok,) = recipient.call{value: amount}("");
        require(ok, "claim failed");
        emit BondClaimed(intentHash, recipient, amount);
    }
}
