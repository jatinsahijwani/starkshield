'use strict';

const fs = require('fs-extra');
const path = require('path');
const { spawnSync } = require('child_process');

// ─── Constants ────────────────────────────────────────────────────────────────

const NETWORK = 'sepolia';
const CONTRACT_NAME = 'Groth16VerifierBN254';

// ─── Core runner ──────────────────────────────────────────────────────────────

/**
 * Run a shell command using spawnSync so we always capture BOTH stdout and
 * stderr. sncast prints its results (class hash, contract address) to stderr
 * in many versions, so execSync/stdout-only is not reliable.
 *
 * Returns { stdout, stderr, combined, status }.
 * Does NOT throw — callers check status and combined themselves.
 */
function run(cmd, cwd) {
  // Split the command string into argv array for spawnSync.
  // We use shell:true to support multi-line commands with backslash continuation.
  const result = spawnSync(cmd, {
    shell: true,
    encoding: 'utf8',
    cwd: cwd || process.cwd(),
  });

  const stdout   = result.stdout || '';
  const stderr   = result.stderr || '';
  const combined = stdout + stderr;

  return {
    stdout,
    stderr,
    combined,
    status: result.status ?? 1,
  };
}

// ─── Path resolution ──────────────────────────────────────────────────────────

/**
 * Resolve and validate the folder structure that compile produces:
 *
 *   <folderPath>/                    ← absFolder       (e.g. ./simple)
 *   ├── simple.r1cs
 *   ├── circuit_final.zkey
 *   ├── verification_key.json
 *   ├── simple_js/simple.wasm
 *   └── simple/                      ← scarbProjectDir (e.g. ./simple/simple)
 *       ├── Scarb.toml
 *       ├── src/
 *       └── tests/
 */
function resolvePaths(folderPath) {
  const absFolder    = path.resolve(folderPath);
  const circuitName  = path.basename(absFolder);
  const scarbProjectDir = path.join(absFolder, circuitName);

  if (!fs.existsSync(absFolder)) {
    console.error(`❌ Output folder not found: ${absFolder}`);
    console.error('   Run "npx starkshield compile <circuit.circom>" first.');
    process.exit(1);
  }

  const expectedFiles = [
    path.join(absFolder, 'verification_key.json'),
    path.join(absFolder, 'circuit_final.zkey'),
    path.join(absFolder, `${circuitName}.r1cs`),
  ];
  for (const f of expectedFiles) {
    if (!fs.existsSync(f)) {
      console.error(`❌ Missing compile artefact: ${f}`);
      console.error('   Re-run "npx starkshield compile <circuit.circom>".');
      process.exit(1);
    }
  }

  if (!fs.existsSync(path.join(scarbProjectDir, 'Scarb.toml'))) {
    console.error(`❌ Scarb.toml not found in: ${scarbProjectDir}`);
    console.error('   Re-run "npx starkshield compile <circuit.circom>".');
    process.exit(1);
  }

  return { absFolder, circuitName, scarbProjectDir };
}

// ─── Account management ───────────────────────────────────────────────────────

function importAccount(accountName, privateKey, accountAddress) {
  console.log(`\n🔑 Registering account "${accountName}" with sncast ...`);

  // Remove stale entry silently.
  run(`sncast account delete --name ${accountName} --network-name alpha-${NETWORK}`);

  const { combined, status } = run(
    `sncast account import \
      --network ${NETWORK} \
      --name ${accountName} \
      --address ${accountAddress} \
      --private-key ${privateKey} \
      --type oz`,
  );

  if (status !== 0 && !combined.toLowerCase().includes('already')) {
    console.error('❌ Failed to register account with sncast:');
    console.error(combined);
    process.exit(1);
  }

  console.log('✅ Account registered.');
}

function cleanupAccount(accountName) {
  const { status } = run(
    `sncast account delete --name ${accountName} --network-name alpha-${NETWORK}`,
  );
  if (status === 0) {
    console.log(`🧹 Temporary account "${accountName}" removed.`);
  } else {
    console.warn(`⚠️  Could not remove temporary account "${accountName}" — remove it manually if needed.`);
  }
}

// ─── Output parsers ───────────────────────────────────────────────────────────

/**
 * Extract a class hash from any sncast declare output format:
 *
 *   JSON:                { "class_hash": "0x..." }
 *   Labeled:             class_hash: 0x...
 *   Parenthesised:       ClassHash(0x...)
 *   Error sentence:      "with hash 0x..."
 *   Fallback:            any 0x value that is 60-64 hex chars (full felt252)
 */
function extractClassHash(text) {
  if (!text) return null;

  try {
    const data = JSON.parse(text.trim());
    const h = data.class_hash || data.result?.class_hash;
    if (h) return h;
  } catch (_) {}

  const patterns = [
    /class[_\s-]hash[\s:=]+\s*(0x[0-9a-fA-F]+)/i,
    /[Cc]lass[Hh]ash\s*\(\s*(0x[0-9a-fA-F]+)\s*\)/,
    /with\s+hash\s+(0x[0-9a-fA-F]+)/i,
    /hash[:\s]+(0x[0-9a-fA-F]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }

  // Any full felt252-length hex value
  const all = [...text.matchAll(/0x[0-9a-fA-F]{60,64}/g)];
  if (all.length > 0) return all[0][0];

  return null;
}

/**
 * Extract a deployed contract address from sncast deploy output.
 */
function extractContractAddress(text) {
  if (!text) return null;

  try {
    const data = JSON.parse(text.trim());
    const a = data.contract_address || data.address || data.result?.contract_address;
    if (a) return a;
  } catch (_) {}

  const patterns = [
    /contract[_\s]address[\s:=]+\s*(0x[0-9a-fA-F]+)/i,
    /address[\s:=]+\s*(0x[0-9a-fA-F]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }

  const all = [...text.matchAll(/0x[0-9a-fA-F]{60,64}/g)];
  if (all.length > 0) return all[0][0];

  return null;
}

// ─── ABI extraction ───────────────────────────────────────────────────────────

function extractAbi(scarbProjectDir) {
  const targetDevDir = path.join(scarbProjectDir, 'target', 'dev');

  if (!fs.existsSync(targetDevDir)) {
    throw new Error(`Build artefacts not found at: ${targetDevDir}`);
  }

  const files = fs.readdirSync(targetDevDir);
  const contractFile = files.find(
    (f) => f.endsWith('.contract_class.json') || f.endsWith('.sierra.json'),
  );

  if (!contractFile) {
    throw new Error(
      `No .contract_class.json found in ${targetDevDir}.\nFiles: ${files.join(', ')}`,
    );
  }

  const sierra = fs.readJsonSync(path.join(targetDevDir, contractFile));
  if (!sierra.abi || sierra.abi.length === 0) {
    throw new Error(`ABI is empty in ${contractFile}.`);
  }
  return sierra.abi;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build, declare, and deploy the Garaga Groth16 verifier to Starknet Sepolia.
 *
 * Writes <folderPath>/deployment.json on success with everything verifyProof needs.
 *
 * @param {string} folderPath      Root circuit output folder  (e.g. ./simple)
 * @param {string} privateKey      Starknet account private key (0x-prefixed)
 * @param {string} accountAddress  Starknet account address     (0x-prefixed)
 */
async function deployVerifier(folderPath, privateKey, accountAddress) {

  if (!folderPath || !privateKey || !accountAddress) {
    console.error('❌ Usage: npx starkshield deploy <folder> <privateKey> <accountAddress>');
    process.exit(1);
  }

  // ── 1. Validate folder structure ───────────────────────────────────────────

  const { absFolder, circuitName, scarbProjectDir } = resolvePaths(folderPath);

  console.log('');
  console.log('🛡  StarkShield — Deploy');
  console.log(`   Circuit      : ${circuitName}`);
  console.log(`   Output folder: ${absFolder}`);
  console.log(`   Scarb project: ${scarbProjectDir}`);
  console.log(`   Network      : ${NETWORK}`);

  // ── 2. Register account ────────────────────────────────────────────────────

  const accountName = `starkshield-${circuitName}-${Date.now()}`;
  importAccount(accountName, privateKey, accountAddress);

  try {

    // ── 3. Build ───────────────────────────────────────────────────────────────

    console.log(`\n🔨 Building Cairo verifier (scarb build) ...`);
    const build = run('scarb build', scarbProjectDir);
    if (build.status !== 0) {
      console.error('❌ scarb build failed:');
      console.error(build.combined);
      process.exit(1);
    }
    console.log('✅ Build complete.');

    // ── 4. Extract ABI ────────────────────────────────────────────────────────

    console.log('\n📄 Extracting ABI from build artefacts ...');
    const abi = extractAbi(scarbProjectDir);
    console.log(`✅ ABI extracted (${abi.length} entries).`);

    // ── 5. Declare ────────────────────────────────────────────────────────────

    console.log(`\n📢 Declaring ${CONTRACT_NAME} on ${NETWORK} ...`);
    let classHash;

    const declare = run(
      `sncast --account ${accountName} \
        declare \
        --contract-name ${CONTRACT_NAME} \
        --network ${NETWORK}`,
      scarbProjectDir,
    );

    console.log('── sncast declare stdout ──────────────────────────────────');
    console.log(declare.stdout || '(empty)');
    console.log('── sncast declare stderr ──────────────────────────────────');
    console.log(declare.stderr || '(empty)');
    console.log('───────────────────────────────────────────────────────────');

    const declareText = declare.combined;
    const alreadyDeclared =
      declareText.toLowerCase().includes('already declared') ||
      declareText.toLowerCase().includes('class hash already exists') ||
      declareText.toLowerCase().includes('contract class already declared');

    if (declare.status === 0 || alreadyDeclared) {
      classHash = extractClassHash(declareText);
    }

    if (!classHash && alreadyDeclared) {
      // Class is on-chain but we couldn't get the hash from the error — compute locally.
      console.log('ℹ️  Class already on-chain. Computing hash locally ...');
      const hashResult = run(
        `sncast class-hash --contract-name ${CONTRACT_NAME}`,
        scarbProjectDir,
      );
      console.log('class-hash output:', hashResult.combined);
      classHash = extractClassHash(hashResult.combined);
    }

    if (!classHash) {
      console.error('❌ Could not extract class hash. Full declare output was:');
      console.error(declareText);
      process.exit(1);
    }

    console.log(`✅ Class hash: ${classHash}`);

    // ── 6. Deploy ─────────────────────────────────────────────────────────────

    console.log(`\n🚀 Deploying contract instance on ${NETWORK} ...`);

    const deploy = run(
      `sncast --account ${accountName} \
        deploy \
        --class-hash ${classHash} \
        --network ${NETWORK}`,
      scarbProjectDir,
    );

    console.log('── sncast deploy stdout ───────────────────────────────────');
    console.log(deploy.stdout || '(empty)');
    console.log('── sncast deploy stderr ───────────────────────────────────');
    console.log(deploy.stderr || '(empty)');
    console.log('───────────────────────────────────────────────────────────');

    if (deploy.status !== 0 && !deploy.combined.toLowerCase().includes('contract_address')) {
      console.error('❌ sncast deploy failed. See output above.');
      process.exit(1);
    }

    const contractAddress = extractContractAddress(deploy.combined);
    if (!contractAddress) {
      console.error('❌ Deploy appeared to succeed but contract address could not be parsed.');
      console.error('   Full output was printed above. Save the address manually if visible.');
      process.exit(1);
    }

    console.log(`✅ Contract deployed at: ${contractAddress}`);

    // ── 7. Write deployment.json ──────────────────────────────────────────────

    const deploymentInfo = {
      contractAddress,
      classHash,
      abi,
      circuitName,
      network: NETWORK,
      paths: {
        verificationKey: path.join(absFolder, 'verification_key.json'),
        zkey:            path.join(absFolder, 'circuit_final.zkey'),
        wasm:            path.join(absFolder, `${circuitName}_js`, `${circuitName}.wasm`),
        r1cs:            path.join(absFolder, `${circuitName}.r1cs`),
      },
      deployedAt: new Date().toISOString(),
    };

    const deploymentJsonPath = path.join(absFolder, 'deployment.json');
    fs.writeJsonSync(deploymentJsonPath, deploymentInfo, { spaces: 2 });

    // ── 8. Summary ────────────────────────────────────────────────────────────

    console.log('');
    console.log('');
    console.log('  ✅  Deployment complete!');
    console.log(`  Circuit  : ${circuitName}`);
    console.log(`  Address  : ${contractAddress}`);
    console.log(`  Network  : ${NETWORK}`);
    console.log(`  Explorer : https://sepolia.starkscan.co/contract/${contractAddress}`);
    console.log(`  Saved to : ${deploymentJsonPath}`);
    console.log('');
    console.log('You can now call verifyProof() — it reads deployment.json automatically.');

  } finally {
    cleanupAccount(accountName);
  }
}

module.exports = { deployVerifier };