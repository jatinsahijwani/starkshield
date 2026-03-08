'use strict';

const fs = require('fs-extra');
const path = require('path');
const snarkjs = require('snarkjs');

const SEPOLIA_RPC = 'https://rpc.starknet-testnet.lava.build';

function convertProof(proof, publicSignals, CurveId) {
  const B = (s) => BigInt(s);
  return {
    a: { x: B(proof.pi_a[0]), y: B(proof.pi_a[1]), curveId: CurveId.BN254 },
    b: {
      x: [B(proof.pi_b[0][0]), B(proof.pi_b[0][1])],
      y: [B(proof.pi_b[1][0]), B(proof.pi_b[1][1])],
      curveId: CurveId.BN254,
    },
    c: { x: B(proof.pi_c[0]), y: B(proof.pi_c[1]), curveId: CurveId.BN254 },
    publicInputs: publicSignals.map(B),
  };
}

function convertVk(vk, CurveId) {
  const B = (s) => BigInt(s);
  return {
    alpha: { x: B(vk.vk_alpha_1[0]), y: B(vk.vk_alpha_1[1]), curveId: CurveId.BN254 },
    beta: {
      x: [B(vk.vk_beta_2[0][0]),  B(vk.vk_beta_2[0][1])],
      y: [B(vk.vk_beta_2[1][0]),  B(vk.vk_beta_2[1][1])],
      curveId: CurveId.BN254,
    },
    gamma: {
      x: [B(vk.vk_gamma_2[0][0]), B(vk.vk_gamma_2[0][1])],
      y: [B(vk.vk_gamma_2[1][0]), B(vk.vk_gamma_2[1][1])],
      curveId: CurveId.BN254,
    },
    delta: {
      x: [B(vk.vk_delta_2[0][0]), B(vk.vk_delta_2[0][1])],
      y: [B(vk.vk_delta_2[1][0]), B(vk.vk_delta_2[1][1])],
      curveId: CurveId.BN254,
    },
    ic: vk.IC.map(p => ({ x: B(p[0]), y: B(p[1]), curveId: CurveId.BN254 })),
  };
}

/**
 * Generate a Groth16 ZK proof from the given inputs and verify it on-chain.
 *
 * Usage:
 *   const { verifyProof } = require("starkshield");
 *   const result = await verifyProof({ input: { a: 3, b: 11 } }, "./simple");
 *   console.log(result ? "✅ Valid proof" : "❌ Invalid proof");
 *
 * @param {{ input: Record<string, any> }} options
 * @param {string} folderPath - Path to the circuit output folder (e.g. "./simple")
 * @returns {Promise<boolean>}
 */
async function verifyProof({ input }, folderPath) {

  // ── 1. Load deployment.json ─────────────────────────────────────────────────

  const absFolder = path.resolve(folderPath);
  const deploymentPath = path.join(absFolder, 'deployment.json');

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      `deployment.json not found at: ${deploymentPath}\n` +
      'Run "npx starkshield deploy <folder> <privateKey> <accountAddress>" first.',
    );
  }

  const { contractAddress, abi, paths, network } = fs.readJsonSync(deploymentPath);

  if (!contractAddress) throw new Error('deployment.json missing contractAddress. Re-run deploy.');
  if (!paths?.wasm || !paths?.zkey || !paths?.verificationKey) {
    throw new Error('deployment.json missing paths. Re-run deploy.');
  }

  for (const [key, filePath] of Object.entries(paths)) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Circuit artefact not found (${key}): ${filePath}`);
    }
  }

  // ── 2. Generate proof with snarkjs ──────────────────────────────────────────

  console.log('🔐 Generating ZK proof ...');

  const { proof: snarkjsProof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    paths.wasm,
    paths.zkey,
  );

  console.log('✅ Proof generated. Public signals:', publicSignals);

  // ── 3. Build Garaga calldata ────────────────────────────────────────────────

  console.log('🔄 Converting proof to Garaga calldata ...');

  const { init, getGroth16CallData, CurveId } = require('garaga');
  await init();

  const rawVk = fs.readJsonSync(paths.verificationKey);
  const proof = convertProof(snarkjsProof, publicSignals, CurveId);
  const vk    = convertVk(rawVk, CurveId);

  // Garaga returns bigint[] where [0] is already the Span length prefix.
  const calldataHex = getGroth16CallData(proof, vk, CurveId.BN254)
    .map(v => '0x' + v.toString(16));

  console.log(`✅ Calldata prepared (${calldataHex.length} felt252 values).`);

  // ── 4. Call the verifier contract on Starknet ───────────────────────────────
  //
  // ABI shows the function is inside an interface, not at top level.
  // We use RPC directly via provider.callContract to avoid starknet.js
  // ABI parsing issues with nested interfaces and Result return types.
  //
  // The function returns Result<Span<u256>, felt252>:
  //   Ok  → proof is valid   (variant index 0)
  //   Err → proof is invalid (variant index 1)

  console.log(`\n📡 Calling verify_groth16_proof_bn254 on ${network} ...`);
  console.log(`   Contract: ${contractAddress}`);

  const { RpcProvider } = require('starknet');
  const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC });

  let response;
  try {
    response = await provider.callContract({
      contractAddress,
      entrypoint: 'verify_groth16_proof_bn254',
      calldata: calldataHex,
    });
  } catch (err) {
    throw new Error(`On-chain call failed: ${err.message}`);
  }

  console.log('   Raw response:', response);

  // Result<Span<u256>, felt252> encoding:
  //   response[0] = 0x0 → Ok  (proof valid)
  //   response[0] = 0x1 → Err (proof invalid)
  const variant = BigInt(response[0]);
  const verified = variant === 0n;

  console.log(verified ? '\n✅ Proof is VALID on-chain!' : '\n❌ Proof is INVALID on-chain.');
  return verified;
}

module.exports = { verifyProof };