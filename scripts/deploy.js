const { ethers } = require("hardhat");

async function main() {
  console.log("Starting StableCoin deployment...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Contract deployment parameters
  const TOKEN_NAME = "HectoCoin";
  const TOKEN_SYMBOL = "HECTO";
  const INITIAL_SUPPLY = 1000000; // 1 million tokens

  console.log("\nDeployment Parameters:");
  console.log("Token Name:", TOKEN_NAME);
  console.log("Token Symbol:", TOKEN_SYMBOL);
  console.log("Initial Supply:", INITIAL_SUPPLY, "tokens");

  // Deploy StableCoin contract
  console.log("\nDeploying StableCoin contract...");
  const StableCoin = await ethers.getContractFactory("StableCoin");
  const stableCoin = await StableCoin.deploy(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY);
  
  await stableCoin.waitForDeployment();
  const contractAddress = await stableCoin.getAddress();
  
  console.log("✅ HectoCoin deployed to:", contractAddress);

  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  
  const name = await stableCoin.name();
  const symbol = await stableCoin.symbol();
  const decimals = await stableCoin.decimals();
  const totalSupply = await stableCoin.totalSupply();
  const owner = await stableCoin.owner();
  const ownerBalance = await stableCoin.balanceOf(deployer.address);
  const paused = await stableCoin.paused();

  console.log("Contract Details:");
  console.log("- Name:", name);
  console.log("- Symbol:", symbol);
  console.log("- Decimals:", decimals.toString());
  console.log("- Total Supply:", ethers.formatEther(totalSupply), symbol);
  console.log("- Owner:", owner);
  console.log("- Owner Balance:", ethers.formatEther(ownerBalance), symbol);
  console.log("- Paused:", paused);

  // Initial contract setup (if needed)
  console.log("\n⚙️ Initial contract setup...");
  
  // Example: Mint additional tokens to deployer (optional)
  // const mintAmount = ethers.parseEther("100000"); // 100,000 tokens
  // console.log("Minting additional", ethers.formatEther(mintAmount), symbol, "to deployer...");
  // const mintTx = await stableCoin.mint(deployer.address, mintAmount);
  // await mintTx.wait();
  // console.log("✅ Additional tokens minted");

  // Save deployment information
  const networkName = hre.network.name;
  const deploymentInfo = {
    network: networkName,
    contractAddress: contractAddress,
    deployer: deployer.address,
    transactionHash: stableCoin.deploymentTransaction().hash,
    blockNumber: (await stableCoin.deploymentTransaction().wait()).blockNumber,
    tokenName: TOKEN_NAME,
    tokenSymbol: TOKEN_SYMBOL,
    initialSupply: INITIAL_SUPPLY,
    deployedAt: new Date().toISOString()
  };

  console.log("\n📝 Deployment Summary:");
  console.log("Network:", networkName);
  console.log("Contract Address:", contractAddress);
  console.log("Transaction Hash:", deploymentInfo.transactionHash);
  console.log("Block Number:", deploymentInfo.blockNumber);
  console.log("Gas Used:", (await stableCoin.deploymentTransaction().wait()).gasUsed.toString());

  // For Sepolia/mainnet, remind about verification
  if (networkName === "sepolia" || networkName === "mainnet") {
    console.log("\n🔗 Next Steps:");
    console.log("1. Wait for a few block confirmations");
    console.log("2. Verify contract on Etherscan:");
    console.log(`   npx hardhat verify --network ${networkName} ${contractAddress} "HectoCoin" "HECTO" ${INITIAL_SUPPLY}`);
    console.log("\n3. Add contract to MetaMask:");
    console.log("   Token Address:", contractAddress);
    console.log("   Token Symbol:", TOKEN_SYMBOL);
    console.log("   Token Decimals:", decimals.toString());
  }

  return {
    contract: stableCoin,
    address: contractAddress,
    deploymentInfo
  };
}

// Execute deployment
main()
  .then((result) => {
    console.log("\n🎉 Deployment completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });