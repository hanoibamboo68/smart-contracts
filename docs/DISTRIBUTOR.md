## NexusMutual distributor

Sell NexusMutual cover to users without KYC.

Earn revenue on each sale through an optional fee and the NXM deposit return!

Issue NFTs for each NexusMutual cover that users own and can freely trade. 

### Code

The Distributor has a standard implementation `Distributor.sol` which is deployed using the `DistributorFactory.sol`

Code is here:

https://github.com/NexusMutual/smart-contracts/tree/feature/distributor-relocation/contracts/modules/distributor

### Addresses

#### mainnet

DistributorFactory: `TBD`

NXMaster: `0x01bfd82675dbcc7762c84019ca518e701c0cd07e`

#### kovan

DistributorFactory: `0x2920bad71C8C7cf53f857710345f4cA65F288Ad5`

NXMaster: `0x2561D7f2436C121281388ecd54c702e55Aa24043`

### Integration

To integrate with NexusMutual and start selling cover, deploy an instance
of the Distributor contract using the available DistributorFactory.

This contract becomes a NexusMutual member once the KYC for its address is approved.
(KYC fee is paid at contract creation as part of the call to the factory).

#### Deployment


##### Mainnet

Coming soon.

##### Kovan 

```
# install all dependencies
npm i
# create a .env with your configuration
cp .env.sample .env

# fill in the blanks in .env with the following vars as shown in the template
# KOVAN_ACCOUNT_KEY=set your private key here
# KOVAN_PROVIDER_URL=https://mainnet.infura.io/v3/apikey
# KOVAN_GAS_PRICE=1
# KOVAN_GAS_LIMIT=12000000

# run deploy
npm run distributor-deploy-kovan

# If succesful your contract address will be prinded as such:
# Successfully deployed at 0x...
```

#### KYC

##### Mainnet

Once the script has generated a mainnet deployment take the resulting contract and follow the steps
at this link to KYC the address.
https://app.nexusmutual.io/home/distributor

##### Kovan

Distributors deployed with `npm run distributor-deploy-kovan` are already KYCed.

If you want to KYC an EOA or another contract, use:

`npm run distributor-kovan-self-kyc`

This command assumes your `.env` has a `KOVAN_ACCOUNT` address
with at least `0.002` KETH to pay for the joining fee. 

### Contract functionality

#### User functions

Users are able to go through the buy->claim->redeem cycle.

#### buyCover

Allows users to buy NexusMutual cover.

For the cover pricing, the contract call currently requires a signed quote provided by
the NexusMutual quote engine, which is then abi-encoded as part of the `data` parameter.

```
  function buyCover (
    address contractAddress,
    address coverAsset,
    uint sumAssured,
    uint16 coverPeriod,
    uint8 coverType,
    uint maxPriceWithFee,
    bytes calldata data
  )
    external
    payable
    nonReentrant
    returns (uint)
```

See the following example node.js code for buying cover. Equivalent code will have to be implemented
on the UI side. Example code uses the hardhat `run` command to run and TruffleContract however it 
should be easily translatable to frontend code that does the equivalent with the library of choice
(web3, ethers etc.). 

Example:

https://github.com/NexusMutual/smart-contracts/blob/feature/distributor-relocation/examples/example-distributor-buy-cover.js

#### Protocol Cover Claims

Protocol cover claims require 3 steps.

* submit proof of loss on the nexus page - must be done *BEFORE* submitClaim.
    If not available the claim submission will be considered invalid
* submitClaim - submit the actual claim once the proof of loss is provided.
* redeemClaim - to redeem the payout once the claim has been voted on.


##### Proof of loss submission
Every claim submission needs to be accompanied by a proof of loss submission.

This can be done on the NexusMutual app with the following link that needs to include the cover id and owner address as shown:

https://app.nexusmutual.io/home/proof-of-loss/add-affected-addresses?coverId=<cover_id>&owner=<nft_owner_address>

Redirect the user to the page above the proof of loss submission with the signature before the claim is submitted.

Once the proof of loss is submitted, allow the user to submit the claim.


##### submitClaim 

Submit claim for the cover. Only one claim at a time can be active.

The `data` field is currently unused.

```
  function submitClaim(
    uint tokenId,
    bytes calldata data
  )
    external
    onlyTokenApprovedOrOwner(tokenId)
    returns (uint)
```

See the following example node.js code for submitting a claim for a particular cover (cover id matches the NFT token id).
Example:

https://github.com/NexusMutual/smart-contracts/blob/feature/distributor-relocation/examples/example-distributor-submit-claim.js

##### redeemClaim

Owner of the cover token reedems its claim payout. The Claim must have been approved and paid out,
to the distributor contract for this to succeed. 

Once redeemed the NFT token is burned.

To redeem a claim both the tokenId of the cover needs to be supplied and the claim id being redeemed. 

```
  function redeemClaim(
    uint256 tokenId,
    uint256 claimId
  )
    public
    onlyTokenApprovedOrOwner(tokenId)
    nonReentrant
```


#### Yield Token Cover Claims


Claim the payout tokens by supplying an `incidentId`, the `coveredTokenAmount` of
covered tokens with address `coverAsset` to send in exchange for the payout.

Pre-condition The caller must first call `IERC20(coverAsset).approve(distributorAddress, coveredTokenAmount)`
for the on the Distributor address so the distributor can transfer the tokens over.

```
  function claimTokens(
    uint tokenId,
    uint incidentId,
    uint coveredTokenAmount,
    address coverAsset
  )
    external
    onlyTokenApprovedOrOwner(tokenId)
    returns (uint claimId, uint payoutAmount, address payoutToken)
```

#### getPayoutOutcome

Provides the current status of a claim.

The `amountPaid` is the amount in wei paid out if the `status` == `ACCEPTED`.
The `coverAsset` is the asset for the sum assured.

```
  function getPayoutOutcome(uint claimId)
  public
  view
  returns (ICover.ClaimStatus status, uint amountPaid, address coverAsset)
```

The Claim statuses are:

```
    enum ClaimStatus { IN_PROGRESS, ACCEPTED, REJECTED }
```

All claims start with `IN_PROGRESS` and end up being `ACCEPTED` or `REJECTED`.

#### Owner admin

The contract accrues NXM over time as covers expire or are claimed. 
The owner controls the NXM tokens stored in the contract.
The owner can withdraw, sell, or provide sell allowance for NXM.

All distributor fees determined by the `feePercentage` are collected in the `treasury` address.

The owner can also pause the use of `buyCover`, change the `feePercentage` and set the `treasury` address
for storing its fees at any time.


#### approveNXM

```
  function approveNXM(address spender, uint256 amount) public onlyOwner 
```

#### withdrawNXM

```
function withdrawNXM(address recipient, uint256 amount) public onlyOwner 
```

#### sellNXM

Sell NXM stored in the distributor contract. The resulting ETH is sent to the `treasury` address.

```
function sellNXM(uint nxmIn, uint minEthOut) external onlyOwner 
```

#### switchMembership

Switch membership to another address of your choice. Currently requires that all covers tied
to the distributor are expired or claimed. 

```
function switchMembership(address newAddress) external onlyOwner 
```

#### setFeePercentage

Change the added fee on top of cover purchases at any time.

```
function setFeePercentage(uint _feePercentage) external onlyOwner 
```

#### setBuysAllowed

Pause/unpause cover purchases at any time.

```
function setBuysAllowed(bool _buysAllowed) external onlyOwner 
```

#### setTreasury

Change where the distributor fees are sent to at any time.

```
function setTreasury(address payable _treasury) external onlyOwner
```

### API endpoints

To enable users to `buyCover` a signed price quote is currently necessary.

#### GET v1/quote

Get a signed price quote to use as part 


Example mainnet call:

```
curl -X GET -H "Origin: https://yourcustomorigin.com" 'https://api.nexusmutual.io/v1/quote?coverAmount=1&currency=ETH&period=111&contractAddress=0xC57D000000000000000000000000000000000002'
```

Example kovan call:

```
curl -X GET 'https://api.staging.nexusmutual.io/v1/quote?coverAmount=1&currency=ETH&period=111&contractAddress=0xC57D000000000000000000000000000000000002'
```


Example response:
```
{
   "currency":"ETH",
   "period":"111",
   "amount":"1",
   "price":"7901437371663244",
   "priceInNXM":"206328266227258591",
   "expiresAt":1610868026,
   "generatedAt":1610867125800,
   "contract":"0xc57d000000000000000000000000000000000002",
   "v":27,
   "r":"0x19b567db10ddd7c64cd0bb4c012b8a77266515b54e488730b1a1aca79ea783d8",
   "s":"0x0a052b90cf91623f724d64dc441012cd703b8c0b49ac9b67795ed5f5f61ebbd6"
}
```

**Warning**: the `"amount"` field is in units *not in wei*. 1 means 1 ETH.

Contact our team to get your `origin` whitelisted.

#### GET v1/contracts/<contract-address>/capacity

Returns the available capacity for a particular contract in both ETH and DAI.
Based on available capacity you can decide whether a cover can be offered or not.
(sum assured of that cover < available capacity).

Example Kovan call:
```
curl  -X GET 'https://api.staging.nexusmutual.io/v1/contracts/0xC57D000000000000000000000000000000000002/capacity'
```

Example Mainnet call:
```
curl  -X GET  -H "Origin: http://yourcustomorigin.com" 'https://api.nexusmutual.io/v1/contracts/0xC57D000000000000000000000000000000000002/capacity'
``` 

Example response:

```
{
   "capacityETH":"3652580281259279314200",
   "capacityDAI":"4330350165767307632900000",
   "netStakedNXM":"51152035000000000000000",
   "capacityLimit":"STAKED_CAPACITY"
}
```

#### GET coverables/contracts.json

Provides you with a list of contracts that can be covered to display within your app.

Example call:

```
 curl https://api.nexusmutual.io/coverables/contracts.json
```

Example response:

```
{
  "0xF5DCe57282A584D2746FaF1593d3121Fcac444dC":{
    "name":"Compound Sai",
    "type": "contract",
    "dateAdded":"2020-01-01",
    "deprecated":true
  },
  "0x8B3d70d628Ebd30D4A2ea82DB95bA2e906c71633":{
    "name":"bZx",
    "type": "contract",
    "dateAdded":"2020-01-01",
    "logo":"https://api.nexusmutual.io/coverables/images/bzx.png",
    "github":"https://github.com/bZxNetwork",
    "messari":""
  },
}
```

Important: If an entry has `"deprecated": true` skip it. no more covers can be bought on it. 


