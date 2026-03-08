const {verifyProof} = require('./lib/verify');

async function main() {

const result = await verifyProof(
  { input: { a: 3, b: 11 } },
  "./simple"
);

  console.log(result ? "✅ Valid proof" : "❌ Invalid proof");
  process.exit(0);
}



main();