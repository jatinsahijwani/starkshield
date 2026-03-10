<div align="center">

<img src="https://img.shields.io/badge/Starknet-Sepolia-00c8ff?style=for-the-badge&logo=ethereum&logoColor=white" />
<img src="https://img.shields.io/badge/ZK-Groth16_BN254-a855f7?style=for-the-badge" />
<img src="https://img.shields.io/badge/Garaga-1.0.1-00ffaa?style=for-the-badge" />
<img src="https://img.shields.io/badge/npm-starkshield-ff9500?style=for-the-badge&logo=npm&logoColor=white" />
<img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />

<br /><br />

```
███████╗████████╗ █████╗ ██████╗ ██╗  ██╗███████╗██╗  ██╗██╗███████╗██╗     ██████╗
██╔════╝╚══██╔══╝██╔══██╗██╔══██╗██║ ██╔╝██╔════╝██║  ██║██║██╔════╝██║     ██╔══██╗
███████╗   ██║   ███████║██████╔╝█████╔╝ ███████╗███████║██║█████╗  ██║     ██║  ██║
╚════██║   ██║   ██╔══██║██╔══██╗██╔═██╗ ╚════██║██╔══██║██║██╔══╝  ██║     ██║  ██║
███████║   ██║   ██║  ██║██║  ██║██║  ██╗███████║██║  ██║██║███████╗███████╗██████╔╝
╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═════╝
```

### **Write Circom. Compile. Deploy. Verify — Powered by Starknet.**

*Zero-Knowledge proof infrastructure for every developer. No cryptography expertise required.*

<br />

[📦 npm Package](#-installation) · [🚀 Quick Start](#-quick-start) · [📖 API Reference](#-api-reference) · [🔍 Live Demo](#-live-demo) · [🏗️ Architecture](#️-architecture)

</div>

---

## 🧠 What is StarkShield?

StarkShield is an **open-source SDK and CLI toolkit** that lets any developer integrate **Zero-Knowledge proofs into their projects in minutes** — with no Web3 knowledge, no cryptography expertise, and no ABI handling.

You write a Circom circuit. StarkShield handles everything else:

- ✅ Compiles your circuit and runs the Groth16 trusted setup
- ✅ Generates a production-ready Cairo verifier contract using **Garaga 1.0**
- ✅ Deploys the verifier to **Starknet** with one command
- ✅ Provides a single JavaScript function to generate proofs and verify them on-chain

**Before StarkShield:** Integrating ZK proofs meant weeks of setup — learning snarkjs, Garaga, Cairo, Starknet deployment pipelines, and ABI serialization. Most developers gave up.

**After StarkShield:** Three commands.

```bash
npx starkshield compile circuits/myCircuit.circom
npx starkshield deploy ./myCircuit <privateKey> <address>
# Then in your app:
const result = await verifyProof({ input: { ... } }, "./myCircuit");
```

---

## 🏗️ Architecture


<img width="4300" height="2400" alt="Untitled design (4)" src="https://github.com/user-attachments/assets/ce8bac04-df46-4db0-848a-09e235684d31" />


### How it works end-to-end

```
Developer writes .circom circuit
           │
           ▼
┌─────────────────────┐
│  npx starkshield    │  ── Circom compiler
│     compile         │  ── Groth16 trusted setup (Powers of Tau)
└─────────────────────┘  ── Generates: .r1cs, .wasm, .zkey, verifier.cairo
           │
           ▼
┌─────────────────────┐
│  npx starkshield    │  ── Garaga 1.0 Cairo BN254 verifier
│      deploy         │  ── scarb build → sncast declare → deploy
└─────────────────────┘  ── Writes deployment.json with contract address
           │
           ▼
┌─────────────────────┐
│   verifyProof()     │  ── snarkjs CLI generates Groth16 proof locally
│   in your app       │  ── Garaga converts proof → felt252 calldata
└─────────────────────┘  ── Calls on-chain verifier, returns true/false
           │
           ▼
     ✅ On-chain ZK verification — age, credentials, membership, anything
```

### The Zero-Knowledge Privacy Guarantee

```
User Input (private)     ZK Proof (public)      On-chain Result
   age = 21        ──►   π_A, π_B, π_C   ──►   isAdult = true
  [NEVER LEAVES          [mathematically          [no age data
    DEVICE]               hides the input]          on-chain]
```

Your private inputs are used only to generate the proof locally. **Only the proof is ever transmitted.** The on-chain verifier confirms validity without learning anything about your private data.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🧠 **Write simple Circom circuits** | Standard Circom 2.x — use any template from circomlib |
| ⚙️ **One-command compilation** | Outputs `.r1cs`, `.wasm`, `.zkey`, and Cairo verifier |
| 🚀 **One-command deployment** | Deploys Groth16 verifier to Starknet Sepolia |
| ✅ **Single function verification** | `verifyProof()` — generate proof + verify on-chain |
| 🔒 **True ZK privacy** | Private inputs never leave the client device |
| 🧩 **Universal circuit support** | Age, credentials, membership, voting — any Circom circuit |
| 🛠️ **Zero Web3 knowledge needed** | No ABI handling, no snarkjs config, no Garaga setup |
| 📦 **npm installable** | Drop into any Node.js or Next.js project |

---

## 📦 Installation

```bash
npm install starkshield
```

**Prerequisites:**

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 18 | [nodejs.org](https://nodejs.org) |
| Scarb | 2.14.0 | `curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh \| sh -s -- -v 2.14.0` |
| Starknet Foundry | 0.57.0 | `asdf install starknet-foundry 0.57.0` |
| Garaga | 1.0.1 | `pip install garaga==1.0.1` |
| Circom | 2.x | [docs.circom.io](https://docs.circom.io/getting-started/installation/) |

---

## 🚀 Quick Start

### Step 1 — Write your circuit

Create `circuits/agecheck.circom`:

```circom
pragma circom 2.1.4;
include "comparators.circom";

template AgeCheck() {
    signal input age;       // private: user's real age
    signal output isAdult;  // public: 1 if age >= 18

    component lt = LessThan(8);
    lt.in[0] <== age;
    lt.in[1] <== 18;

    isAdult <== 1 - lt.out;
}

component main = AgeCheck();
```

### Step 2 — Compile

```bash
npx starkshield compile circuits/agecheck.circom
```

**Output:**
```
agecheck/
├── agecheck.r1cs              ← constraint system
├── agecheck_js/agecheck.wasm  ← witness generator
├── circuit_final.zkey         ← proving key
├── verification_key.json      ← verification key
└── agecheck/                  ← Cairo scarb project
    ├── Scarb.toml
    └── src/
        ├── groth16_verifier.cairo
        └── groth16_verifier_constants.cairo
```

### Step 3 — Test locally

Create `circuits/input.json`:
```json
{ "age": "21" }
```

```bash
npx starkshield test ./ageCheck circuits/input.json
```

Outputs `proof.json` and `public.json` — confirms your circuit logic works before deploying.

### Step 4 — Deploy to Starknet

```bash
npx starkshield deploy ./ageCheck <PRIVATE_KEY> <ACCOUNT_ADDRESS>
```

**Output:**
```
✅  Deployment complete!
  Circuit  : ageCheck
  Address  : 0x04a3b...
  Network  : sepolia
  Explorer : https://sepolia.starkscan.co/contract/0x04a3b...
  Saved to : ./ageCheck/deployment.json
```

### Step 5 — Verify in your app

```javascript
const { verifyProof } = require("starkshield");

const result = await verifyProof(
  { input: { age: "21" } },
  "./ageCheck"
);

console.log(result.verified);       // true
console.log(result.publicSignals);  // ["1"] — isAdult = 1
```

That's it. **Full ZK proof generated and verified on Starknet in one function call.**

---

## 📖 API Reference

### CLI Commands

#### `npx starkshield compile <path-to-circuit>`

Compiles a `.circom` file and runs the full Groth16 trusted setup.

| Output | Description |
|---|---|
| `circuit.r1cs` | R1CS constraint system |
| `circuit_js/circuit.wasm` | WebAssembly witness generator |
| `circuit_final.zkey` | Groth16 proving key |
| `verification_key.json` | Verification key |
| `circuit/` | Scarb project with Garaga-generated Cairo verifier |

---

#### `npx starkshield test <output-folder> <input.json>`

Tests the ZK system locally without deploying.

```bash
npx starkshield test ./ageCheck circuits/input.json
```

Outputs `proof.json` (on-chain parameters) and `public.json` (human-readable outputs).

---

#### `npx starkshield deploy <output-folder> <private-key> <account-address>`

Builds the Cairo verifier, declares and deploys it to Starknet Sepolia.

```bash
npx starkshield deploy ./ageCheck 0x013423... 0x044FFd...
```

Writes `deployment.json` containing the contract address, ABI, and circuit artifact paths.

---

### JavaScript API

#### `verifyProof(options, folderPath)`

Generates a Groth16 ZK proof from your inputs and verifies it on-chain in one call.

```typescript
verifyProof(
  options: { input: Record<string, string> },
  folderPath: string
): Promise<{ verified: boolean, publicSignals: string[] }>
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `options.input` | `Record<string, string>` | Circuit private inputs as string values |
| `folderPath` | `string` | Path to the compiled circuit output folder |

**Returns:**

| Field | Type | Description |
|---|---|---|
| `verified` | `boolean` | `true` if proof is valid on-chain |
| `publicSignals` | `string[]` | Circuit public outputs (e.g. `["1"]` for isAdult) |

**Example:**

```javascript
const { verifyProof } = require("starkshield");
const path = require("path");

const result = await verifyProof(
  { input: { age: "21" } },
  path.join(process.cwd(), "ageCheck")
);

if (result.verified) {
  const isAdult = result.publicSignals[0] === "1";
  console.log(isAdult ? "✅ Verified: age ≥ 18" : "❌ Verified: age < 18");
}
```

---

### Commands Overview

| Command | Description |
|---|---|
| `npx starkshield compile <path>` | Compile `.circom` + run Groth16 trusted setup |
| `npx starkshield test <folder> <input.json>` | Test ZK system locally |
| `npx starkshield deploy <folder> <key> <address>` | Deploy verifier to Starknet Sepolia |
| `verifyProof(input, path)` | Generate proof + verify on-chain |

---

## 🔍 Live Demo

A full Next.js age verification demo is available that demonstrates StarkShield end-to-end:

- User enters their age privately in the browser
- A Groth16 ZK proof is generated locally — age never transmitted
- Proof is verified on-chain via the deployed Starknet contract
- Result shows `isAdult = 1` or `isAdult = 0` — cryptographic guarantee with no data leak

**Demo Stack:** Next.js · StarkShield SDK · Starknet Sepolia · Garaga 1.0

To run the demo locally:

```bash
git clone https://github.com/AnirudhSingh07/starkshield-demo
cd starkshield-demo
npm install
npm run dev
```

---

## 🧩 Use Cases

StarkShield works with any circuit expressible in Circom. Some examples:

| Use Case | Circuit Logic | Private Input | Public Output |
|---|---|---|---|
| 🎂 Age Verification | `age >= 18` | date of birth | isAdult: 0 or 1 |
| 🏦 Credit Score | `score >= threshold` | actual score | isEligible: 0 or 1 |
| 🗳️ Private Voting | `voter is registered` | voter ID | hasVoted: 0 or 1 |
| 🎓 Credential Proof | `credential is valid` | raw credential | isCredentialed: 0 or 1 |
| 👥 Membership Check | `member of group` | secret key | isMember: 0 or 1 |
| 💰 Wealth Proof | `balance >= amount` | actual balance | isSolvent: 0 or 1 |

---

## 🏗️ Technical Stack

| Layer | Technology | Role |
|---|---|---|
| Circuit DSL | **Circom 2.x** | Write constraint-based ZK logic |
| Proof System | **Groth16 / BN254** | Most efficient SNARK for on-chain verification |
| Witness Generation | **snarkjs** | WASM-based witness + proof generation |
| Cairo Codegen | **Garaga 1.0** | Generates optimized BN254 verifier for Starknet |
| Smart Contract | **Cairo / Scarb** | On-chain Groth16 verifier contract |
| Deployment | **sncast** | Starknet account management + contract deployment |
| RPC | **Starknet.js** | On-chain view calls for verification |
| Demo | **Next.js** | Full-stack demo application |

---

## 🔒 Security & Privacy

- **Private inputs are local only** — witness computation happens in WASM on the client; inputs never touch the network
- **Groth16 soundness** — computationally infeasible to generate a valid proof without the correct private inputs
- **On-chain finality** — verification result is determined by the Starknet contract, not by the SDK
- **Trusted setup** — uses Powers of Tau ceremony; the `ptau` file is included in the repository for reproducibility
- **No backdoors** — the Cairo verifier is generated deterministically by Garaga from your verification key

---

## 🛣️ Roadmap

- [ ] **Mainnet support** — deploy verifiers to Starknet mainnet
- [ ] **PLONK support** — alternative proof system alongside Groth16
- [ ] **Browser SDK** — client-side proof generation without Node.js
- [ ] **Circuit library** — pre-built circuits for common use cases (age, KYC, credentials)
- [ ] **Recursive proofs** — proof aggregation for batched verification
- [ ] **TypeScript SDK** — full type definitions and TypeScript support
- [ ] **Proof caching** — cache proofs for repeated verification of same inputs

---

## 🤝 Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

```bash
git clone https://github.com/jatinsahijwani/starkshield
cd starkshield
npm install
```

---

## 📄 License

MIT © [Jatin Sahijwani](https://github.com/jatinsahijwani)

---

<div align="center">

**Built for the Starknet Redefine Hackathon 2025 — Privacy Track**

*StarkShield makes Zero-Knowledge accessible to every developer.*
*Write the circuit. We handle the rest.*

[![GitHub](https://img.shields.io/badge/GitHub-jatinsahijwani%2Fstarkshield-00c8ff?style=for-the-badge&logo=github)](https://github.com/jatinsahijwani/starkshield)
[![npm](https://img.shields.io/badge/npm-starkshield-ff9500?style=for-the-badge&logo=npm)](https://npmjs.com/package/starkshield)

</div>
