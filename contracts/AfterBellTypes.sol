// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library AfterBellTypes {
    bytes32 internal constant CREDENTIAL_TYPEHASH = keccak256(
        "ContinuityCredential(bytes32 schemaHash,address asset,bytes32 underlyingHash,uint256 economicExposureMicros,bytes32 rightsFingerprintHash,bytes32 equivalenceClassHash,uint8 status,uint8 riskTier,uint64 issuedAt,uint64 expiresAt,bytes32 nonce,bytes32 evidenceRoot)"
    );

    struct ContinuityCredential {
        bytes32 schemaHash;
        address asset;
        bytes32 underlyingHash;
        uint256 economicExposureMicros;
        bytes32 rightsFingerprintHash;
        bytes32 equivalenceClassHash;
        uint8 status;
        uint8 riskTier;
        uint64 issuedAt;
        uint64 expiresAt;
        bytes32 nonce;
        bytes32 evidenceRoot;
    }

    function structHash(ContinuityCredential calldata credential) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                CREDENTIAL_TYPEHASH,
                credential.schemaHash,
                credential.asset,
                credential.underlyingHash,
                credential.economicExposureMicros,
                credential.rightsFingerprintHash,
                credential.equivalenceClassHash,
                credential.status,
                credential.riskTier,
                credential.issuedAt,
                credential.expiresAt,
                credential.nonce,
                credential.evidenceRoot
            )
        );
    }

    function recover(bytes32 digest, bytes calldata signature) internal pure returns (address signer) {
        require(signature.length == 65, "invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        require(v == 27 || v == 28, "invalid signature v");
        require(uint256(s) <= 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0, "invalid signature s");
        signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "invalid signature");
    }
}
