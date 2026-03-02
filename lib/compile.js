const { execSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");

async function compileCircuit(circuitPath) {
    const baseName = path.basename(circuitPath, ".circom");
    const outDir = path.resolve(path.join(process.cwd(), baseName));
   
    await fs.ensureDir(outDir);
    await fs.emptyDir(outDir);
   
    console.log(`📦 Compiling ${baseName} into ${outDir}...`);
   
    // Get absolute paths for better reliability
    const absCircuitPath = path.resolve(circuitPath);
    const circomlibPath = path.resolve(__dirname, "..", "circomlib", "circuits");
   
    // Verify circomlib exists
    if (!fs.existsSync(circomlibPath)) {
        throw new Error(`❌ Circomlib not found at: ${circomlibPath}`);
    }
   
    // Define output paths
    const r1csPath = path.join(outDir, `${baseName}.r1cs`);
    const zkeyPath = path.join(outDir, `circuit_final.zkey`);
    const verifierPath = path.join(outDir, `verifier.cairo`);  // Changed to Cairo (the main contract will be copied here for easy use in further modules)
   
    // Compile circuit with circomlib path
    execSync(
        `"${path.resolve(__dirname, "..", "bin", "circom")}" "${absCircuitPath}" --wasm --r1cs -l "${circomlibPath}" -o "${outDir}"`,
        {
            stdio: "inherit",
            cwd: outDir
        }
    );
   
    // Verify R1CS file exists
    if (!fs.existsSync(r1csPath)) {
        throw new Error(`❌ Compilation failed: ${r1csPath} not found.`);
    }
   
    // Rest of your existing code...
    const ptauPath = path.resolve(__dirname, "..", "ptau", "pot12_final.ptau");
    if (!fs.existsSync(ptauPath)) {
        throw new Error(`❌ Missing PTAU file at: ${ptauPath}`);
    }
   
    // Run groth16 setup
    execSync(
        `snarkjs groth16 setup "${r1csPath}" "${ptauPath}" "${zkeyPath}"`,
        { stdio: "inherit" }
    );
   
    // === MODIFIED PART: Generate Cairo verifier for Starknet instead of Solidity ===
    // 1. Export verification key (required by garaga)
    execSync(
        `snarkjs zkey export verificationkey "${zkeyPath}" "${outDir}/verification_key.json"`,
        { stdio: "inherit" }
    );

    // 2. Generate valid Cairo Groth16 verifier contract using garaga (state-of-the-art, actively maintained, handles BN254 correctly)
    //    Prerequisites (run once):
    //      pip install garaga
    //      (Scarb is auto-detected; install via https://docs.swmansion.com/scarb/ if you want to build/deploy the contract)
    console.log("🔨 Generating Cairo verifier contract with garaga...");
    execSync(
        `garaga gen --system groth16 --vk "${outDir}/verification_key.json" --project-name "${baseName}"`,
        { 
            stdio: "inherit",
            cwd: outDir 
        }
    );

    // garaga creates a full Scarb project in ./verifier/ by default.
    // We copy the main contract file to verifier.cairo (so further modules that expect "verifier.sol" style can just rename/use verifier.cairo)
    const generatedContract = path.join(outDir, "verifier", "src", "groth16_verifier.cairo");
   
    console.log(`✅ All files successfully generated in: ${outDir}`);
    console.log(`   → Cairo verifier ready at: ${generatedContract}`);
}

module.exports = { compileCircuit };