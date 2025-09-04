// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

// Custom errors for gas optimization
error AccountBlacklistedError();
error AccountAlreadyBlacklisted();
error AccountNotBlacklisted();
error ContractPaused();
error TransferToBlacklistedAccount();
error TransferFromBlacklistedAccount();
error InsufficientBalance();
error InsufficientAllowance();

contract OptimizedStableCoin is ERC20, Ownable, Pausable {
    // Packed storage for gas optimization
    // Each address maps to a uint256 where:
    // bit 0: blacklisted (1 = blacklisted, 0 = not blacklisted)
    // bits 1-255: reserved for future use
    mapping(address => uint256) private _accountStatus;

    // Events optimized for gas (using indexed parameters strategically)
    event AccountBlacklisted(address indexed account);
    event AccountUnBlacklisted(address indexed account);

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply * 10**decimals());
    }

    // Gas-optimized modifiers
    modifier whenNotPausedAndNotBlacklisted(address account) {
        if (paused()) revert ContractPaused();
        if (_accountStatus[account] & 1 != 0) revert AccountBlacklistedError();
        _;
    }

    modifier onlyNotBlacklisted(address account) {
        if (_accountStatus[account] & 1 != 0) revert AccountBlacklistedError();
        _;
    }

    // Optimized minting function
    function mint(address to, uint256 amount) external onlyOwner onlyNotBlacklisted(to) {
        _mint(to, amount);
    }

    // Optimized burning functions
    function burn(uint256 amount) external whenNotPausedAndNotBlacklisted(msg.sender) {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) 
        external 
        whenNotPausedAndNotBlacklisted(account)
        whenNotPausedAndNotBlacklisted(msg.sender)
    {
        uint256 currentAllowance = allowance(account, msg.sender);
        if (currentAllowance < amount) revert InsufficientAllowance();
        
        _approve(account, msg.sender, currentAllowance - amount);
        _burn(account, amount);
    }

    // Pause functions (unchanged but using custom errors)
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Optimized blacklist functions
    function blacklist(address account) external onlyOwner {
        uint256 status = _accountStatus[account];
        if (status & 1 != 0) revert AccountAlreadyBlacklisted();
        
        _accountStatus[account] = status | 1; // Set bit 0 to 1
        emit AccountBlacklisted(account);
    }

    function unBlacklist(address account) external onlyOwner {
        uint256 status = _accountStatus[account];
        if (status & 1 == 0) revert AccountNotBlacklisted();
        
        _accountStatus[account] = status & ~uint256(1); // Set bit 0 to 0
        emit AccountUnBlacklisted(account);
    }

    function isBlacklisted(address account) external view returns (bool) {
        return _accountStatus[account] & 1 != 0;
    }

    // Batch blacklist operations for gas efficiency
    function batchBlacklist(address[] calldata accounts) external onlyOwner {
        uint256 length = accounts.length;
        for (uint256 i; i < length;) {
            address account = accounts[i];
            uint256 status = _accountStatus[account];
            
            if (status & 1 == 0) { // Not already blacklisted
                _accountStatus[account] = status | 1;
                emit AccountBlacklisted(account);
            }
            
            unchecked { ++i; }
        }
    }

    function batchUnBlacklist(address[] calldata accounts) external onlyOwner {
        uint256 length = accounts.length;
        for (uint256 i; i < length;) {
            address account = accounts[i];
            uint256 status = _accountStatus[account];
            
            if (status & 1 != 0) { // Currently blacklisted
                _accountStatus[account] = status & ~uint256(1);
                emit AccountUnBlacklisted(account);
            }
            
            unchecked { ++i; }
        }
    }

    // Optimized transfer functions
    function transfer(address to, uint256 amount) 
        public 
        override 
        returns (bool) 
    {
        address owner = _msgSender();
        
        // Combined checks for gas optimization
        if (paused()) revert ContractPaused();
        if (_accountStatus[owner] & 1 != 0) revert TransferFromBlacklistedAccount();
        if (_accountStatus[to] & 1 != 0) revert TransferToBlacklistedAccount();
        
        _transfer(owner, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) 
        public 
        override 
        returns (bool) 
    {
        address spender = _msgSender();
        
        // Combined checks for gas optimization
        if (paused()) revert ContractPaused();
        if (_accountStatus[from] & 1 != 0) revert TransferFromBlacklistedAccount();
        if (_accountStatus[to] & 1 != 0) revert TransferToBlacklistedAccount();
        if (_accountStatus[spender] & 1 != 0) revert AccountBlacklistedError();
        
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) 
        public 
        override 
        returns (bool) 
    {
        address owner = _msgSender();
        
        // Combined checks for gas optimization
        if (paused()) revert ContractPaused();
        if (_accountStatus[owner] & 1 != 0) revert AccountBlacklistedError();
        if (_accountStatus[spender] & 1 != 0) revert AccountBlacklistedError();
        
        _approve(owner, spender, amount);
        return true;
    }

    // Gas-optimized batch transfer function
    function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) 
        external 
        returns (bool) 
    {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        
        address sender = _msgSender();
        if (paused()) revert ContractPaused();
        if (_accountStatus[sender] & 1 != 0) revert AccountBlacklistedError();
        
        uint256 length = recipients.length;
        for (uint256 i; i < length;) {
            address to = recipients[i];
            uint256 amount = amounts[i];
            
            if (_accountStatus[to] & 1 != 0) revert TransferToBlacklistedAccount();
            _transfer(sender, to, amount);
            
            unchecked { ++i; }
        }
        
        return true;
    }

    // Gas-optimized view functions
    function getAccountInfo(address account) external view returns (
        uint256 balance,
        bool blacklisted,
        bool contractPaused
    ) {
        return (
            balanceOf(account),
            _accountStatus[account] & 1 != 0,
            paused()
        );
    }

    function batchGetBalance(address[] calldata accounts) 
        external 
        view 
        returns (uint256[] memory balances) 
    {
        uint256 length = accounts.length;
        balances = new uint256[](length);
        
        for (uint256 i; i < length;) {
            balances[i] = balanceOf(accounts[i]);
            unchecked { ++i; }
        }
    }

    // Emergency function with gas optimization
    function emergencyPause() external onlyOwner {
        if (!paused()) {
            _pause();
        }
    }

    // Additional internal validation for transfers
    function _checkTransferRestrictions(address from, address to) internal view {
        // Skip checks for mint/burn operations (from/to == address(0))
        if (from == address(0) || to == address(0)) return;
        
        // Check blacklist status
        if (_accountStatus[from] & 1 != 0) revert TransferFromBlacklistedAccount();
        if (_accountStatus[to] & 1 != 0) revert TransferToBlacklistedAccount();
    }
}