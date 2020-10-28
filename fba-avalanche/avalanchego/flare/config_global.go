package flare

const (

	FixedGas uint64 = 100000
	FixedGasMax uint64 = 200000000000
	FixedGasPrice uint64 = 100000000

  CChainGenesis = `{
    "config": {
      "chainId": 14,
      "homesteadBlock": 0,
      "daoForkBlock": 0,
      "daoForkSupport": true,
      "eip150Block": 0,
      "eip150Hash": "0x2086799aeebeae135c246c65021c82b4e15a2c451340993aacfd2751886514f0",
      "eip155Block": 0,
      "eip158Block": 0,
      "byzantiumBlock": 0,
      "constantinopleBlock": 0,
      "petersburgBlock": 0
    },
    "nonce": "0x0",
    "timestamp": "0x0",
    "extraData": "0x00",
    "gasLimit": "0x38d7ea4c68000000",
    "difficulty": "0x0",
    "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "coinbase": "0x0000000000000000000000000000000000000000",
    "alloc": {
      "c2058730Cd09E1CF095ECBe8265Ba29A75004974": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2679fB46DF45A2e6ed01910C876D52d8886704C": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c264Df6089Cd05427EfeC817821181B69BbDd934": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c20c5a4fdd7AD763eC87C2F31b557177bd817978": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2f30826ADff11307faEA5D349D2bf298098512b": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c21B8D3c28e73185bD1C04cFE219Fc5dF2710726": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c204fBAFA834aD65C793Cd98833fFb2A0d5c60fB": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c23e9Ac81Dd378f88C8A45100B90bF61B623681A": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c28F4274BeA8e6de31A80b879D97Ce45a2e755A3": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2ed30f0753b7911fb53CAdda664C0C55Be4b51B": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c24569050bA06d46db4bad28893DF3015Dd92Eb5": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c265C9f6Db11681fe1364b49822E96907cFbeA55": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2a335A3dc436495bBE642450371D391791f2132": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c28cfC7f4B26e94EC10E9d20141875b31c3849CF": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c220Ed1937Ed7a157CDec8a1B59c41f18c4A535a": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2908BA328787f3C334121C9b6D65A7674e4306E": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c20864F5c142226212900EDC6D4959Be5C85f3Bf": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c242e97dC56f08fec960acAb5D530187731A3C48": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2e97274F89015e53c779b8aB58d66756c10A555": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2AE8bf7a267B279696a6e915ae72dF92Eac6280": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c293bcE7c0961b07064EF486B7c91E34eC2a59eF": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2B66f6F365b52DB8Dd06987BE856Ec1848C4a68": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c234fb13Ed14e93973340c7cd178049fa62B21dd": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c215f26E981e23533990364AD94Fa35B3dA55A63": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2d64b7BDFD42Cabb032A299537eecefb01C056e": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2cD86a773cf7b6f3b9eA9F78E485fd2Ba4dF557": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2837f0b7eEF8B6687e90E6422C13b9eCd602ED5": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2282466F362950A6BEa293bcD53d9CF3D0EE42f": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c218B84e76Be60FF0EebBaf4d1F00ccc96EAa504": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2b6693068A23a00efcc1a9680CBDE52372ad78A": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2b3D6bC53D4fF1E9641d2e03A863B30EB6f31c7": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2661c75Fb5c68840CBCfeA1E1679b58Ff89699e": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c281803b7335621f71D53d820374E7Bc046D6D45": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c274577b89588667BCa0a7904D4527ecd413f8A4": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2Ed593CA7eBf9431fA77d37dac26c5830491d69": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "c2e7c571B32e3fD05F57e515A047FA3e099afC88": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "22bd5eBDA9845eA6c711cf7aA4853E2f65c04bb3": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      },
      "39Db58932E0E209ba7453dC23FA3Da8463320612": {
        "balance": "0x314dc6448d9338c15B0a00000000"
      }
    },
    "number": "0x0",
    "gasUsed": "0x0",
    "parentHash": "0x0000000000000000000000000000000000000000000000000000000000000000"
  }`
)
