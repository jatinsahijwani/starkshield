'use strict';

const fs = require('fs-extra');
const path = require('path');
const { spawnSync } = require('child_process');

// ─── Constants ────────────────────────────────────────────────────────────────

const NETWORK       = 'sepolia';
const CONTRACT_NAME = 'Groth16VerifierBN254';
const ACCOUNTS_FILE = path.join(process.env.HOME, '.starknet_accounts', 'starknet_open_zeppelin_accounts.json');

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
  const result = spawnSync(cmd, {
    shell: true,
    encoding: 'utf8',
    cwd: cwd || process.cwd(),
  });

  const stdout   = result.stdout || '';
  const stderr   = result.stderr || '';
  const combined = stdout + stderr;

  return { stdout, stderr, combined, status: result.status ?? 1 };
}

// ─── Path resolution ──────────────────────────────────────────────────────────

function resolvePaths(folderPath) {
  const absFolder       = path.resolve(folderPath);
  const circuitName     = path.basename(absFolder);
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

// ─── snfoundry.toml writer ────────────────────────────────────────────────────

/**
 * Write an snfoundry.toml into the scarb project directory.
 *
 * This is the most reliable way to configure sncast — it avoids all
 * flag-ordering issues and inconsistencies across sncast versions.
 * When sncast is run from scarbProjectDir it reads this file automatically,
 * picking up account name, accounts-file path, and network with no extra flags.
 */
function writeSnfoundryToml(scarbProjectDir, accountName) {
  const tomlContent = [
    `[sncast.default]`,
    `network = "sepolia"`,
    `accounts-file = "${ACCOUNTS_FILE}"`,
    `account = "${accountName}"`,
    ``,
  ].join('\n');

  const tomlPath = path.join(scarbProjectDir, 'snfoundry.toml');
  fs.writeFileSync(tomlPath, tomlContent, 'utf8');
  console.log(`📝 snfoundry.toml written at ${tomlPath}`);
}

// ─── Account management ───────────────────────────────────────────────────────

function importAccount(accountName, privateKey, accountAddress) {
  console.log(`\n🔑 Registering account "${accountName}" with sncast ...`);

  // Ensure the accounts directory exists so sncast can write the JSON file
  fs.ensureDirSync(path.dirname(ACCOUNTS_FILE));

  // Remove any stale entry silently — ignore failure, it may not exist yet
  run(`sncast account delete --name ${accountName} --network-name sepolia --yes`);

  // Single-line import — --network is correct for account subcommand (not --url)
  const { combined, status } = run(
    `sncast account import --network ${NETWORK} --name ${accountName} --address ${accountAddress} --private-key ${privateKey} --type oz`
  );

  if (status !== 0 && !combined.toLowerCase().includes('already')) {
    console.error('❌ Failed to register account with sncast:');
    console.error(combined);
    process.exit(1);
  }

  // Hard-verify the accounts file was actually written to disk
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    console.error('❌ sncast account import ran but the accounts file was NOT created.');
    console.error(`   Expected file at: ${ACCOUNTS_FILE}`);
    console.error(`   sncast output was: ${combined}`);
    process.exit(1);
  }

  console.log('✅ Account registered.');
}

function cleanupAccount(accountName) {
  const { status } = run(
    `sncast account delete --name ${accountName} --network-name sepolia --yes`
  );
  if (status === 0) {
    console.log(`🧹 Temporary account "${accountName}" removed.`);
  } else {
    console.warn(`⚠️  Could not remove temporary account "${accountName}" — remove it manually if needed.`);
  }
}

// ─── Output parsers ───────────────────────────────────────────────────────────

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

  const all = [...text.matchAll(/0x[0-9a-fA-F]{60,64}/g)];
  if (all.length > 0) return all[0][0];

  return null;
}

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

  // ── 3. Write snfoundry.toml ────────────────────────────────────────────────
  // This tells every subsequent sncast command which account, accounts-file,
  // and network to use — no per-command flags needed, no ordering issues.
  writeSnfoundryToml(scarbProjectDir, accountName);

  try {

    // ── 4. Build ───────────────────────────────────────────────────────────────

    console.log(`\n🔨 Building Cairo verifier (scarb build) ...`);
    const build = run('scarb build', scarbProjectDir);
    if (build.status !== 0) {
      console.error('❌ scarb build failed:');
      console.error(build.combined);
      process.exit(1);
    }
    console.log('✅ Build complete.');

    // ── 5. Extract ABI ────────────────────────────────────────────────────────

    console.log('\n📄 Extracting ABI from build artefacts ...');
    const abi = extractAbi(scarbProjectDir);
    console.log(`✅ ABI extracted (${abi.length} entries).`);

    // ── 6. Declare ────────────────────────────────────────────────────────────

    console.log(`\n📢 Declaring ${CONTRACT_NAME} on ${NETWORK} ...`);
    let classHash;

    // No flags needed — sncast reads everything from snfoundry.toml
    const declare = run(
      `sncast declare --contract-name ${CONTRACT_NAME}`,
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

    // ── 7. Wait for declare tx to be accepted on-chain ────────────────────────
    // Deploy immediately after declare fails with "Class not declared" because
    // the transaction hasn't been confirmed yet. Wait 30s for Sepolia finality.

    if (!alreadyDeclared) {
      console.log('\n⏳ Waiting 30s for declare transaction to be accepted on-chain ...');
      run('sleep 30');
      console.log('✅ Wait complete.');
    }

    // ── 8. Deploy ─────────────────────────────────────────────────────────────

    console.log(`\n🚀 Deploying contract instance on ${NETWORK} ...`);

    // No flags needed — sncast reads everything from snfoundry.toml
    const deploy = run(
      `sncast deploy --class-hash ${classHash}`,
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

    // ── 9. Write deployment.json ──────────────────────────────────────────────

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

    // ── 10. Summary ───────────────────────────────────────────────────────────

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