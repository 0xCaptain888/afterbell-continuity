// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AfterBellTypes} from "./AfterBellTypes.sol";

interface IContinuityRegistry {
    function trustedSigners(address signer) external view returns (bool);
    function revokedCredentials(bytes32 digest) external view returns (bool);
}

interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract GuardedStockVault {
    using AfterBellTypes for AfterBellTypes.ContinuityCredential;

    bytes32 private constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256("AfterBell Continuity");
    bytes32 private constant VERSION_HASH = keccak256("1");

    IContinuityRegistry public immutable registry;
    mapping(address => mapping(address => uint256)) public balances;
    mapping(bytes32 => bool) public consumedNonces;

    event GuardedDeposit(address indexed account, address indexed asset, uint256 amount, bytes32 indexed credentialDigest);
    event Withdrawal(address indexed account, address indexed asset, uint256 amount);

    constructor(address registryAddress) {
        require(registryAddress != address(0), "zero registry");
        registry = IContinuityRegistry(registryAddress);
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(registry)));
    }

    function credentialDigest(AfterBellTypes.ContinuityCredential calldata credential) public view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), credential.structHash()));
    }

    function verifyCredential(
        AfterBellTypes.ContinuityCredential calldata credential,
        bytes calldata signature
    ) public view returns (bytes32 digest, address signer) {
        require(credential.asset != address(0), "zero asset");
        require(credential.status == 0, "credential not valid");
        require(credential.issuedAt <= block.timestamp, "credential not active");
        require(credential.expiresAt > block.timestamp, "credential expired");
        require(credential.riskTier <= 1, "risk tier too high");
        digest = credentialDigest(credential);
        require(!registry.revokedCredentials(digest), "credential revoked");
        signer = AfterBellTypes.recover(digest, signature);
        require(registry.trustedSigners(signer), "untrusted signer");
    }

    function deposit(
        uint256 amount,
        AfterBellTypes.ContinuityCredential calldata credential,
        bytes calldata signature
    ) external {
        require(amount > 0, "zero amount");
        (bytes32 digest,) = verifyCredential(credential, signature);
        require(!consumedNonces[credential.nonce], "credential nonce consumed");
        consumedNonces[credential.nonce] = true;
        require(IERC20Minimal(credential.asset).transferFrom(msg.sender, address(this), amount), "transfer failed");
        balances[msg.sender][credential.asset] += amount;
        emit GuardedDeposit(msg.sender, credential.asset, amount, digest);
    }

    function withdraw(address asset, uint256 amount) external {
        uint256 current = balances[msg.sender][asset];
        require(amount > 0 && current >= amount, "insufficient balance");
        balances[msg.sender][asset] = current - amount;
        require(IERC20Minimal(asset).transfer(msg.sender, amount), "transfer failed");
        emit Withdrawal(msg.sender, asset, amount);
    }
}
