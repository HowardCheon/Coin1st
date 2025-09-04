const { ethers } = require("hardhat");

async function main() {
  console.log("🏠 Starting Local Testnet Deployment...");
  console.log("Network:", hre.network.name);
  
  const [deployer, user1, user2, user3] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Contract deployment parameters
  const TOKEN_NAME = "Hecto Coin";
  const TOKEN_SYMBOL = "HECTO";
  const INITIAL_SUPPLY = 1000000; // 1 million tokens

  console.log("\n📝 Deployment Parameters:");
  console.log("Token Name:", TOKEN_NAME);
  console.log("Token Symbol:", TOKEN_SYMBOL);
  console.log("Initial Supply:", INITIAL_SUPPLY, "tokens");

  // Deploy StableCoin contract
  console.log("\n🚀 Deploying StableCoin contract...");
  const StableCoin = await ethers.getContractFactory("StableCoin");
  const stableCoin = await StableCoin.deploy(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY);
  
  await stableCoin.waitForDeployment();
  const contractAddress = await stableCoin.getAddress();
  
  console.log("✅ StableCoin deployed to:", contractAddress);

  // Basic verification
  console.log("\n🔍 Contract verification...");
  const name = await stableCoin.name();
  const symbol = await stableCoin.symbol();
  const totalSupply = await stableCoin.totalSupply();
  const ownerBalance = await stableCoin.balanceOf(deployer.address);

  console.log("- Name:", name);
  console.log("- Symbol:", symbol);
  console.log("- Total Supply:", ethers.formatEther(totalSupply), symbol);
  console.log("- Owner Balance:", ethers.formatEther(ownerBalance), symbol);

  // Demo operations for local testing
  console.log("\n🧪 Performing demo operations...");
  
  // Transfer tokens to test users
  console.log("1. Transferring tokens to test users...");
  const transferAmount = ethers.parseEther("10000"); // 10,000 tokens each
  
  await stableCoin.transfer(user1.address, transferAmount);
  await stableCoin.transfer(user2.address, transferAmount);
  await stableCoin.transfer(user3.address, transferAmount);
  
  console.log(`   ✅ Transferred ${ethers.formatEther(transferAmount)} ${symbol} to each user`);

  // Check balances
  console.log("2. Checking user balances...");
  console.log(`   User1 (${user1.address}): ${ethers.formatEther(await stableCoin.balanceOf(user1.address))} ${symbol}`);
  console.log(`   User2 (${user2.address}): ${ethers.formatEther(await stableCoin.balanceOf(user2.address))} ${symbol}`);
  console.log(`   User3 (${user3.address}): ${ethers.formatEther(await stableCoin.balanceOf(user3.address))} ${symbol}`);

  // Demonstrate minting
  console.log("3. Demonstrating mint function...");
  const mintAmount = ethers.parseEther("50000");
  await stableCoin.mint(user1.address, mintAmount);
  console.log(`   ✅ Minted ${ethers.formatEther(mintAmount)} ${symbol} to User1`);
  console.log(`   User1 new balance: ${ethers.formatEther(await stableCoin.balanceOf(user1.address))} ${symbol}`);

  // Demonstrate burning
  console.log("4. Demonstrating burn function...");
  const burnAmount = ethers.parseEther("5000");
  await stableCoin.connect(user1).burn(burnAmount);
  console.log(`   ✅ User1 burned ${ethers.formatEther(burnAmount)} ${symbol}`);
  console.log(`   User1 new balance: ${ethers.formatEther(await stableCoin.balanceOf(user1.address))} ${symbol}`);

  // Demonstrate pause functionality
  console.log("5. Demonstrating pause functionality...");
  await stableCoin.pause();
  console.log("   ✅ Contract paused");
  
  try {
    await stableCoin.connect(user1).transfer(user2.address, ethers.parseEther("100"));
    console.log("   ❌ Transfer should have failed!");
  } catch (error) {
    console.log("   ✅ Transfer correctly blocked while paused");
  }
  
  await stableCoin.unpause();
  console.log("   ✅ Contract unpaused");

  // Demonstrate blacklist functionality
  console.log("6. Demonstrating blacklist functionality...");
  await stableCoin.blacklist(user2.address);
  console.log("   ✅ User2 blacklisted");
  
  try {
    await stableCoin.connect(user1).transfer(user2.address, ethers.parseEther("100"));
    console.log("   ❌ Transfer to blacklisted user should have failed!");
  } catch (error) {
    console.log("   ✅ Transfer to blacklisted user correctly blocked");
  }
  
  await stableCoin.unBlacklist(user2.address);
  console.log("   ✅ User2 removed from blacklist");

  // Final successful transfer
  console.log("7. Final test transfer...");
  await stableCoin.connect(user1).transfer(user2.address, ethers.parseEther("1000"));
  console.log("   ✅ Transfer successful after unblacklisting");

  // Display final state
  console.log("\n📊 Final Contract State:");
  console.log("Total Supply:", ethers.formatEther(await stableCoin.totalSupply()), symbol);
  console.log("Contract Address:", contractAddress);
  console.log("Owner:", await stableCoin.owner());
  console.log("Paused:", await stableCoin.paused());
  
  console.log("\n💰 Final Balances:");
  console.log(`Deployer: ${ethers.formatEther(await stableCoin.balanceOf(deployer.address))} ${symbol}`);
  console.log(`User1: ${ethers.formatEther(await stableCoin.balanceOf(user1.address))} ${symbol}`);
  console.log(`User2: ${ethers.formatEther(await stableCoin.balanceOf(user2.address))} ${symbol}`);
  console.log(`User3: ${ethers.formatEther(await stableCoin.balanceOf(user3.address))} ${symbol}`);

  console.log("\n🎯 Useful Commands for Interaction:");
  console.log("# Connect to local network");
  console.log("npx hardhat console --network localhost");
  console.log("");
  console.log("# In console:");
  console.log(`const StableCoin = await ethers.getContractFactory("StableCoin");`);
  console.log(`const contract = await StableCoin.attach("${contractAddress}");`);
  console.log("const [deployer] = await ethers.getSigners();");
  console.log("await contract.balanceOf(deployer.address);");

  return {
    contract: stableCoin,
    address: contractAddress,
    users: {
      deployer: deployer.address,
      user1: user1.address,
      user2: user2.address,
      user3: user3.address
    }
  };
}

main()
  .then(() => {
    console.log("\n🎉 Local deployment and testing completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Local deployment failed:");
    console.error(error);
    process.exit(1);
  });