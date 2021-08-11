const { ethers } = require('hardhat');
const keccak256 = require('keccak256');
const { MerkleTree } = require('merkletreejs');
const { parseEther, arrayify, hexZeroPad, hexValue } = ethers.utils;

const getVoteCountOfAddresses = assessment => async addresses =>
  await Promise.all(addresses.map(address => assessment.getVoteCountOfAssessor(address)));

const getFraudCountOfAddresses = assessment => async addresses => {
  const stakes = await Promise.all(addresses.map(address => assessment.stakeOf(address)));
  return stakes.map(x => x.fraudCount);
};

const getLeafInput = (address, lastFraudulentVoteIndex, burnAmount, fraudCount) => {
  return [
    ...arrayify(address),
    ...arrayify(hexZeroPad(hexValue(lastFraudulentVoteIndex), 32)),
    ...arrayify(hexZeroPad(hexValue(burnAmount), 13)),
    ...arrayify(hexZeroPad(hexValue(fraudCount), 2)),
  ];
};

const submitFraud = assessment => async (signer, addresses, amounts) => {
  const voteCounts = await getVoteCountOfAddresses(assessment)(addresses);
  const fraudCounts = await getFraudCountOfAddresses(assessment)(addresses);
  const leaves = addresses.map((address, i) => {
    // Assume the last fraudulent vote was also the last vote
    const lastFraudulentVoteIndex = voteCounts[i] - 1;
    const input = getLeafInput(address, lastFraudulentVoteIndex, amounts[i], fraudCounts[i]);
    return input;
  });
  const merkleTree = new MerkleTree(leaves, keccak256, { hashLeaves: true, sortPairs: true });
  const root = merkleTree.getHexRoot();
  await assessment.connect(signer).submitFraud(root);
  return merkleTree;
};

const burnFraud = assessment => async (rootIndex, addresses, amounts, callsPerAddress, merkleTree) => {
  let gasUsed = ethers.constants.Zero;
  const voteCounts = await getVoteCountOfAddresses(assessment)(addresses);
  const fraudCounts = await getFraudCountOfAddresses(assessment)(addresses);
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    for (let j = 0; j < callsPerAddress; j++) {
      const lastFraudulentVoteIndex = voteCounts[i] - 1;
      const input = getLeafInput(address, lastFraudulentVoteIndex, amounts[i], fraudCounts[i]);
      const proof = merkleTree.getHexProof(keccak256(input));
      const tx = await assessment.burnFraud(
        rootIndex,
        proof,
        address,
        lastFraudulentVoteIndex,
        amounts[i],
        fraudCounts[i],
        callsPerAddress,
      );
      const receipt = await tx.wait();
      gasUsed = gasUsed.add(receipt.gasUsed);
    }
  }
  return gasUsed;
};

const submitClaim = assessment => async (id, amount) => {
  const DEFAULT_COVER_AMOUNT = parseEther('1');
  const CLAIM_ASSESSMENT_DEPOSIT_PERC = await assessment.CLAIM_ASSESSMENT_DEPOSIT_PERC();
  const claimAssessmentDeposit = parseEther('1')
    .mul(CLAIM_ASSESSMENT_DEPOSIT_PERC)
    .div('10000');
  await assessment.submitClaim(id, amount || DEFAULT_COVER_AMOUNT, false, '', { value: claimAssessmentDeposit });
};

const submitIncident = assessment => async (id, priceBefore, date) => {
  const INCIDENT_ASSESSMENT_DEPOSIT_PERC = await assessment.INCIDENT_ASSESSMENT_DEPOSIT_PERC();
  // [todo] Change this to an estimate when incidents can be submitted by all members
  const payoutImpact = Zero;
  // [todo] Use this to approve amount of nxm to dpeosit contract
  // const incidentAssessmentDeposit = payoutImpact.mul(INCIDENT_ASSESSMENT_DEPOSIT_PERC).div('10000');
  await assessment.submitClaim(id, priceBefore, date);
};

module.exports = {
  submitFraud,
  submitClaim,
  submitIncident,
  burnFraud,
};