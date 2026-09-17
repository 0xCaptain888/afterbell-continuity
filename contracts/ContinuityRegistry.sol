// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ContinuityRegistry {
    address public owner;
    mapping(address => bool) public trustedSigners;
    mapping(bytes32 => bool) public revokedCredentials;
    mapping(bytes32 => bytes32) public passportEvidenceRoots;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SignerUpdated(address indexed signer, bool trusted);
    event CredentialRevoked(bytes32 indexed credentialDigest, string reason);
    event PassportAnchored(bytes32 indexed passportId, bytes32 indexed evidenceRoot, bytes32 indexed transactionHash);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address initialSigner) {
        owner = msg.sender;
        trustedSigners[initialSigner] = true;
        emit SignerUpdated(initialSigner, true);
    }

    function setSigner(address signer, bool trusted) external onlyOwner {
        require(signer != address(0), "zero signer");
        trustedSigners[signer] = trusted;
        emit SignerUpdated(signer, trusted);
    }

    function revokeCredential(bytes32 credentialDigest, string calldata reason) external onlyOwner {
        revokedCredentials[credentialDigest] = true;
        emit CredentialRevoked(credentialDigest, reason);
    }

    function anchorPassport(bytes32 passportId, bytes32 evidenceRoot, bytes32 transactionHash) external {
        require(passportEvidenceRoots[passportId] == bytes32(0), "passport exists");
        passportEvidenceRoots[passportId] = evidenceRoot;
        emit PassportAnchored(passportId, evidenceRoot, transactionHash);
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        require(nextOwner != address(0), "zero owner");
        emit OwnershipTransferred(owner, nextOwner);
        owner = nextOwner;
    }
}
