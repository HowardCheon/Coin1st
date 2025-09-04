# StableCoin Deployment Guide

This guide covers deploying the StableCoin contract to both local testnet and Sepolia testnet.

## Prerequisites

1. **Node.js** (v16 or higher)
2. **npm** installed
3. **Git** (optional)

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   ```bash
   # Copy environment template
   copy .env.example .env
   
   # Edit .env file with your credentials
   notepad .env
   ```

   Fill in the following values in `.env`:
   ```env
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
   PRIVATE_KEY=your_private_key_without_0x_prefix
   ETHERSCAN_API_KEY=your_etherscan_api_key
   REPORT_GAS=true
   ```

## Network Options

### 1. Local Hardhat Network (Default)

**Deploy to in-memory network:**
```bash
npm run deploy
```

**Features:**
- Instant deployment
- Pre-funded accounts
- No real ETH required
- Perfect for testing

### 2. Local Hardhat Node (Persistent)

**Start local node:**
```bash
npm run node
```

**Deploy to local node (in new terminal):**
```bash
npm run deploy:local
```

**Features:**
- Persistent blockchain
- Demo operations included
- Test all contract functions
- Multiple pre-funded accounts

### 3. Sepolia Testnet

**Requirements:**
- Sepolia ETH (from [faucet](https://sepoliafaucet.com/))
- RPC endpoint (Alchemy/Infura)
- Private key with funds

**Deploy:**
```bash
npm run deploy:sepolia
```

**Verify on Etherscan:**
```bash
npm run verify:sepolia [CONTRACT_ADDRESS]
```

## Available Scripts

```bash
# Compilation
npm run compile        # Compile contracts

# Testing
npm run test          # Run all tests

# Local Deployment
npm run node          # Start local Hardhat node
npm run deploy        # Deploy to default Hardhat network
npm run deploy:local  # Deploy to localhost with demos

# Sepolia Deployment
npm run deploy:sepolia  # Deploy to Sepolia testnet
npm run verify:sepolia  # Verify contract on Etherscan
```

## Contract Parameters

Default deployment parameters:
- **Name**: "StableCoin" (or "Local StableCoin" for local)
- **Symbol**: "STABLE" (or "LSTABLE" for local)
- **Initial Supply**: 1,000,000 tokens
- **Decimals**: 18
- **Owner**: Deployer address

## Post-Deployment

### Local Network
After deployment, you can:
1. Use Hardhat console: `npx hardhat console --network localhost`
2. Import accounts into MetaMask using the displayed private keys
3. Add the token contract to MetaMask

### Sepolia Network
After deployment and verification:
1. View contract on [Sepolia Etherscan](https://sepolia.etherscan.io/)
2. Add to MetaMask:
   - Token Address: [Deployed Contract Address]
   - Token Symbol: STABLE
   - Token Decimals: 18

## Contract Functions

### Owner Functions
- `mint(address to, uint256 amount)` - Mint new tokens
- `pause()` / `unpause()` - Pause/unpause contract
- `blacklist(address account)` - Add to blacklist
- `unBlacklist(address account)` - Remove from blacklist

### User Functions
- `transfer(address to, uint256 amount)` - Transfer tokens
- `approve(address spender, uint256 amount)` - Approve spending
- `burn(uint256 amount)` - Burn own tokens
- `burnFrom(address account, uint256 amount)` - Burn with allowance

### View Functions
- `balanceOf(address account)` - Check balance
- `totalSupply()` - Total token supply
- `paused()` - Check if paused
- `isBlacklisted(address account)` - Check blacklist status

## Security Notes

⚠️ **Important Security Practices:**

1. **Never commit private keys** to version control
2. **Use .env files** for sensitive data
3. **Verify contracts** on Etherscan after deployment
4. **Test thoroughly** on testnet before mainnet
5. **Keep backup** of deployment addresses and transaction hashes

## Troubleshooting

### Common Issues

**Port 8545 already in use:**
```bash
# Find and kill process using port 8545
netstat -ano | findstr :8545
taskkill /PID [PID_NUMBER] /F
```

**Insufficient funds:**
- Get Sepolia ETH from faucets
- Check account balance before deployment

**RPC connection issues:**
- Verify RPC URL in .env
- Check API key limits
- Try different RPC providers

**Verification failed:**
- Ensure exact constructor parameters match
- Wait for block confirmations
- Check Etherscan API key

### Getting Help

1. Check [Hardhat Documentation](https://hardhat.org/docs)
2. Visit [OpenZeppelin Docs](https://docs.openzeppelin.com/)
3. Join [Ethereum Discord](https://discord.gg/ethereum-org)

## Example Deployment Output

```
Starting StableCoin deployment...
Deploying contracts with account: 0xf39F...2266
Account balance: 10000.0 ETH

Deployment Parameters:
Token Name: StableCoin
Token Symbol: STABLE  
Initial Supply: 1000000 tokens

✅ StableCoin deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3

Contract Details:
- Name: StableCoin
- Symbol: STABLE
- Total Supply: 1000000.0 STABLE
- Owner: 0xf39F...2266
- Paused: false

🎉 Deployment completed successfully!
```