const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Optimized Contracts Gas Comparison", function () {
  let originalCoin, optimizedCoin;
  let originalMultiSig, optimizedMultiSig;
  let owner, user1, user2, user3;
  
  const TOKEN_NAME = "StableCoin";
  const TOKEN_SYMBOL = "STABLE";
  const INITIAL_SUPPLY = 1000000;

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy original contracts
    const StableCoin = await ethers.getContractFactory("StableCoin");
    originalCoin = await StableCoin.deploy(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY);
    await originalCoin.waitForDeployment();

    const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
    originalMultiSig = await MultiSigWallet.deploy([owner.address, user1.address, user2.address], 2);
    await originalMultiSig.waitForDeployment();

    // Deploy optimized contracts
    const OptimizedStableCoin = await ethers.getContractFactory("OptimizedStableCoin");
    optimizedCoin = await OptimizedStableCoin.deploy(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY);
    await optimizedCoin.waitForDeployment();

    const OptimizedMultiSig = await ethers.getContractFactory("OptimizedMultiSig");
    optimizedMultiSig = await OptimizedMultiSig.deploy([owner.address, user1.address, user2.address], 2);
    await optimizedMultiSig.waitForDeployment();
  });

  describe("Gas Comparison - StableCoin", function () {
    it("Should demonstrate gas savings in transfer function", async function () {
      const transferAmount = ethers.parseEther("100");
      
      // Test original contract
      await originalCoin.transfer(user1.address, transferAmount);
      const originalTransferTx = await originalCoin.connect(user1).transfer(user2.address, ethers.parseEther("50"));
      const originalReceipt = await originalTransferTx.wait();
      
      // Test optimized contract
      await optimizedCoin.transfer(user1.address, transferAmount);
      const optimizedTransferTx = await optimizedCoin.connect(user1).transfer(user2.address, ethers.parseEther("50"));
      const optimizedReceipt = await optimizedTransferTx.wait();
      
      console.log("Transfer Gas Comparison:");
      console.log("Original:", originalReceipt.gasUsed.toString());
      console.log("Optimized:", optimizedReceipt.gasUsed.toString());
      console.log("Savings:", (originalReceipt.gasUsed - optimizedReceipt.gasUsed).toString());
      console.log("Percentage:", ((Number(originalReceipt.gasUsed - optimizedReceipt.gasUsed) / Number(originalReceipt.gasUsed)) * 100).toFixed(2) + "%");
      
      // Verify functionality is preserved
      expect(await optimizedCoin.balanceOf(user2.address)).to.equal(ethers.parseEther("50"));
    });

    it("Should demonstrate gas savings in blacklist function", async function () {
      // Test original contract
      const originalBlacklistTx = await originalCoin.blacklist(user1.address);
      const originalBlacklistReceipt = await originalBlacklistTx.wait();
      
      // Test optimized contract
      const optimizedBlacklistTx = await optimizedCoin.blacklist(user1.address);
      const optimizedBlacklistReceipt = await optimizedBlacklistTx.wait();
      
      console.log("\nBlacklist Gas Comparison:");
      console.log("Original:", originalBlacklistReceipt.gasUsed.toString());
      console.log("Optimized:", optimizedBlacklistReceipt.gasUsed.toString());
      console.log("Savings:", (originalBlacklistReceipt.gasUsed - optimizedBlacklistReceipt.gasUsed).toString());
      console.log("Percentage:", ((Number(originalBlacklistReceipt.gasUsed - optimizedBlacklistReceipt.gasUsed) / Number(originalBlacklistReceipt.gasUsed)) * 100).toFixed(2) + "%");
      
      // Verify functionality is preserved
      expect(await optimizedCoin.isBlacklisted(user1.address)).to.be.true;
    });

    it("Should test batch operations gas efficiency", async function () {
      const accounts = [user1.address, user2.address, user3.address];
      
      // Test batch blacklist
      const batchBlacklistTx = await optimizedCoin.batchBlacklist(accounts);
      const batchBlacklistReceipt = await batchBlacklistTx.wait();
      
      // Compare with individual operations on original contract
      const individual1 = await originalCoin.blacklist(user1.address);
      const individual2 = await originalCoin.blacklist(user2.address);
      const individual3 = await originalCoin.blacklist(user3.address);
      
      const individualReceipts = await Promise.all([
        individual1.wait(),
        individual2.wait(),
        individual3.wait()
      ]);
      
      const totalIndividualGas = individualReceipts.reduce((sum, receipt) => sum + receipt.gasUsed, 0n);
      
      console.log("\nBatch vs Individual Blacklist:");
      console.log("Batch (3 accounts):", batchBlacklistReceipt.gasUsed.toString());
      console.log("Individual (3 separate txs):", totalIndividualGas.toString());
      console.log("Savings:", (totalIndividualGas - batchBlacklistReceipt.gasUsed).toString());
      console.log("Percentage:", ((Number(totalIndividualGas - batchBlacklistReceipt.gasUsed) / Number(totalIndividualGas)) * 100).toFixed(2) + "%");
      
      // Verify all accounts are blacklisted
      for (const account of accounts) {
        expect(await optimizedCoin.isBlacklisted(account)).to.be.true;
      }
    });

    it("Should test batch transfer gas efficiency", async function () {
      const recipients = [user1.address, user2.address, user3.address];
      const amounts = [ethers.parseEther("100"), ethers.parseEther("200"), ethers.parseEther("300")];
      
      // Test batch transfer
      const batchTransferTx = await optimizedCoin.batchTransfer(recipients, amounts);
      const batchTransferReceipt = await batchTransferTx.wait();
      
      // Compare with individual transfers on original contract
      const individual1 = await originalCoin.transfer(user1.address, amounts[0]);
      const individual2 = await originalCoin.transfer(user2.address, amounts[1]);
      const individual3 = await originalCoin.transfer(user3.address, amounts[2]);
      
      const individualReceipts = await Promise.all([
        individual1.wait(),
        individual2.wait(),
        individual3.wait()
      ]);
      
      const totalIndividualGas = individualReceipts.reduce((sum, receipt) => sum + receipt.gasUsed, 0n);
      
      console.log("\nBatch vs Individual Transfer:");
      console.log("Batch (3 transfers):", batchTransferReceipt.gasUsed.toString());
      console.log("Individual (3 separate txs):", totalIndividualGas.toString());
      console.log("Savings:", (totalIndividualGas - batchTransferReceipt.gasUsed).toString());
      console.log("Percentage:", ((Number(totalIndividualGas - batchTransferReceipt.gasUsed) / Number(totalIndividualGas)) * 100).toFixed(2) + "%");
      
      // Verify all transfers succeeded
      expect(await optimizedCoin.balanceOf(user1.address)).to.equal(amounts[0]);
      expect(await optimizedCoin.balanceOf(user2.address)).to.equal(amounts[1]);
      expect(await optimizedCoin.balanceOf(user3.address)).to.equal(amounts[2]);
    });
  });

  describe("Gas Comparison - MultiSig", function () {
    it("Should demonstrate gas savings in transaction submission", async function () {
      const to = user3.address;
      const value = ethers.parseEther("1");
      const data = "0x";
      
      // Test original contract
      const originalSubmitTx = await originalMultiSig.submitTransaction(to, value, data);
      const originalSubmitReceipt = await originalSubmitTx.wait();
      
      // Test optimized contract
      const optimizedSubmitTx = await optimizedMultiSig.submitTransaction(to, value, data);
      const optimizedSubmitReceipt = await optimizedSubmitTx.wait();
      
      console.log("\nMultiSig Submit Transaction Gas Comparison:");
      console.log("Original:", originalSubmitReceipt.gasUsed.toString());
      console.log("Optimized:", optimizedSubmitReceipt.gasUsed.toString());
      console.log("Savings:", (originalSubmitReceipt.gasUsed - optimizedSubmitReceipt.gasUsed).toString());
      console.log("Percentage:", ((Number(originalSubmitReceipt.gasUsed - optimizedSubmitReceipt.gasUsed) / Number(originalSubmitReceipt.gasUsed)) * 100).toFixed(2) + "%");
    });

    it("Should test batch confirmation gas efficiency", async function () {
      const to = user3.address;
      const value = 0;
      const data = "0x";
      
      // Submit 3 transactions
      await optimizedMultiSig.submitTransaction(to, value, data);
      await optimizedMultiSig.submitTransaction(to, value, data);
      await optimizedMultiSig.submitTransaction(to, value, data);
      
      // Test batch confirmation
      const batchConfirmTx = await optimizedMultiSig.connect(user1).batchConfirm([0, 1, 2]);
      const batchConfirmReceipt = await batchConfirmTx.wait();
      
      // Compare with individual confirmations on original contract
      await originalMultiSig.submitTransaction(to, value, data);
      await originalMultiSig.submitTransaction(to, value, data);
      await originalMultiSig.submitTransaction(to, value, data);
      
      const individual1 = await originalMultiSig.connect(user1).confirmTransaction(0);
      const individual2 = await originalMultiSig.connect(user1).confirmTransaction(1);
      const individual3 = await originalMultiSig.connect(user1).confirmTransaction(2);
      
      const individualReceipts = await Promise.all([
        individual1.wait(),
        individual2.wait(),
        individual3.wait()
      ]);
      
      const totalIndividualGas = individualReceipts.reduce((sum, receipt) => sum + receipt.gasUsed, 0n);
      
      console.log("\nBatch vs Individual Confirmation:");
      console.log("Batch (3 confirmations):", batchConfirmReceipt.gasUsed.toString());
      console.log("Individual (3 separate txs):", totalIndividualGas.toString());
      console.log("Savings:", (totalIndividualGas - batchConfirmReceipt.gasUsed).toString());
      console.log("Percentage:", ((Number(totalIndividualGas - batchConfirmReceipt.gasUsed) / Number(totalIndividualGas)) * 100).toFixed(2) + "%");
    });

    it("Should test submit and confirm in one transaction", async function () {
      const to = user3.address;
      const value = 0;
      const data = "0x";
      
      // Test submit + confirm in one tx (optimized)
      const combinedTx = await optimizedMultiSig.submitAndConfirmTransaction(to, value, data);
      const combinedReceipt = await combinedTx.wait();
      
      // Compare with separate submit + confirm (original)
      const submitTx = await originalMultiSig.submitTransaction(to, value, data);
      const confirmTx = await originalMultiSig.confirmTransaction(0);
      
      const submitReceipt = await submitTx.wait();
      const confirmReceipt = await confirmTx.wait();
      const totalSeparateGas = submitReceipt.gasUsed + confirmReceipt.gasUsed;
      
      console.log("\nCombined vs Separate Submit+Confirm:");
      console.log("Combined (1 tx):", combinedReceipt.gasUsed.toString());
      console.log("Separate (2 txs):", totalSeparateGas.toString());
      console.log("Savings:", (totalSeparateGas - combinedReceipt.gasUsed).toString());
      console.log("Percentage:", ((Number(totalSeparateGas - combinedReceipt.gasUsed) / Number(totalSeparateGas)) * 100).toFixed(2) + "%");
    });
  });

  describe("Deployment Gas Comparison", function () {
    it("Should compare deployment costs", async function () {
      // Get deployment transactions
      const originalCoinDeployment = await originalCoin.deploymentTransaction();
      const optimizedCoinDeployment = await optimizedCoin.deploymentTransaction();
      
      const originalMultiSigDeployment = await originalMultiSig.deploymentTransaction();
      const optimizedMultiSigDeployment = await optimizedMultiSig.deploymentTransaction();
      
      // Wait for receipts
      const originalCoinReceipt = await originalCoinDeployment.wait();
      const optimizedCoinReceipt = await optimizedCoinDeployment.wait();
      const originalMultiSigReceipt = await originalMultiSigDeployment.wait();
      const optimizedMultiSigReceipt = await optimizedMultiSigDeployment.wait();
      
      console.log("\n=== DEPLOYMENT GAS COMPARISON ===");
      
      console.log("\nStableCoin Deployment:");
      console.log("Original:", originalCoinReceipt.gasUsed.toString());
      console.log("Optimized:", optimizedCoinReceipt.gasUsed.toString());
      console.log("Savings:", (originalCoinReceipt.gasUsed - optimizedCoinReceipt.gasUsed).toString());
      console.log("Percentage:", ((Number(originalCoinReceipt.gasUsed - optimizedCoinReceipt.gasUsed) / Number(originalCoinReceipt.gasUsed)) * 100).toFixed(2) + "%");
      
      console.log("\nMultiSig Deployment:");
      console.log("Original:", originalMultiSigReceipt.gasUsed.toString());
      console.log("Optimized:", optimizedMultiSigReceipt.gasUsed.toString());
      console.log("Savings:", (originalMultiSigReceipt.gasUsed - optimizedMultiSigReceipt.gasUsed).toString());
      console.log("Percentage:", ((Number(originalMultiSigReceipt.gasUsed - optimizedMultiSigReceipt.gasUsed) / Number(originalMultiSigReceipt.gasUsed)) * 100).toFixed(2) + "%");
      
      // Assert that optimized versions use less gas
      expect(optimizedCoinReceipt.gasUsed).to.be.lt(originalCoinReceipt.gasUsed);
      expect(optimizedMultiSigReceipt.gasUsed).to.be.lt(originalMultiSigReceipt.gasUsed);
    });
  });

  describe("Functionality Verification", function () {
    it("Should maintain all original functionality - StableCoin", async function () {
      // Test all major functions work the same
      
      // Transfer
      await optimizedCoin.transfer(user1.address, ethers.parseEther("100"));
      expect(await optimizedCoin.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
      
      // Approve and transferFrom
      await optimizedCoin.connect(user1).approve(user2.address, ethers.parseEther("50"));
      await optimizedCoin.connect(user2).transferFrom(user1.address, user3.address, ethers.parseEther("30"));
      expect(await optimizedCoin.balanceOf(user3.address)).to.equal(ethers.parseEther("30"));
      
      // Mint (owner only)
      await optimizedCoin.mint(user1.address, ethers.parseEther("1000"));
      expect(await optimizedCoin.balanceOf(user1.address)).to.equal(ethers.parseEther("1070"));
      
      // Burn
      await optimizedCoin.connect(user1).burn(ethers.parseEther("100"));
      expect(await optimizedCoin.balanceOf(user1.address)).to.equal(ethers.parseEther("970"));
      
      // Pause/Unpause
      await optimizedCoin.pause();
      expect(await optimizedCoin.paused()).to.be.true;
      
      await expect(optimizedCoin.connect(user1).transfer(user2.address, ethers.parseEther("10")))
        .to.be.reverted;
      
      await optimizedCoin.unpause();
      await optimizedCoin.connect(user1).transfer(user2.address, ethers.parseEther("10"));
      expect(await optimizedCoin.balanceOf(user2.address)).to.equal(ethers.parseEther("10"));
      
      // Blacklist
      await optimizedCoin.blacklist(user2.address);
      expect(await optimizedCoin.isBlacklisted(user2.address)).to.be.true;
      
      await expect(optimizedCoin.connect(user1).transfer(user2.address, ethers.parseEther("10")))
        .to.be.reverted;
      
      await optimizedCoin.unBlacklist(user2.address);
      await optimizedCoin.connect(user1).transfer(user2.address, ethers.parseEther("10"));
      expect(await optimizedCoin.balanceOf(user2.address)).to.equal(ethers.parseEther("20"));
    });

    it("Should maintain all original functionality - MultiSig", async function () {
      const to = user3.address;
      const value = 0;
      const data = "0x";
      
      // Submit transaction
      await optimizedMultiSig.submitTransaction(to, value, data);
      expect(await optimizedMultiSig.getTransactionCount()).to.equal(1);
      
      // Confirm transaction
      await optimizedMultiSig.connect(user1).confirmTransaction(0);
      const [, , , , confirmations] = await optimizedMultiSig.getTransaction(0);
      expect(confirmations).to.equal(1);
      
      // Execute transaction (need 2 confirmations)
      await optimizedMultiSig.connect(user2).confirmTransaction(0);
      await optimizedMultiSig.executeTransaction(0);
      
      const [, , , executed, ] = await optimizedMultiSig.getTransaction(0);
      expect(executed).to.be.true;
    });
  });
});