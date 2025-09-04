// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract GovernedStableCoin is ERC20, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant BLACKLIST_ROLE = keccak256("BLACKLIST_ROLE");
    
    mapping(address => bool) private _blacklisted;

    event Blacklisted(address indexed account);
    event UnBlacklisted(address indexed account);

    modifier notBlacklisted(address account) {
        require(!_blacklisted[account], "Account is blacklisted");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address admin,
        address timelock
    ) ERC20(name, symbol) {
        // Grant DEFAULT_ADMIN_ROLE to timelock for ultimate control
        _grantRole(DEFAULT_ADMIN_ROLE, timelock);
        
        // Grant initial roles to admin (can be revoked later)
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(BLACKLIST_ROLE, admin);
        
        // Mint initial supply to admin
        _mint(admin, initialSupply * 10**decimals());
    }

    // Minting functions - only MINTER_ROLE
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) notBlacklisted(to) {
        _mint(to, amount);
    }

    // Burning functions - available to anyone for their own tokens
    function burn(uint256 amount) public whenNotPaused notBlacklisted(msg.sender) {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) 
        public 
        whenNotPaused 
        notBlacklisted(account) 
        notBlacklisted(msg.sender) 
    {
        uint256 currentAllowance = allowance(account, msg.sender);
        require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
        
        _approve(account, msg.sender, currentAllowance - amount);
        _burn(account, amount);
    }

    // Pause functionality - only PAUSER_ROLE
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // Blacklist functionality - only BLACKLIST_ROLE
    function blacklist(address account) public onlyRole(BLACKLIST_ROLE) {
        require(!_blacklisted[account], "Account is already blacklisted");
        _blacklisted[account] = true;
        emit Blacklisted(account);
    }

    function unBlacklist(address account) public onlyRole(BLACKLIST_ROLE) {
        require(_blacklisted[account], "Account is not blacklisted");
        _blacklisted[account] = false;
        emit UnBlacklisted(account);
    }

    function isBlacklisted(address account) public view returns (bool) {
        return _blacklisted[account];
    }

    // Override transfer functions to include pause and blacklist checks
    function transfer(address to, uint256 amount) 
        public 
        override 
        whenNotPaused 
        notBlacklisted(msg.sender) 
        notBlacklisted(to) 
        returns (bool) 
    {
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) 
        public 
        override 
        whenNotPaused 
        notBlacklisted(from) 
        notBlacklisted(to) 
        notBlacklisted(msg.sender) 
        returns (bool) 
    {
        return super.transferFrom(from, to, amount);
    }

    function approve(address spender, uint256 amount) 
        public 
        override 
        whenNotPaused 
        notBlacklisted(msg.sender) 
        notBlacklisted(spender) 
        returns (bool) 
    {
        return super.approve(spender, amount);
    }

    // Emergency functions that can only be called by DEFAULT_ADMIN_ROLE (TimeLock)
    function emergencyWithdraw(address token, address to, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        if (token == address(0)) {
            // Withdraw ETH
            payable(to).transfer(amount);
        } else {
            // Withdraw ERC20 tokens
            IERC20(token).transfer(to, amount);
        }
    }

    // Role management functions
    function grantMinterRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MINTER_ROLE, account);
    }

    function revokeMinterRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(MINTER_ROLE, account);
    }

    function grantPauserRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(PAUSER_ROLE, account);
    }

    function revokePauserRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(PAUSER_ROLE, account);
    }

    function grantBlacklistRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(BLACKLIST_ROLE, account);
    }

    function revokeBlacklistRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(BLACKLIST_ROLE, account);
    }

    // Batch blacklist operations for efficiency
    function batchBlacklist(address[] calldata accounts) external onlyRole(BLACKLIST_ROLE) {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (!_blacklisted[accounts[i]]) {
                _blacklisted[accounts[i]] = true;
                emit Blacklisted(accounts[i]);
            }
        }
    }

    function batchUnBlacklist(address[] calldata accounts) external onlyRole(BLACKLIST_ROLE) {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (_blacklisted[accounts[i]]) {
                _blacklisted[accounts[i]] = false;
                emit UnBlacklisted(accounts[i]);
            }
        }
    }

    // View functions
    function hasRole(bytes32 role, address account) public view override returns (bool) {
        return super.hasRole(role, account);
    }

    function getRoleAdmin(bytes32 role) public view override returns (bytes32) {
        return super.getRoleAdmin(role);
    }

    // The following functions are overrides required by Solidity
    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // Receive ETH
    receive() external payable {}
}