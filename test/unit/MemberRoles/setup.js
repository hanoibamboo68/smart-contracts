const { ethers } = require('hardhat');
const { hex } = require('../../../lib/helpers');
const { getAccounts } = require('../../utils/accounts');
const { parseEther, defaultAbiCoder, hexZeroPad, toUtf8Bytes } = ethers.utils;

async function setup () {
  const NXM = await ethers.getContractFactory('NXMTokenMock');
  const nxm = await NXM.deploy();
  await nxm.deployed();

  const MemberRoles = await ethers.getContractFactory('MemberRoles');
  const memberRoles = await MemberRoles.deploy();
  await memberRoles.deployed();

  const TokenControllerMock = await ethers.getContractFactory('TokenControllerMock');
  const tokenController = await TokenControllerMock.deploy();
  await tokenController.deployed();

  nxm.setOperator(tokenController.address);

  const Master = await ethers.getContractFactory('MasterMock');
  const master = await Master.deploy();
  await master.deployed();

  const Pool = await ethers.getContractFactory('MRMockPool');
  const pool = await Pool.deploy();
  await pool.deployed();

  const Cover = await ethers.getContractFactory('MRMockCover');
  const cover = await Cover.deploy();
  await cover.deployed();

  const Governance = await ethers.getContractFactory('MRMockGovernance');
  const governance = await Governance.deploy();
  await governance.deployed();

  const masterInitTxs = await Promise.all([
    master.setLatestAddress(hex('CO'), cover.address),
    master.setTokenAddress(nxm.address),
    master.setLatestAddress(hex('TC'), tokenController.address),
    master.setLatestAddress(hex('P1'), pool.address),
    master.setLatestAddress(hex('MR'), memberRoles.address),
    master.setLatestAddress(hex('GV'), governance.address),
    master.enrollInternal(tokenController.address),
    master.enrollInternal(pool.address),
    master.enrollInternal(nxm.address),
    master.enrollInternal(cover.address),
    master.enrollInternal(memberRoles.address),
  ]);
  await Promise.all(masterInitTxs.map(x => x.wait()));

  const signers = await ethers.getSigners();
  const accounts = getAccounts(signers);
  await master.enrollGovernance(accounts.governanceContracts[0].address);
  for (const member of accounts.members) {
    await master.enrollMember(member.address, 1);
    await nxm.mint(member.address, parseEther('10000'));
    await nxm.connect(member).approve(tokenController.address, parseEther('10000'));
  }

  {
    const tx = await memberRoles.changeMasterAddress(master.address);
    await tx.wait();
  }

  {
    const tx = await memberRoles.changeDependentContractAddress();
    await tx.wait();
  }

  {
    const tx = await tokenController.changeMasterAddress(master.address);
    await tx.wait();
  }

  {
    const tx = await tokenController.changeDependentContractAddress();
    await tx.wait();
  }

  {
    const tx = await master.setLatestAddress(hex('GV'), accounts.defaultSender.address);
    await tx.wait();
  }

  {
    const tx = await memberRoles.setKycAuthAddress(accounts.defaultSender.address);
    await tx.wait();
  }
  await memberRoles.addRole(
    defaultAbiCoder.encode(['bytes32'], [hexZeroPad(toUtf8Bytes('Unassigned'), 32)]),
    'Unassigned',
    '0x0000000000000000000000000000000000000000',
  );
  await memberRoles.addRole(
    defaultAbiCoder.encode(['bytes32'], [hexZeroPad(toUtf8Bytes('Advisory Board'), 32)]),
    'Selected few members that are deeply entrusted by the dApp. An ideal advisory board should be a mix of skills of domain, governance, research, technology, consulting etc to improve the performance of the dApp.',
    '0x0000000000000000000000000000000000000000',
  );
  await memberRoles.addRole(
    defaultAbiCoder.encode(['bytes32'], [hexZeroPad(toUtf8Bytes('Member'), 32)]),
    'Represents all users of Mutual.',
    '0x0000000000000000000000000000000000000000',
  );

  this.accounts = accounts;
  this.contracts = {
    nxm,
    master,
    pool,
    memberRoles,
    cover,
    tokenController,
  };
}

module.exports = {
  setup,
};