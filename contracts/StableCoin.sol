// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract StableCoin is ERC20, Ownable, Pausable {
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
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply * 10**decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner notBlacklisted(to) {
        _mint(to, amount);
    }

    function burn(uint256 amount) public whenNotPaused notBlacklisted(msg.sender) {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) public whenNotPaused notBlacklisted(account) notBlacklisted(msg.sender) {
        uint256 currentAllowance = allowance(account, msg.sender);
        require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
        
        _approve(account, msg.sender, currentAllowance - amount);
        _burn(account, amount);
    }

    // Pause functionality
    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    // Blacklist functionality
    function blacklist(address account) public onlyOwner {
        require(!_blacklisted[account], "Account is already blacklisted");
        _blacklisted[account] = true;
        emit Blacklisted(account);
    }

    function unBlacklist(address account) public onlyOwner {
        require(_blacklisted[account], "Account is not blacklisted");
        _blacklisted[account] = false;
        emit UnBlacklisted(account);
    }

    function isBlacklisted(address account) public view returns (bool) {
        return _blacklisted[account];
    }

    // Override transfer functions to include pause and blacklist checks
    function transfer(address to, uint256 amount) public override whenNotPaused notBlacklisted(msg.sender) notBlacklisted(to) returns (bool) {
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override whenNotPaused notBlacklisted(from) notBlacklisted(to) notBlacklisted(msg.sender) returns (bool) {
        return super.transferFrom(from, to, amount);
    }

    function approve(address spender, uint256 amount) public override whenNotPaused notBlacklisted(msg.sender) notBlacklisted(spender) returns (bool) {
        return super.approve(spender, amount);
    }
}