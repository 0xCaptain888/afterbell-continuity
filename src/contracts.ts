import { readFile } from "node:fs/promises";
import { keccak256, type Abi, type Hex } from "viem";

type SolcContract = { abi: Abi; evm: { bytecode: { object: string } } };
type SolcOutput = Record<string, Record<string, SolcContract>>;

export type ContractArtifact = {
  contractName: string;
  abi: Abi;
  bytecode: Hex;
  bytecodeHash: Hex;
};

export async function loadContractArtifact(contractName: string, artifactPath = "artifacts/solc-output.json"): Promise<ContractArtifact> {
  const output = JSON.parse(await readFile(artifactPath, "utf8")) as SolcOutput;
  for (const fileContracts of Object.values(output)) {
    const contract = fileContracts[contractName];
    if (!contract) continue;
    const bytecode = `0x${contract.evm.bytecode.object}` as Hex;
    if (bytecode === "0x") throw new Error(`empty_bytecode_${contractName}`);
    return { contractName, abi: contract.abi, bytecode, bytecodeHash: keccak256(bytecode) };
  }
  throw new Error(`contract_artifact_not_found_${contractName}`);
}
