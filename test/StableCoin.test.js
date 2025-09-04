const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("StableCoin", function () {
  let StableCoin;
  let stableCoin;
  let owner;
  let addr1;
  let addr2;
  let addrs;

  const TOKEN_NAME = "StableCoin";
  const TOKEN_SYMBOL = "STABLE";
  const INITIAL_SUPPLY = 1000000; // 1 million tokens

  beforeEach(async function () {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    
    StableCoin = await ethers.getContractFactory("StableCoin");
    stableCoin = await StableCoin.deploy(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY);
    await stableCoin.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await stableCoin.owner()).to.equal(owner.address);
    });

    it("Should set the correct name and symbol", async function () {
      expect(await stableCoin.name()).to.equal(TOKEN_NAME);
      expect(await stableCoin.symbol()).to.equal(TOKEN_SYMBOL);
    });

    it("Should have 18 decimals", async function () {
      expect(await stableCoin.decimals()).to.equal(18);
    });

    it("Should mint initial supply to owner", async function () {
      const expectedSupply = ethers.parseEther(INITIAL_SUPPLY.toString());
      expect(await stableCoin.totalSupply()).to.equal(expectedSupply);
      expect(await stableCoin.balanceOf(owner.address)).to.equal(expectedSupply);
    });
  });

  describe("Transfers", function () {
    it("Should transfer tokens between accounts", async function () {
      const transferAmount = ethers.parseEther("50");
      
      await stableCoin.transfer(addr1.address, transferAmount);
      expect(await stableCoin.balanceOf(addr1.address)).to.equal(transferAmount);

      const ownerBalance = await stableCoin.balanceOf(owner.address);
      const expectedOwnerBalance = ethers.parseEther((INITIAL_SUPPLY - 50).toString());
      expect(ownerBalance).to.equal(expectedOwnerBalance);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialBalance = await stableCoin.balanceOf(addr1.address);
      expect(initialBalance).to.equal(0);

      await expect(
        stableCoin.connect(addr1).transfer(owner.address, ethers.parseEther("1"))
      ).to.be.reverted;
    });

    it("Should emit Transfer event", async function () {
      const transferAmount = ethers.parseEther("50");
      
      await expect(stableCoin.transfer(addr1.address, transferAmount))
        .to.emit(stableCoin, "Transfer")
        .withArgs(owner.address, addr1.address, transferAmount);
    });
  });

  describe("Allowances", function () {
    it("Should approve tokens for delegation", async function () {
      const approveAmount = ethers.parseEther("100");
      
      await stableCoin.approve(addr1.address, approveAmount);
      expect(await stableCoin.allowance(owner.address, addr1.address)).to.equal(approveAmount);
    });

    it("Should allow approved account to transfer tokens", async function () {
      const approveAmount = ethers.parseEther("100");
      const transferAmount = ethers.parseEther("50");
      
      await stableCoin.approve(addr1.address, approveAmount);
      await stableCoin.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount);
      
      expect(await stableCoin.balanceOf(addr2.address)).to.equal(transferAmount);
      expect(await stableCoin.allowance(owner.address, addr1.address)).to.equal(approveAmount - transferAmount);
    });

    it("Should fail if transfer amount exceeds allowance", async function () {
      const approveAmount = ethers.parseEther("50");
      const transferAmount = ethers.parseEther("100");
      
      await stableCoin.approve(addr1.address, approveAmount);
      
      await expect(
        stableCoin.connect(addr1).transferFrom(owner.address, addr2.address, transferAmount)
      ).to.be.reverted;
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      const initialSupply = await stableCoin.totalSupply();
      
      await stableCoin.mint(addr1.address, mintAmount);
      
      expect(await stableCoin.balanceOf(addr1.address)).to.equal(mintAmount);
      expect(await stableCoin.totalSupply()).to.equal(initialSupply + mintAmount);
    });

    it("Should emit Transfer event when minting", async function () {
      const mintAmount = ethers.parseEther("1000");
      
      await expect(stableCoin.mint(addr1.address, mintAmount))
        .to.emit(stableCoin, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, mintAmount);
    });

    it("Should not allow non-owner to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      
      await expect(
        stableCoin.connect(addr1).mint(addr2.address, mintAmount)
      ).to.be.reverted;
    });

    it("Should allow minting to zero address (should fail)", async function () {
      const mintAmount = ethers.parseEther("1000");
      
      await expect(
        stableCoin.mint(ethers.ZeroAddress, mintAmount)
      ).to.be.reverted;
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      const transferAmount = ethers.parseEther("1000");
      await stableCoin.transfer(addr1.address, transferAmount);
    });

    it("Should allow token holder to burn their tokens", async function () {
      const burnAmount = ethers.parseEther("500");
      const initialBalance = await stableCoin.balanceOf(addr1.address);
      const initialSupply = await stableCoin.totalSupply();
      
      await stableCoin.connect(addr1).burn(burnAmount);
      
      expect(await stableCoin.balanceOf(addr1.address)).to.equal(initialBalance - burnAmount);
      expect(await stableCoin.totalSupply()).to.equal(initialSupply - burnAmount);
    });

    it("Should emit Transfer event when burning", async function () {
      const burnAmount = ethers.parseEther("500");
      
      await expect(stableCoin.connect(addr1).burn(burnAmount))
        .to.emit(stableCoin, "Transfer")
        .withArgs(addr1.address, ethers.ZeroAddress, burnAmount);
    });

    it("Should not allow burning more tokens than balance", async function () {
      const balance = await stableCoin.balanceOf(addr1.address);
      const burnAmount = balance + ethers.parseEther("1");
      
      await expect(
        stableCoin.connect(addr1).burn(burnAmount)
      ).to.be.reverted;
    });

    it("Should allow approved account to burn tokens via burnFrom", async function () {
      const approveAmount = ethers.parseEther("500");
      const burnAmount = ethers.parseEther("300");
      
      await stableCoin.connect(addr1).approve(addr2.address, approveAmount);
      
      const initialBalance = await stableCoin.balanceOf(addr1.address);
      const initialSupply = await stableCoin.totalSupply();
      
      await stableCoin.connect(addr2).burnFrom(addr1.address, burnAmount);
      
      expect(await stableCoin.balanceOf(addr1.address)).to.equal(initialBalance - burnAmount);
      expect(await stableCoin.totalSupply()).to.equal(initialSupply - burnAmount);
      expect(await stableCoin.allowance(addr1.address, addr2.address)).to.equal(approveAmount - burnAmount);
    });

    it("Should not allow burnFrom if burn amount exceeds allowance", async function () {
      const approveAmount = ethers.parseEther("300");
      const burnAmount = ethers.parseEther("500");
      
      await stableCoin.connect(addr1).approve(addr2.address, approveAmount);
      
      await expect(
        stableCoin.connect(addr2).burnFrom(addr1.address, burnAmount)
      ).to.be.revertedWith("ERC20: burn amount exceeds allowance");
    });
  });

  describe("Ownership", function () {
    it("Should transfer ownership", async function () {
      await stableCoin.transferOwnership(addr1.address);
      expect(await stableCoin.owner()).to.equal(addr1.address);
    });

    it("Should not allow non-owner to transfer ownership", async function () {
      await expect(
        stableCoin.connect(addr1).transferOwnership(addr2.address)
      ).to.be.reverted;
    });

    it("Should allow new owner to mint after ownership transfer", async function () {
      await stableCoin.transferOwnership(addr1.address);
      
      const mintAmount = ethers.parseEther("1000");
      await stableCoin.connect(addr1).mint(addr2.address, mintAmount);
      
      expect(await stableCoin.balanceOf(addr2.address)).to.equal(mintAmount);
    });

    it("Should not allow previous owner to mint after ownership transfer", async function () {
      await stableCoin.transferOwnership(addr1.address);
      
      const mintAmount = ethers.parseEther("1000");
      await expect(
        stableCoin.mint(addr2.address, mintAmount)
      ).to.be.reverted;
    });
  });

  describe("Pause Functionality", function () {
    it("Should allow owner to pause the contract", async function () {
      await stableCoin.pause();
      expect(await stableCoin.paused()).to.be.true;
    });

    it("Should allow owner to unpause the contract", async function () {
      await stableCoin.pause();
      await stableCoin.unpause();
      expect(await stableCoin.paused()).to.be.false;
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(
        stableCoin.connect(addr1).pause()
      ).to.be.reverted;
    });

    it("Should not allow non-owner to unpause", async function () {
      await stableCoin.pause();
      await expect(
        stableCoin.connect(addr1).unpause()
      ).to.be.reverted;
    });

    it("Should prevent transfers when paused", async function () {
      await stableCoin.pause();
      
      await expect(
        stableCoin.transfer(addr1.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });

    it("Should prevent burning when paused", async function () {
      await stableCoin.pause();
      
      await expect(
        stableCoin.burn(ethers.parseEther("100"))
      ).to.be.reverted;
    });

    it("Should allow transfers when unpaused", async function () {
      await stableCoin.pause();
      await stableCoin.unpause();
      
      const transferAmount = ethers.parseEther("100");
      await stableCoin.transfer(addr1.address, transferAmount);
      expect(await stableCoin.balanceOf(addr1.address)).to.equal(transferAmount);
    });
  });

  describe("Blacklist Functionality", function () {
    it("Should allow owner to blacklist an account", async function () {
      await expect(stableCoin.blacklist(addr1.address))
        .to.emit(stableCoin, "Blacklisted")
        .withArgs(addr1.address);
      
      expect(await stableCoin.isBlacklisted(addr1.address)).to.be.true;
    });

    it("Should allow owner to unblacklist an account", async function () {
      await stableCoin.blacklist(addr1.address);
      
      await expect(stableCoin.unBlacklist(addr1.address))
        .to.emit(stableCoin, "UnBlacklisted")
        .withArgs(addr1.address);
      
      expect(await stableCoin.isBlacklisted(addr1.address)).to.be.false;
    });

    it("Should not allow non-owner to blacklist", async function () {
      await expect(
        stableCoin.connect(addr1).blacklist(addr2.address)
      ).to.be.reverted;
    });

    it("Should prevent blacklisted account from receiving tokens", async function () {
      await stableCoin.blacklist(addr1.address);
      
      await expect(
        stableCoin.transfer(addr1.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });

    it("Should prevent blacklisted account from sending tokens", async function () {
      const transferAmount = ethers.parseEther("100");
      await stableCoin.transfer(addr1.address, transferAmount);
      await stableCoin.blacklist(addr1.address);
      
      await expect(
        stableCoin.connect(addr1).transfer(addr2.address, ethers.parseEther("50"))
      ).to.be.reverted;
    });

    it("Should prevent minting to blacklisted account", async function () {
      await stableCoin.blacklist(addr1.address);
      
      await expect(
        stableCoin.mint(addr1.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });

    it("Should prevent blacklisted account from burning", async function () {
      const transferAmount = ethers.parseEther("100");
      await stableCoin.transfer(addr1.address, transferAmount);
      await stableCoin.blacklist(addr1.address);
      
      await expect(
        stableCoin.connect(addr1).burn(ethers.parseEther("50"))
      ).to.be.reverted;
    });

    it("Should prevent blacklisted account from approving", async function () {
      const transferAmount = ethers.parseEther("100");
      await stableCoin.transfer(addr1.address, transferAmount);
      await stableCoin.blacklist(addr1.address);
      
      await expect(
        stableCoin.connect(addr1).approve(addr2.address, ethers.parseEther("50"))
      ).to.be.reverted;
    });

    it("Should not allow blacklisting already blacklisted account", async function () {
      await stableCoin.blacklist(addr1.address);
      
      await expect(
        stableCoin.blacklist(addr1.address)
      ).to.be.reverted;
    });

    it("Should not allow unblacklisting non-blacklisted account", async function () {
      await expect(
        stableCoin.unBlacklist(addr1.address)
      ).to.be.reverted;
    });

    it("Should allow transfers after unblacklisting", async function () {
      const transferAmount = ethers.parseEther("100");
      await stableCoin.transfer(addr1.address, transferAmount);
      await stableCoin.blacklist(addr1.address);
      await stableCoin.unBlacklist(addr1.address);
      
      await stableCoin.connect(addr1).transfer(addr2.address, ethers.parseEther("50"));
      expect(await stableCoin.balanceOf(addr2.address)).to.equal(ethers.parseEther("50"));
    });
  });

  describe("Combined Pause and Blacklist", function () {
    it("Should prevent blacklisted account from transfers even when not paused", async function () {
      const transferAmount = ethers.parseEther("100");
      await stableCoin.transfer(addr1.address, transferAmount);
      await stableCoin.blacklist(addr1.address);
      
      await expect(
        stableCoin.connect(addr1).transfer(addr2.address, ethers.parseEther("50"))
      ).to.be.reverted;
    });

    it("Should prevent all transfers when paused regardless of blacklist status", async function () {
      await stableCoin.pause();
      
      await expect(
        stableCoin.transfer(addr1.address, ethers.parseEther("100"))
      ).to.be.reverted;
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero amount transfers", async function () {
      await expect(stableCoin.transfer(addr1.address, 0))
        .to.emit(stableCoin, "Transfer")
        .withArgs(owner.address, addr1.address, 0);
      
      expect(await stableCoin.balanceOf(addr1.address)).to.equal(0);
    });

    it("Should handle zero amount minting", async function () {
      await expect(stableCoin.mint(addr1.address, 0))
        .to.emit(stableCoin, "Transfer")
        .withArgs(ethers.ZeroAddress, addr1.address, 0);
      
      expect(await stableCoin.balanceOf(addr1.address)).to.equal(0);
    });

    it("Should handle zero amount burning", async function () {
      await expect(stableCoin.burn(0))
        .to.emit(stableCoin, "Transfer")
        .withArgs(owner.address, ethers.ZeroAddress, 0);
    });

    it("Should handle maximum uint256 allowance", async function () {
      const maxAllowance = ethers.MaxUint256;
      await stableCoin.approve(addr1.address, maxAllowance);
      
      expect(await stableCoin.allowance(owner.address, addr1.address)).to.equal(maxAllowance);
    });
  });
});