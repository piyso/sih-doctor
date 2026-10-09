// Demo circuit for the Groth16/BN128 verifier self-test.
// Proves: "I know secret inputs a, b such that a*b == product" (3 public signals).
// Scope: exercises snarkjs verification in the test battery only. It is NOT bound to any
// clinical record, no proof is generated in the product, and it is not part of the pending
// patent application (which concerns distributed encrypted retrieval, see
// PATENT_SUBSYSTEM_INTEGRATION_GUIDE.md). Record integrity in the product comes from
// Ed25519 signatures and SHA-256 hash chains (backend/src/security).
template IntegrityCheck() {
    signal input a;
    signal input b;
    signal output product;
    product <== a * b;
}
component main = IntegrityCheck();
