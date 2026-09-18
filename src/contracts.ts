import { readFile } from "node:fs/promises";
import { keccak256, type Abi, type Hex } from "viem";

type ImmutableReference = { start: number; length: number };
type SolcContract = {
  abi: Abi;
  metadata?: string;
  evm: {
    bytecode: { object: string };
    deployedBytecode: { object: string; immutableReferences?: Record<string, ImmutableReference[]> };
  };
};
type SolcOutput = Record<string, Record<string, SolcContract>>;

export type ContractArtifact = {
  contractName: string;
  abi: Abi;
  bytecode: Hex;
  bytecodeHash: Hex;
  runtimeBytecode: Hex;
  runtimeBytecodeHash: Hex;
  immutableReferences: Record<string, ImmutableReference[]>;
  metadata?: string;
};

export async function loadContractArtifact(contractName: string, artifactPath = "artifacts/solc-output.json"): Promise<ContractArtifact> {
  const output = JSON.parse(await readFile(artifactPath, "utf8")) as SolcOutput;
  for (const fileContracts of Object.values(output)) {
    const contract = fileContracts[contractName];
    if (!contract) continue;
    const bytecode = `0x${contract.evm.bytecode.object}` as Hex;
    if (bytecode === "0x") throw new Error(`empty_bytecode_${contractName}`);
    const runtimeBytecode = `0x${contract.evm.deployedBytecode.object}` as Hex;
    if (runtimeBytecode === "0x") throw new Error(`empty_runtime_bytecode_${contractName}`);
    return {
      contractName,
      abi: contract.abi,
      bytecode,
      bytecodeHash: keccak256(bytecode),
      runtimeBytecode,
      runtimeBytecodeHash: keccak256(runtimeBytecode),
      immutableReferences: contract.evm.deployedBytecode.immutableReferences ?? {},
      ...(contract.metadata ? { metadata: contract.metadata } : {})
    };
  }
  throw new Error(`contract_artifact_not_found_${contractName}`);
}
