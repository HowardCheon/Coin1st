const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Governance System", function () {
  let multiSig;
  let timeLock;
  let governedCoin;
  let owner, admin, proposer1, proposer2, executor1, user1, user2;
  
  const TOKEN_NAME = "Governed StableCoin";
  const TOKEN_SYMBOL = "GSTABLE";
  const INITIAL_SUPPLY = 1000000;
  const TIMELOCK_DELAY = 2 * 24 * 60 * 60; // 2 days in seconds
  const MULTISIG_THRESHOLD = 2;

  beforeEach(async function () {
    [owner, admin, proposer1, proposer2, executor1, user1, user2] = await ethers.getSigners();

    // Deploy MultiSig
    const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
    const multisigOwners = [proposer1.address, proposer2.address, executor1.address];
    multiSig = await MultiSigWallet.deploy(multisigOwners, MULTISIG_THRESHOLD);
    await multiSig.waitForDeployment();

    // Deploy TimeLock
    const TimeLock = await ethers.getContractFactory("TimeLock");
    const proposers = [await multiSig.getAddress()];
    const executors = [await multiSig.getAddress()];
    timeLock = await TimeLock.deploy(TIMELOCK_DELAY, proposers, executors, admin.address);
    await timeLock.waitForDeployment();

    // Deploy Governed StableCoin
    const GovernedStableCoin = await ethers.getContractFactory("GovernedStableCoin");
    governedCoin = await GovernedStableCoin.deploy(
      TOKEN_NAME,
      TOKEN_SYMBOL,
      INITIAL_SUPPLY,
      admin.address,
      await timeLock.getAddress()
    );
    await governedCoin.waitForDeployment();
  });

  describe("MultiSig Wallet", function () {
    it("Should initialize with correct owners and threshold", async function () {
      const owners = await multiSig.getOwners();
      expect(owners).to.have.length(3);
      expect(owners).to.include(proposer1.address);
      expect(owners).to.include(proposer2.address);
      expect(owners).to.include(executor1.address);
      
      expect(await multiSig.numConfirmationsRequired()).to.equal(MULTISIG_THRESHOLD);
    });

    it("Should allow owner to submit transaction", async function () {
      const to = user1.address;
      const value = ethers.parseEther("1");
      const data = "0x";

      await expect(multiSig.connect(proposer1).submitTransaction(to, value, data))
        .to.emit(multiSig, "SubmitTransaction")
        .withArgs(proposer1.address, 0, to, value, data);
    });

    it("Should allow owners to confirm transaction", async function () {
      const to = user1.address;
      const value = 0;
      const data = "0x";

      await multiSig.connect(proposer1).submitTransaction(to, value, data);
      
      await expect(multiSig.connect(proposer2).confirmTransaction(0))
        .to.emit(multiSig, "ConfirmTransaction")
        .withArgs(proposer2.address, 0);
    });

    it("Should not allow non-owner to submit transaction", async function () {
      await expect(
        multiSig.connect(user1).submitTransaction(user2.address, 0, "0x")
      ).to.be.reverted;
    });

    it("Should not allow double confirmation", async function () {
      await multiSig.connect(proposer1).submitTransaction(user1.address, 0, "0x");
      await multiSig.connect(proposer1).confirmTransaction(0);
      
      await expect(
        multiSig.connect(proposer1).confirmTransaction(0)
      ).to.be.reverted;
    });
  });

  describe("TimeLock", function () {
    it("Should initialize with correct delay and roles", async function () {
      expect(await timeLock.delay()).to.equal(TIMELOCK_DELAY);
      
      const proposerRole = await timeLock.PROPOSER_ROLE();
      const executorRole = await timeLock.EXECUTOR_ROLE();
      
      expect(await timeLock.hasRole(proposerRole, await multiSig.getAddress())).to.be.true;
      expect(await timeLock.hasRole(executorRole, await multiSig.getAddress())).to.be.true;
    });

    it("Should allow proposer to queue transaction", async function () {
      const target = await governedCoin.getAddress();
      const value = 0;
      const signature = "mint(address,uint256)";
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [user1.address, ethers.parseEther("1000")]
      );
      const executeTime = (await time.latest()) + TIMELOCK_DELAY + 100;

      // Create calldata for multiSig to call timeLock
      const queueCalldata = timeLock.interface.encodeFunctionData("queueTransaction", [
        target, value, signature, data, executeTime
      ]);

      // Submit to multiSig
      await multiSig.connect(proposer1).submitTransaction(
        await timeLock.getAddress(),
        0,
        queueCalldata
      );
      
      // Confirm and execute via multiSig
      await multiSig.connect(proposer2).confirmTransaction(0);
      
      await expect(multiSig.connect(executor1).executeTransaction(0))
        .to.emit(timeLock, "QueueTransaction");
    });

    it("Should not allow execution before delay", async function () {
      const target = await governedCoin.getAddress();
      const value = 0;
      const signature = "mint(address,uint256)";
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [user1.address, ethers.parseEther("1000")]
      );
      const executeTime = (await time.latest()) + TIMELOCK_DELAY + 100;

      // Queue transaction via multiSig
      const queueCalldata = timeLock.interface.encodeFunctionData("queueTransaction", [
        target, value, signature, data, executeTime
      ]);
      await multiSig.connect(proposer1).submitTransaction(await timeLock.getAddress(), 0, queueCalldata);
      await multiSig.connect(proposer2).confirmTransaction(0);
      await multiSig.connect(executor1).executeTransaction(0);

      // Try to execute before time
      const executeCalldata = timeLock.interface.encodeFunctionData("executeTransaction", [
        target, value, signature, data, executeTime
      ]);
      await multiSig.connect(proposer1).submitTransaction(await timeLock.getAddress(), 0, executeCalldata);
      await multiSig.connect(proposer2).confirmTransaction(1);
      
      await expect(
        multiSig.connect(executor1).executeTransaction(1)
      ).to.be.reverted;
    });
  });

  describe("Governed StableCoin", function () {
    it("Should initialize with correct governance setup", async function () {
      expect(await governedCoin.name()).to.equal(TOKEN_NAME);
      expect(await governedCoin.symbol()).to.equal(TOKEN_SYMBOL);
      
      const defaultAdminRole = await governedCoin.DEFAULT_ADMIN_ROLE();
      const minterRole = await governedCoin.MINTER_ROLE();
      const pauserRole = await governedCoin.PAUSER_ROLE();
      const blacklistRole = await governedCoin.BLACKLIST_ROLE();
      
      expect(await governedCoin.hasRole(defaultAdminRole, await timeLock.getAddress())).to.be.true;
      expect(await governedCoin.hasRole(minterRole, admin.address)).to.be.true;
      expect(await governedCoin.hasRole(pauserRole, admin.address)).to.be.true;
      expect(await governedCoin.hasRole(blacklistRole, admin.address)).to.be.true;
    });

    it("Should allow admin to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      await governedCoin.connect(admin).mint(user1.address, mintAmount);
      
      expect(await governedCoin.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("Should not allow non-minter to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      
      await expect(
        governedCoin.connect(user1).mint(user2.address, mintAmount)
      ).to.be.reverted;
    });

    it("Should allow admin to pause contract", async function () {
      await governedCoin.connect(admin).pause();
      expect(await governedCoin.paused()).to.be.true;
    });

    it("Should prevent transfers when paused", async function () {
      await governedCoin.connect(admin).transfer(user1.address, ethers.parseEther("1000"));
      await governedCoin.connect(admin).pause();
      
      await expect(
        governedCoin.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });

    it("Should allow admin to blacklist accounts", async function () {
      await expect(governedCoin.connect(admin).blacklist(user1.address))
        .to.emit(governedCoin, "Blacklisted")
        .withArgs(user1.address);
      
      expect(await governedCoin.isBlacklisted(user1.address)).to.be.true;
    });

    it("Should prevent blacklisted accounts from receiving tokens", async function () {
      await governedCoin.connect(admin).blacklist(user1.address);
      
      await expect(
        governedCoin.connect(admin).transfer(user1.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });
  });

  describe("Governance Workflow Integration", function () {
    it("Should execute governance proposal through complete workflow", async function () {
      // Scenario: Mint new tokens through governance
      const mintAmount = ethers.parseEther("50000");
      const target = await governedCoin.getAddress();
      const value = 0;
      const signature = "mint(address,uint256)";
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [user1.address, mintAmount]
      );
      const executeTime = (await time.latest()) + TIMELOCK_DELAY + 100;

      // Step 1: Queue transaction in TimeLock via MultiSig
      const queueCalldata = timeLock.interface.encodeFunctionData("queueTransaction", [
        target, value, signature, data, executeTime
      ]);
      
      await multiSig.connect(proposer1).submitTransaction(await timeLock.getAddress(), 0, queueCalldata);
      await multiSig.connect(proposer2).confirmTransaction(0);
      await multiSig.connect(executor1).executeTransaction(0);

      // Step 2: Fast forward time
      await time.increaseTo(executeTime);

      // Step 3: Execute transaction via MultiSig
      const executeCalldata = timeLock.interface.encodeFunctionData("executeTransaction", [
        target, value, signature, data, executeTime
      ]);
      
      await multiSig.connect(proposer1).submitTransaction(await timeLock.getAddress(), 0, executeCalldata);
      await multiSig.connect(proposer2).confirmTransaction(1);
      
      // Check initial balance
      const initialBalance = await governedCoin.balanceOf(user1.address);
      
      await multiSig.connect(executor1).executeTransaction(1);
      
      // Verify tokens were minted
      const finalBalance = await governedCoin.balanceOf(user1.address);
      expect(finalBalance - initialBalance).to.equal(mintAmount);
    });

    it("Should allow cancellation of queued transactions", async function () {
      const target = await governedCoin.getAddress();
      const value = 0;
      const signature = "mint(address,uint256)";
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [user1.address, ethers.parseEther("1000")]
      );
      const executeTime = (await time.latest()) + TIMELOCK_DELAY + 100;

      // Queue transaction
      const queueCalldata = timeLock.interface.encodeFunctionData("queueTransaction", [
        target, value, signature, data, executeTime
      ]);
      await multiSig.connect(proposer1).submitTransaction(await timeLock.getAddress(), 0, queueCalldata);
      await multiSig.connect(proposer2).confirmTransaction(0);
      await multiSig.connect(executor1).executeTransaction(0);

      // Cancel transaction (admin has CANCELLER_ROLE)
      await expect(timeLock.connect(admin).cancelTransaction(target, value, signature, data, executeTime))
        .to.emit(timeLock, "CancelTransaction");
    });
  });

  describe("Role Management", function () {
    it("Should allow TimeLock to grant roles", async function () {
      // Create a transaction to grant MINTER_ROLE to user1
      const target = await governedCoin.getAddress();
      const signature = "grantMinterRole(address)";
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [user1.address]);
      const executeTime = (await time.latest()) + TIMELOCK_DELAY + 100;

      // Queue and execute via governance
      const queueCalldata = timeLock.interface.encodeFunctionData("queueTransaction", [
        target, 0, signature, data, executeTime
      ]);
      
      await multiSig.connect(proposer1).submitTransaction(await timeLock.getAddress(), 0, queueCalldata);
      await multiSig.connect(proposer2).confirmTransaction(0);
      await multiSig.connect(executor1).executeTransaction(0);

      await time.increaseTo(executeTime);

      const executeCalldata = timeLock.interface.encodeFunctionData("executeTransaction", [
        target, 0, signature, data, executeTime
      ]);
      
      await multiSig.connect(proposer1).submitTransaction(await timeLock.getAddress(), 0, executeCalldata);
      await multiSig.connect(proposer2).confirmTransaction(1);
      await multiSig.connect(executor1).executeTransaction(1);

      // Verify role was granted
      const minterRole = await governedCoin.MINTER_ROLE();
      expect(await governedCoin.hasRole(minterRole, user1.address)).to.be.true;
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow TimeLock to call emergency functions", async function () {
      // Send some ETH to the governed coin contract
      await admin.sendTransaction({
        to: await governedCoin.getAddress(),
        value: ethers.parseEther("1")
      });

      // Create emergency withdrawal transaction
      const target = await governedCoin.getAddress();
      const signature = "emergencyWithdraw(address,address,uint256)";
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256"],
        [ethers.ZeroAddress, admin.address, ethers.parseEther("1")]
      );
      const executeTime = (await time.latest()) + TIMELOCK_DELAY + 100;

      // Execute via governance (queue + execute)
      const queueCalldata = timeLock.interface.encodeFunctionData("queueTransaction", [
        target, 0, signature, data, executeTime
      ]);
      
      await multiSig.connect(proposer1).submitTransaction(await timeLock.getAddress(), 0, queueCalldata);
      await multiSig.connect(proposer2).confirmTransaction(0);
      await multiSig.connect(executor1).executeTransaction(0);

      await time.increaseTo(executeTime);

      const executeCalldata = timeLock.interface.encodeFunctionData("executeTransaction", [
        target, 0, signature, data, executeTime
      ]);
      
      await multiSig.connect(proposer1).submitTransaction(await timeLock.getAddress(), 0, executeCalldata);
      await multiSig.connect(proposer2).confirmTransaction(1);
      
      const adminBalanceBefore = await ethers.provider.getBalance(admin.address);
      await multiSig.connect(executor1).executeTransaction(1);
      const adminBalanceAfter = await ethers.provider.getBalance(admin.address);
      
      expect(adminBalanceAfter - adminBalanceBefore).to.be.gt(0);
    });
  });
});