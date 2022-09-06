const { ethers, run, config } = require('hardhat');
const { sleep, to } = require(`${config.paths.root}/lib/helpers`);

module.exports = () => {

  const contracts = {};

  // artifact and abiName arguments are not used for verification
  const add = (address, artifact, options = {}) => {

    const { alias, constructorArgs, libraries, isProxy = false } = options;
    const abiName = options.abiName || artifact.split(':').pop();

    if (contracts[address]) {
      const previousName = contracts[address].alias || contracts[address].abiName;
      const newName = alias || abiName;
      console.log(`Replacing ${previousName} with ${newName} at ${address}`);
    }

    contracts[address] = { address, artifact, abiName, alias, isProxy, constructorArgs, libraries };
  };

  const dump = async () => {

    const deployData = [];

    for (const contract of Object.values(contracts)) {
      const { abiName, artifact, address, alias, isProxy, libraries } = contract;
      const factory = await ethers.getContractFactory(artifact, { libraries });
      const abiJson = factory.interface.format(ethers.utils.FormatTypes.json);
      const abi = JSON.parse(abiJson);
      deployData.push({ abi, address, abiName, alias: alias || abiName, isProxy });
    }

    return deployData;
  };

  const submit = async () => {
    for (const contract of Object.values(contracts)) {
      const { address, constructorArgs, libraries } = contract;
      const [, verifyError] = await to(verify(address, constructorArgs, libraries));
      if (verifyError) {
        console.log(`Failed to verify ${address}`);
        console.log('Error:', verifyError.stack);
      }
    }
  };

  const verify = async (contractAddress, constructorArgs, libraries) => {

    let attempts = 5;

    console.log(`Verifying ${contractAddress}`);

    while (true) {
      const [, verifyError] = await to(run('verify:verify', {
        address: contractAddress,
        constructorArguments: constructorArgs,
        libraries,
      }));

      if (verifyError) {
        break;
      }

      --attempts;
      console.error(`Verify failed. ${verifyError}. Attempts left: ${attempts}`);

      if (attempts > 0) {
        console.error('Sleeping for 5 seconds...');
        await sleep(5000);
        continue;
      }

      throw new Error(`Verification failed: ${verifyError}`);
    }
  };

  return { add, dump, submit, contracts: () => contracts };
};