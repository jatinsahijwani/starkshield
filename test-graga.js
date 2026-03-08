const { init, getGroth16CallData, CurveId } = require('garaga');
const fs = require('fs');

(async () => {
  await init();

  const vk    = JSON.parse(fs.readFileSync('./simple/verification_key.json'));
  const proof = JSON.parse(fs.readFileSync('./simple/proof.json'));
  const pub   = JSON.parse(fs.readFileSync('./simple/public.json'));

  console.log('=== RAW DATA ===');
  console.log('pi_a:', proof.pi_a);
  console.log('pi_b:', proof.pi_b);
  console.log('pi_c:', proof.pi_c);
  console.log('public:', pub);
  console.log('vk keys:', Object.keys(vk));

  // Helper
  const B = (s) => BigInt(s);

  // ── Attempt 1: raw snarkjs objects, no conversion ──
  try {
    const cd = getGroth16CallData(proof, vk, CurveId.BN254);
    console.log('\n✅ Attempt 1 SUCCESS (raw): len', cd.length); return;
  } catch(e) { console.log('❌ Attempt 1 (raw):', e.message || e); }

  // ── Attempt 2: proof as {a,b,c,publicInputs} with {x,y,curveId} objects ──
  try {
    const p2 = {
      a: { x: B(proof.pi_a[0]), y: B(proof.pi_a[1]), curveId: CurveId.BN254 },
      b: { x: [B(proof.pi_b[0][0]), B(proof.pi_b[0][1])], y: [B(proof.pi_b[1][0]), B(proof.pi_b[1][1])], curveId: CurveId.BN254 },
      c: { x: B(proof.pi_c[0]), y: B(proof.pi_c[1]), curveId: CurveId.BN254 },
      publicInputs: pub.map(B),
    };
    const v2 = {
      alpha: { x: B(vk.vk_alpha_1[0]), y: B(vk.vk_alpha_1[1]), curveId: CurveId.BN254 },
      beta:  { x: [B(vk.vk_beta_2[0][0]),  B(vk.vk_beta_2[0][1])],  y: [B(vk.vk_beta_2[1][0]),  B(vk.vk_beta_2[1][1])],  curveId: CurveId.BN254 },
      gamma: { x: [B(vk.vk_gamma_2[0][0]), B(vk.vk_gamma_2[0][1])], y: [B(vk.vk_gamma_2[1][0]), B(vk.vk_gamma_2[1][1])], curveId: CurveId.BN254 },
      delta: { x: [B(vk.vk_delta_2[0][0]), B(vk.vk_delta_2[0][1])], y: [B(vk.vk_delta_2[1][0]), B(vk.vk_delta_2[1][1])], curveId: CurveId.BN254 },
      ic: vk.IC.map(p => ({ x: B(p[0]), y: B(p[1]), curveId: CurveId.BN254 })),
    };
    const cd = getGroth16CallData(p2, v2, CurveId.BN254);
    console.log('\n✅ Attempt 2 SUCCESS (objects): len', cd.length); return;
  } catch(e) { console.log('❌ Attempt 2 (objects):', e.message || e); }

  // ── Attempt 3: proof as {a,b,c,publicInputs} with TUPLE arrays ──
  try {
    const p3 = {
      a: [B(proof.pi_a[0]), B(proof.pi_a[1])],
      b: [[B(proof.pi_b[0][0]), B(proof.pi_b[0][1])], [B(proof.pi_b[1][0]), B(proof.pi_b[1][1])]],
      c: [B(proof.pi_c[0]), B(proof.pi_c[1])],
      publicInputs: pub.map(B),
    };
    const v3 = {
      alpha: { x: B(vk.vk_alpha_1[0]), y: B(vk.vk_alpha_1[1]), curveId: CurveId.BN254 },
      beta:  { x: [B(vk.vk_beta_2[0][0]),  B(vk.vk_beta_2[0][1])],  y: [B(vk.vk_beta_2[1][0]),  B(vk.vk_beta_2[1][1])],  curveId: CurveId.BN254 },
      gamma: { x: [B(vk.vk_gamma_2[0][0]), B(vk.vk_gamma_2[0][1])], y: [B(vk.vk_gamma_2[1][0]), B(vk.vk_gamma_2[1][1])], curveId: CurveId.BN254 },
      delta: { x: [B(vk.vk_delta_2[0][0]), B(vk.vk_delta_2[0][1])], y: [B(vk.vk_delta_2[1][0]), B(vk.vk_delta_2[1][1])], curveId: CurveId.BN254 },
      ic: vk.IC.map(p => ({ x: B(p[0]), y: B(p[1]), curveId: CurveId.BN254 })),
    };
    const cd = getGroth16CallData(p3, v3, CurveId.BN254);
    console.log('\n✅ Attempt 3 SUCCESS (tuples+objects): len', cd.length); return;
  } catch(e) { console.log('❌ Attempt 3 (tuples+objects):', e.message || e); }

  // ── Attempt 4: proof as {a,b,c,publicInputs} with SWAPPED G2 coords ──
  try {
    const p4 = {
      a: [B(proof.pi_a[0]), B(proof.pi_a[1])],
      b: [[B(proof.pi_b[0][1]), B(proof.pi_b[0][0])], [B(proof.pi_b[1][1]), B(proof.pi_b[1][0])]],
      c: [B(proof.pi_c[0]), B(proof.pi_c[1])],
      publicInputs: pub.map(B),
    };
    const v4 = {
      alpha: { x: B(vk.vk_alpha_1[0]), y: B(vk.vk_alpha_1[1]), curveId: CurveId.BN254 },
      beta:  { x: [B(vk.vk_beta_2[0][1]),  B(vk.vk_beta_2[0][0])],  y: [B(vk.vk_beta_2[1][1]),  B(vk.vk_beta_2[1][0])],  curveId: CurveId.BN254 },
      gamma: { x: [B(vk.vk_gamma_2[0][1]), B(vk.vk_gamma_2[0][0])], y: [B(vk.vk_gamma_2[1][1]), B(vk.vk_gamma_2[1][0])], curveId: CurveId.BN254 },
      delta: { x: [B(vk.vk_delta_2[0][1]), B(vk.vk_delta_2[0][0])], y: [B(vk.vk_delta_2[1][1]), B(vk.vk_delta_2[1][0])], curveId: CurveId.BN254 },
      ic: vk.IC.map(p => ({ x: B(p[0]), y: B(p[1]), curveId: CurveId.BN254 })),
    };
    const cd = getGroth16CallData(p4, v4, CurveId.BN254);
    console.log('\n✅ Attempt 4 SUCCESS (swapped G2): len', cd.length); return;
  } catch(e) { console.log('❌ Attempt 4 (swapped G2):', e.message || e); }

  // ── Attempt 5: decimal strings directly (no BigInt) ──
  try {
    const p5 = {
      a: { x: proof.pi_a[0], y: proof.pi_a[1], curveId: CurveId.BN254 },
      b: { x: [proof.pi_b[0][0], proof.pi_b[0][1]], y: [proof.pi_b[1][0], proof.pi_b[1][1]], curveId: CurveId.BN254 },
      c: { x: proof.pi_c[0], y: proof.pi_c[1], curveId: CurveId.BN254 },
      publicInputs: pub,
    };
    const v5 = {
      alpha: { x: vk.vk_alpha_1[0], y: vk.vk_alpha_1[1], curveId: CurveId.BN254 },
      beta:  { x: [vk.vk_beta_2[0][0],  vk.vk_beta_2[0][1]],  y: [vk.vk_beta_2[1][0],  vk.vk_beta_2[1][1]],  curveId: CurveId.BN254 },
      gamma: { x: [vk.vk_gamma_2[0][0], vk.vk_gamma_2[0][1]], y: [vk.vk_gamma_2[1][0], vk.vk_gamma_2[1][1]], curveId: CurveId.BN254 },
      delta: { x: [vk.vk_delta_2[0][0], vk.vk_delta_2[0][1]], y: [vk.vk_delta_2[1][0], vk.vk_delta_2[1][1]], curveId: CurveId.BN254 },
      ic: vk.IC.map(p => ({ x: p[0], y: p[1], curveId: CurveId.BN254 })),
    };
    const cd = getGroth16CallData(p5, v5, CurveId.BN254);
    console.log('\n✅ Attempt 5 SUCCESS (strings+objects): len', cd.length); return;
  } catch(e) { console.log('❌ Attempt 5 (strings):', e.message || e); }

  console.log('\nAll attempts failed.');
})();